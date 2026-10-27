declare module "gifenc" {
	type Palette = number[][]
	type QuantizeOptions = {
		format?: "rgb565" | "rgb444" | "rgba4444"
		oneBitAlpha?: boolean | number
		clearAlpha?: boolean
		clearAlphaThreshold?: number
		clearAlphaColor?: number
	}
	type FrameOptions = {
		palette?: Palette
		transparent?: boolean
		transparentIndex?: number
		delay?: number
		repeat?: number
		dispose?: number
	}
	type Encoder = {
		writeFrame(
			index: Uint8Array,
			width: number,
			height: number,
			options?: FrameOptions,
		): void
		finish(): void
		bytes(): Uint8Array
	}
	export function GIFEncoder(options?: {
		auto?: boolean
		initialCapacity?: number
	}): Encoder
	export function quantize(
		rgba: Uint8Array | Uint8ClampedArray,
		maxColors: number,
		options?: QuantizeOptions,
	): Palette
	export function applyPalette(
		rgba: Uint8Array | Uint8ClampedArray,
		palette: Palette,
		format?: "rgb565" | "rgb444" | "rgba4444",
	): Uint8Array
}
