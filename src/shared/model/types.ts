export type OutputFormat = "gif" | "apng" | "webp"

export type ConversionStatus =
	| "queued"
	| "parsing"
	| "rendering"
	| "encoding"
	| "done"
	| "error"
	| "cancelled"

export type ProgressPhase =
	| "idle"
	| "extracting"
	| "rendering"
	| "encoding"
	| "packaging"
	| "complete"
	| "cancelled"

export interface ConversionSource {
	id: string
	name: string
	path: string
	bytes: Uint8Array
}

export interface ConversionItem {
	id: string
	name: string
	path: string
	status: ConversionStatus
	error?: string
}

export interface LottieDocument {
	w: number
	h: number
	fr: number
	ip: number
	op: number
	layers: unknown[]
	[key: string]: unknown
}

export interface ParsedTgs {
	animationData: LottieDocument
	width: number
	height: number
	frameRate: number
	frameCount: number
}

export interface ConversionResult {
	id: string
	inputPath: string
	outputPath: string
	name: string
	format: OutputFormat
	mimeType: string
	bytes: Uint8Array
	blob: Blob
	previewUrl: string
	thumbnailUrl?: string
	width: number
	height: number
	frameRate: number
	frameCount: number
}

export interface JobProgress {
	phase: ProgressPhase
	percent: number
	currentFile?: string
	message: string
}

export interface EncoderInitMessage {
	type: "init"
	id: number
	format: OutputFormat
	width: number
	height: number
	frameCount: number
}

export interface EncoderFrameMessage {
	type: "frame"
	id: number
	index: number
	duration: number
	buffer: ArrayBuffer
}

export interface EncoderFinishMessage {
	type: "finish"
	id: number
}

export interface EncoderAbortMessage {
	type: "abort"
	id: number
}

export type EncoderRequest =
	| EncoderInitMessage
	| EncoderFrameMessage
	| EncoderFinishMessage
	| EncoderAbortMessage

export type EncoderResponse =
	| { type: "ready"; id: number }
	| { type: "progress"; id: number; progress: number }
	| { type: "result"; id: number; buffer: ArrayBuffer }
	| { type: "error"; id: number; message: string }
