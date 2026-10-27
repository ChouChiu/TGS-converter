import type {
	EncoderRequest,
	EncoderResponse,
	OutputFormat,
} from "@/shared/model/types"

export interface EncoderSession {
	addFrame(index: number, duration: number, buffer: ArrayBuffer): void
	finish(): Promise<Uint8Array>
	destroy(): void
}

export interface EncoderClient {
	readonly concurrency: number
	acquireSession(
		format: OutputFormat,
		width: number,
		height: number,
		frameCount: number,
		onProgress: (progress: number) => void,
	): Promise<EncoderSession>
	destroy(): void
}

export function getRecommendedWorkerCount(): number {
	const cores =
		typeof navigator !== "undefined" && navigator.hardwareConcurrency
			? navigator.hardwareConcurrency
			: 4
	if (cores <= 2) return Math.max(1, cores)
	if (cores <= 4) return 3
	if (cores <= 8) return 4
	return Math.min(6, Math.floor(cores * 0.75))
}

function spawnWorker(): Worker {
	return new Worker(new URL("../workers/encoder.worker.ts", import.meta.url), {
		type: "module",
	})
}

export function createEncoderClient(
	signal: AbortSignal,
	poolSize = getRecommendedWorkerCount(),
): EncoderClient {
	const effectivePoolSize = Math.max(1, poolSize)
	let destroyed = false
	let nextSessionId = 1

	const idleWorkers: Worker[] = Array.from({ length: effectivePoolSize }, () =>
		spawnWorker(),
	)
	const waitQueue: Array<(worker: Worker) => void> = []
	const activeSessions = new Set<{
		worker: Worker
		reject: (err: Error) => void
	}>()

	function returnWorker(worker: Worker, isHealthy = true) {
		if (destroyed || signal.aborted) {
			worker.terminate()
			return
		}

		let validWorker: Worker
		if (isHealthy) {
			validWorker = worker
		} else {
			worker.terminate()
			validWorker = spawnWorker()
		}
		const next = waitQueue.shift()
		if (next) {
			next(validWorker)
		} else {
			idleWorkers.push(validWorker)
		}
	}

	function acquireWorker(): Promise<Worker> {
		if (destroyed || signal.aborted) {
			return Promise.reject(new DOMException("转换已取消", "AbortError"))
		}
		const idle = idleWorkers.pop()
		if (idle) {
			return Promise.resolve(idle)
		}
		return new Promise<Worker>((resolve, reject) => {
			const onAbort = () => {
				const idx = waitQueue.indexOf(assign)
				if (idx !== -1) waitQueue.splice(idx, 1)
				reject(new DOMException("转换已取消", "AbortError"))
			}

			const assign = (worker: Worker) => {
				signal.removeEventListener("abort", onAbort)
				if (destroyed || signal.aborted) {
					returnWorker(worker)
					reject(new DOMException("转换已取消", "AbortError"))
				} else {
					resolve(worker)
				}
			}

			signal.addEventListener("abort", onAbort, { once: true })
			waitQueue.push(assign)
		})
	}

	const destroy = () => {
		if (destroyed) return
		destroyed = true
		signal.removeEventListener("abort", destroy)

		for (const session of activeSessions) {
			session.reject(new DOMException("转换已取消", "AbortError"))
			session.worker.terminate()
		}
		activeSessions.clear()

		for (const worker of idleWorkers) {
			worker.terminate()
		}
		idleWorkers.length = 0
		waitQueue.length = 0
	}

	signal.addEventListener("abort", destroy, { once: true })

	async function acquireSession(
		format: OutputFormat,
		width: number,
		height: number,
		frameCount: number,
		onProgress: (progress: number) => void,
	): Promise<EncoderSession> {
		const worker = await acquireWorker()
		const sessionId = nextSessionId
		nextSessionId += 1
		let sessionActive = true

		return new Promise<EncoderSession>((resolveSession) => {
			let resultResolve!: (bytes: Uint8Array) => void
			let resultReject!: (err: Error) => void
			const resultPromise = new Promise<Uint8Array>((res, rej) => {
				resultResolve = res
				resultReject = rej
			})
			resultPromise.catch(() => {})

			const sessionEntry = { worker, reject: resultReject }
			activeSessions.add(sessionEntry)

			const cleanup = () => {
				sessionActive = false
				activeSessions.delete(sessionEntry)
			}

			worker.onerror = (event) => {
				if (!sessionActive) return
				cleanup()
				resultReject(new Error(event.message || "编码 Worker 运行失败"))
				returnWorker(worker, false)
			}

			worker.onmessage = (event: MessageEvent<EncoderResponse>) => {
				const message = event.data
				if (message.id !== sessionId) return

				if (message.type === "progress") {
					onProgress(message.progress)
				} else if (message.type === "error") {
					cleanup()
					resultReject(new Error(message.message))
					returnWorker(worker, true)
				} else if (message.type === "result") {
					cleanup()
					resultResolve(new Uint8Array(message.buffer))
					returnWorker(worker, true)
				}
			}

			worker.postMessage({
				type: "init",
				id: sessionId,
				format,
				width,
				height,
				frameCount,
			} satisfies EncoderRequest)

			const session: EncoderSession = {
				addFrame(index, duration, buffer) {
					if (!sessionActive || signal.aborted || destroyed) {
						throw new DOMException("转换已取消", "AbortError")
					}
					worker.postMessage(
						{
							type: "frame",
							id: sessionId,
							index,
							duration,
							buffer,
						} satisfies EncoderRequest,
						[buffer],
					)
				},
				async finish() {
					if (!sessionActive || signal.aborted || destroyed) {
						throw new DOMException("转换已取消", "AbortError")
					}
					worker.postMessage({
						type: "finish",
						id: sessionId,
					} satisfies EncoderRequest)
					return resultPromise
				},
				destroy() {
					if (!sessionActive) return
					cleanup()
					returnWorker(worker, false)
				},
			}

			resolveSession(session)
		})
	}

	return {
		concurrency: effectivePoolSize,
		acquireSession,
		destroy,
	}
}
