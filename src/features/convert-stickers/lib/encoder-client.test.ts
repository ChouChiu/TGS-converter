import { describe, expect, it, vi } from "vitest"
import {
	createEncoderClient,
	getRecommendedWorkerCount,
} from "./encoder-client"

describe("getRecommendedWorkerCount", () => {
	it("在不同核心数下返回合理的并发线程数", () => {
		const originalConcurrency = navigator.hardwareConcurrency

		try {
			Object.defineProperty(navigator, "hardwareConcurrency", {
				value: 2,
				configurable: true,
			})
			expect(getRecommendedWorkerCount()).toBe(2)

			Object.defineProperty(navigator, "hardwareConcurrency", {
				value: 4,
				configurable: true,
			})
			expect(getRecommendedWorkerCount()).toBe(3)

			Object.defineProperty(navigator, "hardwareConcurrency", {
				value: 8,
				configurable: true,
			})
			expect(getRecommendedWorkerCount()).toBe(4)

			Object.defineProperty(navigator, "hardwareConcurrency", {
				value: 16,
				configurable: true,
			})
			expect(getRecommendedWorkerCount()).toBe(6)
		} finally {
			Object.defineProperty(navigator, "hardwareConcurrency", {
				value: originalConcurrency,
				configurable: true,
			})
		}
	})
})

describe("createEncoderClient Worker 池管理", () => {
	class MockWorker {
		onmessage: ((event: MessageEvent) => void) | null = null
		onerror: ((event: ErrorEvent) => void) | null = null
		terminated = false

		postMessage(message: unknown) {
			const req = message as { type: string; id: number }
			if (req.type === "finish") {
				setTimeout(() => {
					if (this.onmessage && !this.terminated) {
						this.onmessage(
							new MessageEvent("message", {
								data: {
									type: "result",
									id: req.id,
									buffer: new Uint8Array([1, 2, 3]).buffer,
								},
							}),
						)
					}
				}, 10)
			}
		}

		terminate() {
			this.terminated = true
		}
	}

	it("支持多任务并发分配与空闲 Worker 复用", async () => {
		const originalWorker = globalThis.Worker
		globalThis.Worker = MockWorker as unknown as typeof Worker

		try {
			const controller = new AbortController()
			const client = createEncoderClient(controller.signal, 2)
			expect(client.concurrency).toBe(2)

			const onProgress = vi.fn()
			const session1 = await client.acquireSession(
				"webp",
				512,
				512,
				30,
				onProgress,
			)
			const session2 = await client.acquireSession(
				"webp",
				512,
				512,
				30,
				onProgress,
			)

			// 两槽位都被占用时，第三个任务等待
			let session3Acquired = false
			const session3Promise = client
				.acquireSession("webp", 512, 512, 30, onProgress)
				.then((session) => {
					session3Acquired = true
					return session
				})

			expect(session3Acquired).toBe(false)

			// 完成 session1，释放槽位给 session3
			const result1 = await session1.finish()
			expect(result1).toEqual(new Uint8Array([1, 2, 3]))

			const session3 = await session3Promise
			expect(session3Acquired).toBe(true)

			const [result2, result3] = await Promise.all([
				session2.finish(),
				session3.finish(),
			])
			expect(result2).toEqual(new Uint8Array([1, 2, 3]))
			expect(result3).toEqual(new Uint8Array([1, 2, 3]))

			client.destroy()
		} finally {
			globalThis.Worker = originalWorker
		}
	})

	it("在 AbortSignal 触发时取消所有会话和等待队列", async () => {
		const originalWorker = globalThis.Worker
		globalThis.Worker = MockWorker as unknown as typeof Worker

		try {
			const controller = new AbortController()
			const client = createEncoderClient(controller.signal, 1)

			const session = await client.acquireSession("webp", 512, 512, 10, vi.fn())
			const queuedPromise = client.acquireSession("webp", 512, 512, 10, vi.fn())

			controller.abort()

			await expect(queuedPromise).rejects.toThrow("转换已取消")
			await expect(session.finish()).rejects.toThrow()

			client.destroy()
		} finally {
			globalThis.Worker = originalWorker
		}
	})
})
