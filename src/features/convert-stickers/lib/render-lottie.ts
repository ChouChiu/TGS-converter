import type { AnimationItem } from "lottie-web"
import type { ParsedTgs } from "@/shared/model/types"

function frameDuration(index: number, frameRate: number): number {
	const start = Math.round((index * 1000) / frameRate)
	const end = Math.round(((index + 1) * 1000) / frameRate)
	return Math.max(1, end - start)
}

const MAIN_THREAD_TIME_SLICE_MS = 12

let lottiePromise: Promise<typeof import("lottie-web")> | null = null
function getLottie() {
	if (!lottiePromise) {
		lottiePromise = import("lottie-web")
	}
	return lottiePromise
}

function yieldToMainThread(): Promise<void> {
	const scheduler = (
		globalThis as typeof globalThis & {
			scheduler?: { yield?: () => Promise<void> }
		}
	).scheduler
	if (scheduler?.yield) return scheduler.yield()
	return new Promise((resolve) => setTimeout(resolve, 0))
}

function waitUntilReady(
	animation: AnimationItem,
	signal: AbortSignal,
): Promise<void> {
	if (signal.aborted) {
		return Promise.reject(new DOMException("转换已取消", "AbortError"))
	}
	if ((animation as { isLoaded?: boolean }).isLoaded) {
		return Promise.resolve()
	}
	return new Promise((resolve, reject) => {
		const cleanup = () => {
			clearTimeout(timeoutId)
			animation.removeEventListener("DOMLoaded", onReady)
			animation.removeEventListener("data_failed", onFailure)
			signal.removeEventListener("abort", onAbort)
		}
		const onReady = () => {
			cleanup()
			resolve()
		}
		const onFailure = () => {
			cleanup()
			reject(new Error("Lottie 渲染器无法加载此动画"))
		}
		const onAbort = () => {
			cleanup()
			reject(new DOMException("转换已取消", "AbortError"))
		}
		const timeoutId = setTimeout(() => {
			cleanup()
			reject(new Error("Lottie 动画加载超时"))
		}, 15_000)

		animation.addEventListener("DOMLoaded", onReady)
		animation.addEventListener("data_failed", onFailure)
		signal.addEventListener("abort", onAbort, { once: true })
	})
}

export async function renderLottieFrames(
	parsed: ParsedTgs,
	signal: AbortSignal,
	onFrame: (index: number, duration: number, buffer: ArrayBuffer) => void,
	onProgress: (progress: number) => void,
	onFirstFrame?: (thumbnailUrl: string) => void,
): Promise<void> {
	const { default: lottie } = await getLottie()
	const container = document.createElement("div")
	container.setAttribute("aria-hidden", "true")
	Object.assign(container.style, {
		position: "fixed",
		left: "-10000px",
		top: "0",
		width: `${parsed.width}px`,
		height: `${parsed.height}px`,
		pointerEvents: "none",
	})
	document.body.append(container)

	const animation = lottie.loadAnimation({
		container,
		renderer: "canvas",
		loop: false,
		autoplay: false,
		animationData: parsed.animationData,
		rendererSettings: {
			clearCanvas: true,
			dpr: 1,
			progressiveLoad: false,
			preserveAspectRatio: "xMidYMid meet",
		},
	})

	try {
		await waitUntilReady(animation, signal)
		const canvas = container.querySelector("canvas")
		const context = canvas?.getContext("2d", { willReadFrequently: true })
		if (!canvas || !context) throw new Error("浏览器无法创建动画 Canvas")

		let timeSliceStartedAt = performance.now()

		for (let index = 0; index < parsed.frameCount; index += 1) {
			if (signal.aborted) throw new DOMException("转换已取消", "AbortError")
			animation.goToAndStop(index, true)

			const image = context.getImageData(0, 0, parsed.width, parsed.height)

			if (onFirstFrame && index === 0) {
				try {
					const thumb = canvas.toDataURL("image/webp", 0.8)
					onFirstFrame(thumb)
				} catch {
					// ignore thumbnail generation failure
				}
			}

			const buffer = image.data.buffer as ArrayBuffer
			onFrame(index, frameDuration(index, parsed.frameRate), buffer)
			onProgress((index + 1) / parsed.frameCount)

			if (
				index + 1 < parsed.frameCount &&
				performance.now() - timeSliceStartedAt >= MAIN_THREAD_TIME_SLICE_MS
			) {
				await yieldToMainThread()
				timeSliceStartedAt = performance.now()
			}
		}
	} finally {
		animation.destroy()
		container.remove()
	}
}
