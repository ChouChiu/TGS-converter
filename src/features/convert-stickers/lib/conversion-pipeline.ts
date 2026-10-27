import { LIMITS } from "@/shared/config/limits"
import { createResultArchive } from "@/shared/lib/archive"
import {
	basename,
	FORMAT_META,
	makeUniquePath,
	outputPathFor,
} from "@/shared/lib/files"
import { formatString, type Translations } from "@/shared/lib/i18n"
import { parseTgs } from "@/shared/lib/tgs"
import type {
	ConversionItem,
	ConversionResult,
	ConversionSource,
	JobProgress,
	OutputFormat,
	ProgressPhase,
} from "@/shared/model/types"
import {
	createEncoderClient,
	getRecommendedWorkerCount,
} from "./encoder-client"
import { renderLottieFrames } from "./render-lottie"

export interface BatchArchive {
	name: string
	blob: Blob
	url: string
	size: number
}

export interface PipelineOptions {
	sources: ConversionSource[]
	format: OutputFormat
	signal: AbortSignal
	t: Translations
	onItemStatus: (id: string, patch: Partial<ConversionItem>) => void
	onItemComplete: (result: ConversionResult) => void
	onProgress: (progress: JobProgress) => void
}

export interface PipelineOutput {
	completed: ConversionResult[]
	archive: BatchArchive | null
	failures: { path: string; error: string }[]
	createdUrls: string[]
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : "发生未知错误"
}

function isAbortError(error: unknown): boolean {
	return (
		(error instanceof DOMException && error.name === "AbortError") ||
		(error instanceof Error && error.name === "AbortError")
	)
}

function createProgressReporter(
	totalCount: number,
	onReport: (progress: JobProgress) => void,
) {
	const fractions = new Float64Array(totalCount)
	let totalFraction = 0
	let lastAt = 0
	let lastPercent = -1
	let lastPhase: ProgressPhase | undefined
	let lastFile: string | undefined

	return (
		itemIndex: number,
		fraction: number,
		phase: ProgressPhase,
		message: string,
		currentFile: string,
		force = false,
	) => {
		const clamped = Math.max(0, Math.min(1, fraction))
		totalFraction += clamped - fractions[itemIndex]
		fractions[itemIndex] = clamped

		const percent = Math.min(95, Math.round((totalFraction / totalCount) * 95))
		const now = performance.now()
		if (
			!force &&
			phase === lastPhase &&
			currentFile === lastFile &&
			(percent === lastPercent || now - lastAt < 50)
		) {
			return
		}
		lastAt = now
		lastPercent = percent
		lastPhase = phase
		lastFile = currentFile
		onReport({ phase, percent, message, currentFile })
	}
}

export async function runConversionPipeline(
	options: PipelineOptions,
): Promise<PipelineOutput> {
	const {
		sources,
		format,
		signal,
		t,
		onItemStatus,
		onItemComplete,
		onProgress,
	} = options

	const completedResults: (ConversionResult | undefined)[] = new Array(
		sources.length,
	)
	const failures: { path: string; error: string }[] = []
	const createdUrls: string[] = []
	const usedPaths = new Set<string>()
	let outputBytes = 0
	let outputLimitReached = false

	const poolSize = Math.min(getRecommendedWorkerCount(), sources.length)
	const encoderClient = createEncoderClient(signal, poolSize)
	const reportProgress = createProgressReporter(sources.length, onProgress)
	const encodingTasks: Promise<void>[] = []

	const outputPaths = sources.map((source) =>
		makeUniquePath(outputPathFor(source.path, format), usedPaths),
	)

	try {
		for (let index = 0; index < sources.length; index += 1) {
			const source = sources[index]
			if (signal.aborted) break

			if (outputLimitReached) {
				const message = t.messages.outputLimitReached
				failures.push({ path: source.path, error: message })
				onItemStatus(source.id, { status: "error", error: message })
				reportProgress(index, 1, "encoding", message, source.name, true)
				continue
			}

			try {
				onItemStatus(source.id, { status: "parsing", error: undefined })
				reportProgress(
					index,
					0.03,
					"extracting",
					t.messages.parsingTgs,
					source.name,
				)
				const parsed = await parseTgs(source.bytes)

				const encoder = await encoderClient.acquireSession(
					format,
					parsed.width,
					parsed.height,
					parsed.frameCount,
					(encoderProgress) => {
						reportProgress(
							index,
							0.75 + encoderProgress * 0.24,
							"encoding",
							t.messages.compressing,
							source.name,
						)
					},
				)

				if (signal.aborted) {
					encoder.destroy()
					break
				}

				onItemStatus(source.id, { status: "rendering" })
				let firstFrameThumb: string | undefined
				await renderLottieFrames(
					parsed,
					signal,
					(frameIndex, duration, buffer) =>
						encoder.addFrame(frameIndex, duration, buffer),
					(renderProgress) => {
						reportProgress(
							index,
							0.05 + renderProgress * 0.7,
							"rendering",
							formatString(t.messages.renderingFrame, {
								current: Math.ceil(renderProgress * parsed.frameCount),
								total: parsed.frameCount,
							}),
							source.name,
						)
					},
					(thumbUrl) => {
						firstFrameThumb = thumbUrl
					},
				)

				if (signal.aborted) {
					encoder.destroy()
					break
				}

				onItemStatus(source.id, { status: "encoding" })
				reportProgress(
					index,
					0.75,
					"encoding",
					t.messages.encoding,
					source.name,
					true,
				)

				const outputPath = outputPaths[index]
				const thumbnail = firstFrameThumb
				const task = (async () => {
					try {
						const bytes = await encoder.finish()
						outputBytes += bytes.byteLength
						if (outputBytes > LIMITS.maxOutputBytes) {
							outputLimitReached = true
							throw new Error(t.messages.errOutputTotalOverflow)
						}
						const mimeType = FORMAT_META[format].mimeType
						const blob = new Blob([bytes as unknown as BlobPart], {
							type: mimeType,
						})
						const previewUrl = URL.createObjectURL(blob)
						createdUrls.push(previewUrl)

						const res: ConversionResult = {
							id: source.id,
							inputPath: source.path,
							outputPath,
							name: basename(outputPath),
							format,
							mimeType,
							bytes,
							blob,
							previewUrl,
							thumbnailUrl: thumbnail || previewUrl,
							width: parsed.width,
							height: parsed.height,
							frameRate: parsed.frameRate,
							frameCount: parsed.frameCount,
						}

						completedResults[index] = res
						onItemComplete(res)
						onItemStatus(source.id, { status: "done" })
						reportProgress(
							index,
							1,
							"encoding",
							t.messages.fileCompleted,
							source.name,
						)
					} catch (encodeError) {
						encoder.destroy()
						reportProgress(
							index,
							1,
							"encoding",
							t.messages.convertError,
							source.name,
							true,
						)
						if (isAbortError(encodeError) || signal.aborted) {
							onItemStatus(source.id, {
								status: "cancelled",
								error: t.messages.userCancelled,
							})
						} else {
							const message = errorMessage(encodeError)
							failures.push({ path: source.path, error: message })
							onItemStatus(source.id, { status: "error", error: message })
						}
					}
				})()

				encodingTasks.push(task)
			} catch (prepError) {
				reportProgress(
					index,
					1,
					"extracting",
					t.messages.processError,
					source.name,
					true,
				)
				if (isAbortError(prepError) || signal.aborted) {
					onItemStatus(source.id, {
						status: "cancelled",
						error: t.messages.userCancelled,
					})
					break
				}
				const message = errorMessage(prepError)
				failures.push({ path: source.path, error: message })
				onItemStatus(source.id, { status: "error", error: message })
			}
		}

		await Promise.all(encodingTasks)
	} finally {
		encoderClient.destroy()
	}

	const completed = completedResults.filter(
		(r): r is ConversionResult => r !== undefined,
	)

	let archive: BatchArchive | null = null
	if (!signal.aborted && sources.length > 1 && completed.length > 0) {
		onProgress({
			phase: "packaging",
			percent: 97,
			message: t.messages.generatingZip,
		})
		try {
			const bytes = await createResultArchive(completed, failures)
			const blob = new Blob([bytes as unknown as BlobPart], {
				type: "application/zip",
			})
			const url = URL.createObjectURL(blob)
			createdUrls.push(url)
			archive = {
				name: `converted-${format}.zip`,
				blob,
				url,
				size: bytes.byteLength,
			}
		} catch {
			// ZIP generation failure is non-fatal to individual results
		}
	}

	return { completed, archive, failures, createdUrls }
}
