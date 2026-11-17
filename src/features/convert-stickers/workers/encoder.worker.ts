/// <reference lib="webworker" />

import type {
	EncoderRequest,
	EncoderResponse,
	OutputFormat,
} from "@/shared/model/types"

interface FrameData {
	index: number
	duration: number
	buffer: ArrayBuffer
}

let currentSessionId = 0
let format: OutputFormat | undefined
let width = 0
let height = 0
let frameCount = 0
let frames: FrameData[] = []

const GIF_ALPHA_THRESHOLD = 128
const MAX_GIF_PALETTE_SAMPLE_PIXELS = 1_048_576

let gifencPromise: Promise<typeof import("gifenc")> | null = null
function getGifenc() {
	if (!gifencPromise) {
		gifencPromise = import("gifenc")
	}
	return gifencPromise
}

let upngPromise: Promise<typeof import("upng-js")> | null = null
async function getUpng() {
	if (!upngPromise) {
		const pakoModule = await import("pako")
		const pako =
			(pakoModule as unknown as { default?: unknown }).default ?? pakoModule
		const workerGlobal = globalThis as unknown as {
			window: unknown
			pako: unknown
		}
		workerGlobal.window = globalThis
		workerGlobal.pako = pako
		upngPromise = import("upng-js")
	}
	return upngPromise
}

interface WebPVector {
	push_back(item: {
		duration: number
		data: Uint8Array
		config: { lossless: number; quality: number }
		has_config: boolean
	}): void
	delete(): void
}

interface WebPModuleInstance {
	VectorWebPAnimationFrame: new () => WebPVector
	encodeAnimation(
		width: number,
		height: number,
		hasAlpha: boolean,
		frames: WebPVector,
	): Uint8Array | null
}

let wasmModulePromise: Promise<WebPModuleInstance> | null = null
function getWasmWebpModule(): Promise<WebPModuleInstance> {
	if (!wasmModulePromise) {
		wasmModulePromise = import(
			// @ts-expect-error wasm-webp internal module has no typescript declaration
			"wasm-webp/dist/esm/webp-wasm.js"
		).then((m) =>
			(
				m as unknown as {
					default: () => Promise<WebPModuleInstance>
				}
			).default(),
		)
	}
	return wasmModulePromise
}

function post(message: EncoderResponse, transfer: Transferable[] = []): void {
	self.postMessage(message, transfer)
}

function createThrottledProgress(sessionId: number, scale = 1) {
	let lastProgressAt = 0
	return (completed: number, total: number) => {
		const now = performance.now()
		if (completed === total || now - lastProgressAt >= 50) {
			lastProgressAt = now
			post({
				type: "progress",
				id: sessionId,
				progress: (completed / total) * scale,
			})
		}
	}
}

function packFrameBuffers(
	targetFrames: FrameData[],
	bytesPerFrame: number,
): Uint8Array {
	const sample = new Uint8Array(targetFrames.length * bytesPerFrame)
	let offset = 0
	for (const frame of targetFrames) {
		sample.set(new Uint8Array(frame.buffer), offset)
		offset += frame.buffer.byteLength
	}
	return sample
}

function gifPaletteSample(): Uint8Array {
	const pixelsPerFrame = width * height
	const bytesPerFrame = pixelsPerFrame * 4
	if (frames.length * pixelsPerFrame <= MAX_GIF_PALETTE_SAMPLE_PIXELS) {
		return packFrameBuffers(frames, bytesPerFrame)
	}

	const maxFrames = Math.max(
		1,
		Math.floor(MAX_GIF_PALETTE_SAMPLE_PIXELS / pixelsPerFrame),
	)
	const step = Math.max(1, Math.floor(frames.length / maxFrames))
	const sampledFrames: FrameData[] = []
	for (
		let i = 0;
		i < frames.length && sampledFrames.length < maxFrames;
		i += step
	) {
		sampledFrames.push(frames[i])
	}
	return packFrameBuffers(sampledFrames, bytesPerFrame)
}

async function encodeGif(sessionId: number): Promise<Uint8Array> {
	const { GIFEncoder, applyPalette, quantize } = await getGifenc()
	const gif = GIFEncoder({ initialCapacity: Math.max(4096, width * height) })
	const palette = quantize(gifPaletteSample(), 256, {
		format: "rgba4444",
		oneBitAlpha: GIF_ALPHA_THRESHOLD,
		clearAlpha: true,
		clearAlphaThreshold: GIF_ALPHA_THRESHOLD,
	})
	const transparentIndex = palette.findIndex((color) => (color[3] ?? 255) === 0)
	const reportProgress = createThrottledProgress(sessionId)

	for (let index = 0; index < frames.length; index += 1) {
		if (sessionId !== currentSessionId) throw new Error("编码已取消")
		const frame = frames[index]
		const indexed = applyPalette(
			new Uint8Array(frame.buffer),
			palette,
			"rgba4444",
		)
		gif.writeFrame(indexed, width, height, {
			palette: index === 0 ? palette : undefined,
			delay: frame.duration,
			repeat: index === 0 ? 0 : undefined,
			transparent: transparentIndex >= 0,
			transparentIndex: Math.max(0, transparentIndex),
			dispose: transparentIndex >= 0 ? 3 : 1,
		})
		reportProgress(index + 1, frames.length)
	}
	gif.finish()
	return gif.bytes()
}

async function encodeApng(sessionId: number): Promise<Uint8Array> {
	const UPNG = await getUpng()
	if (sessionId !== currentSessionId) throw new Error("编码已取消")
	post({ type: "progress", id: sessionId, progress: 0.5 })
	const buffers = frames.map((frame) => frame.buffer)
	const delays = frames.map((frame) => frame.duration)
	const output = UPNG.encode(buffers, width, height, 0, delays)
	post({ type: "progress", id: sessionId, progress: 1.0 })
	return new Uint8Array(output)
}

async function encodeWebp(sessionId: number): Promise<Uint8Array> {
	const module = await getWasmWebpModule()
	if (sessionId !== currentSessionId) throw new Error("编码已取消")

	const frameVector = new module.VectorWebPAnimationFrame()
	try {
		const config = { lossless: 0, quality: 75 }
		const reportProgress = createThrottledProgress(sessionId, 0.9)
		for (let index = 0; index < frames.length; index += 1) {
			if (sessionId !== currentSessionId) throw new Error("编码已取消")
			const frame = frames[index]
			frameVector.push_back({
				duration: frame.duration,
				data: new Uint8Array(frame.buffer),
				config,
				has_config: true,
			})
			reportProgress(index + 1, frames.length)
		}
		if (sessionId !== currentSessionId) throw new Error("编码已取消")
		const output = module.encodeAnimation(width, height, true, frameVector)
		if (!output) throw new Error("WebP 编码器未生成结果")
		post({ type: "progress", id: sessionId, progress: 1.0 })
		return new Uint8Array(output)
	} finally {
		frameVector.delete()
	}
}

async function finish(sessionId: number): Promise<void> {
	try {
		if (!format || frames.length !== frameCount) {
			throw new Error(`帧数据不完整：收到 ${frames.length}/${frameCount} 帧`)
		}
		frames.sort((a, b) => a.index - b.index)
		let output: Uint8Array
		if (format === "gif") output = await encodeGif(sessionId)
		else if (format === "apng") output = await encodeApng(sessionId)
		else output = await encodeWebp(sessionId)

		if (sessionId !== currentSessionId) return

		const exactBuffer = output.buffer.slice(
			output.byteOffset,
			output.byteOffset + output.byteLength,
		) as ArrayBuffer
		post({ type: "result", id: sessionId, buffer: exactBuffer }, [exactBuffer])
	} finally {
		if (sessionId === currentSessionId) {
			frames = []
		}
	}
}

self.addEventListener("unhandledrejection", (event) => {
	post({
		type: "error",
		id: currentSessionId,
		message:
			event.reason instanceof Error
				? event.reason.message
				: String(event.reason || "Worker 内部未捕获的异步异常"),
	})
})

self.onmessage = (event: MessageEvent<EncoderRequest>) => {
	const message = event.data
	switch (message.type) {
		case "init":
			currentSessionId = message.id
			format = message.format
			width = message.width
			height = message.height
			frameCount = message.frameCount
			frames = []
			if (format === "webp") void getWasmWebpModule()
			else if (format === "gif") void getGifenc()
			else if (format === "apng") void getUpng()
			post({ type: "ready", id: currentSessionId })
			break
		case "abort":
			if (message.id === currentSessionId) {
				frames = []
			}
			break
		case "frame":
			if (message.id === currentSessionId) {
				frames.push({
					index: message.index,
					duration: message.duration,
					buffer: message.buffer,
				})
			}
			break
		case "finish":
			if (message.id !== currentSessionId) return
			finish(message.id).catch((error: unknown) => {
				if (message.id === currentSessionId) {
					post({
						type: "error",
						id: message.id,
						message: error instanceof Error ? error.message : "未知编码错误",
					})
				}
			})
			break
	}
}
