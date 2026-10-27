import { gunzipSync } from "fflate"
import { LIMITS } from "@/shared/config/limits"
import type { LottieDocument, ParsedTgs } from "@/shared/model/types"

function isGzipBytes(bytes: Uint8Array): boolean {
	return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b
}

export async function decompressTgs(bytes: Uint8Array): Promise<Uint8Array> {
	if (!isGzipBytes(bytes)) {
		throw new Error("不是有效的 TGS gzip 文件")
	}
	let inflated: Uint8Array
	try {
		inflated = gunzipSync(bytes)
	} catch {
		throw new Error("TGS gzip 数据损坏或无法解压")
	}
	if (inflated.byteLength > LIMITS.maxInflatedJsonBytes) {
		throw new Error("解压后的 Lottie JSON 超过 64MiB")
	}
	return inflated
}

export async function parseTgs(bytes: Uint8Array): Promise<ParsedTgs> {
	if (bytes.byteLength > LIMITS.maxTgsBytes) {
		throw new Error("TGS 文件超过 10MiB")
	}

	const isGzip = isGzipBytes(bytes)
	const jsonBytes = isGzip ? await decompressTgs(bytes) : bytes

	let document: unknown
	try {
		const text = new TextDecoder("utf-8", { fatal: true }).decode(jsonBytes)
		document = JSON.parse(text)
	} catch {
		throw new Error(
			isGzip
				? "TGS 内的 Lottie JSON 无效"
				: "不是有效的 gzip TGS 或 Lottie JSON",
		)
	}

	if (!document || typeof document !== "object" || Array.isArray(document)) {
		throw new Error("Lottie JSON 根节点无效")
	}

	const anim = document as Partial<LottieDocument>
	if (
		!Number.isFinite(anim.w) ||
		!Number.isFinite(anim.h) ||
		!Number.isFinite(anim.fr) ||
		!Number.isFinite(anim.ip) ||
		!Number.isFinite(anim.op) ||
		!Array.isArray(anim.layers)
	) {
		throw new Error("Lottie JSON 缺少画布、帧率或图层信息")
	}

	const width = Math.round(anim.w as number)
	const height = Math.round(anim.h as number)
	const frameRate = anim.fr as number
	const frameCount = Math.ceil((anim.op as number) - (anim.ip as number))

	if (
		width <= 0 ||
		height <= 0 ||
		width > LIMITS.maxDimension ||
		height > LIMITS.maxDimension
	) {
		throw new Error("动画画布尺寸无效或单边超过 2048px")
	}
	if (frameRate < 1 || frameRate > LIMITS.maxFrameRate) {
		throw new Error("动画帧率必须在 1–120 FPS 之间")
	}
	if (frameCount < 1 || frameCount > LIMITS.maxFrames) {
		throw new Error("动画帧数无效或超过 600 帧")
	}
	const frameBytes = width * height * frameCount * 4
	if (frameBytes > LIMITS.maxFrameBufferBytes) {
		throw new Error("动画原始帧缓冲超过 256MiB")
	}

	return {
		animationData: anim as LottieDocument,
		width,
		height,
		frameRate,
		frameCount,
	}
}
