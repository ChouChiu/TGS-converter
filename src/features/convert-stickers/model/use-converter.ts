import { useCallback, useEffect, useRef, useState } from "react"
import { formatString, useI18n } from "@/shared/lib/i18n"
import type {
	ConversionItem,
	ConversionResult,
	ConversionSource,
	JobProgress,
	OutputFormat,
} from "@/shared/model/types"
import {
	type BatchArchive,
	runConversionPipeline,
} from "../lib/conversion-pipeline"
import { getRecommendedWorkerCount } from "../lib/encoder-client"

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : "发生未知错误"
}

function isAbortError(error: unknown): boolean {
	return (
		(error instanceof DOMException && error.name === "AbortError") ||
		(error instanceof Error && error.name === "AbortError")
	)
}

export function useConverter() {
	const { t } = useI18n()
	const [sources, setSources] = useState<ConversionSource[]>([])
	const [items, setItems] = useState<ConversionItem[]>([])
	const [format, setFormat] = useState<OutputFormat>("webp")
	const [results, setResults] = useState<ConversionResult[]>([])
	const [archive, setArchive] = useState<BatchArchive | null>(null)
	const [progress, setProgress] = useState<JobProgress>(() => ({
		phase: "idle",
		percent: 0,
		message: t.messages.waitingForFile,
	}))
	const [error, setError] = useState<string | null>(null)
	const [running, setRunning] = useState(false)
	const [loadingInput, setLoadingInput] = useState(false)
	const [elapsedMs, setElapsedMs] = useState(0)

	const abortRef = useRef<AbortController | null>(null)
	const resultUrlsRef = useRef<string[]>([])
	const conversionStartedAtRef = useRef<number | null>(null)

	const concurrency = Math.min(
		getRecommendedWorkerCount(),
		Math.max(1, sources.length),
	)

	const revokeResults = useCallback(() => {
		for (const url of resultUrlsRef.current) URL.revokeObjectURL(url)
		resultUrlsRef.current = []
	}, [])

	const clearOutputs = useCallback(() => {
		revokeResults()
		setResults([])
		setArchive(null)
	}, [revokeResults])

	const cancel = useCallback(() => {
		abortRef.current?.abort()
	}, [])

	const reset = useCallback(() => {
		cancel()
		clearOutputs()
		setSources([])
		setItems([])
		setError(null)
		setRunning(false)
		conversionStartedAtRef.current = null
		setElapsedMs(0)
		setProgress({
			phase: "idle",
			percent: 0,
			message: t.messages.waitingForFile,
		})
	}, [cancel, clearOutputs, t.messages.waitingForFile])

	const setupSources = useCallback(
		(nextSources: ConversionSource[]) => {
			setSources(nextSources)
			setItems(
				nextSources.map((source) => ({
					id: source.id,
					name: source.name,
					path: source.path,
					status: "queued",
				})),
			)
			setProgress({
				phase: "idle",
				percent: 0,
				message: formatString(t.messages.preparedCount, {
					count: nextSources.length,
				}),
			})
		},
		[t.messages.preparedCount],
	)

	const loadSources = useCallback(
		async (
			loader: (
				signal: AbortSignal,
				onProgress: (message: string, fraction: number) => void,
			) => Promise<ConversionSource[]>,
			initialMessage?: string,
		) => {
			cancel()
			clearOutputs()
			conversionStartedAtRef.current = null
			setElapsedMs(0)
			setLoadingInput(true)
			setError(null)

			const controller = new AbortController()
			abortRef.current = controller

			setProgress({
				phase: "extracting",
				percent: 5,
				message: initialMessage ?? t.messages.readingFile,
			})

			try {
				const nextSources = await loader(
					controller.signal,
					(message, fraction) => {
						setProgress({
							phase: "extracting",
							percent: Math.round(fraction * 100),
							message,
						})
					},
				)
				setupSources(nextSources)
			} catch (err) {
				if (!isAbortError(err)) {
					setSources([])
					setItems([])
					setError(errorMessage(err))
					setProgress({
						phase: "idle",
						percent: 0,
						message: t.messages.waitingForFile,
					})
				}
			} finally {
				setLoadingInput(false)
				if (abortRef.current === controller) {
					abortRef.current = null
				}
			}
		},
		[
			cancel,
			clearOutputs,
			setupSources,
			t.messages.readingFile,
			t.messages.waitingForFile,
		],
	)

	useEffect(() => {
		if (!running || conversionStartedAtRef.current === null) return
		const updateElapsed = () => {
			if (conversionStartedAtRef.current !== null) {
				setElapsedMs(Date.now() - conversionStartedAtRef.current)
			}
		}
		updateElapsed()
		const interval = window.setInterval(updateElapsed, 100)
		return () => window.clearInterval(interval)
	}, [running])

	useEffect(
		() => () => {
			abortRef.current?.abort()
			revokeResults()
		},
		[revokeResults],
	)

	const updateItem = useCallback(
		(id: string, patch: Partial<ConversionItem>) => {
			setItems((current) =>
				current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
			)
		},
		[],
	)

	const start = useCallback(async () => {
		if (sources.length === 0 || running) return
		const conversionStartedAt = Date.now()
		conversionStartedAtRef.current = conversionStartedAt
		setElapsedMs(0)
		clearOutputs()
		setError(null)
		setRunning(true)
		setItems((current) =>
			current.map((item) => ({ ...item, status: "queued", error: undefined })),
		)

		const controller = new AbortController()
		abortRef.current = controller

		const {
			completed,
			archive: batchArchive,
			createdUrls,
		} = await runConversionPipeline({
			sources,
			format,
			signal: controller.signal,
			t,
			onItemStatus: updateItem,
			onItemComplete: (result) => {
				setResults((prev) => [...prev, result])
			},
			onProgress: setProgress,
		})

		for (const url of createdUrls) {
			resultUrlsRef.current.push(url)
		}

		if (batchArchive) {
			setArchive(batchArchive)
		}

		if (controller.signal.aborted) {
			setItems((current) =>
				current.map((item) =>
					item.status === "done" || item.status === "error"
						? item
						: { ...item, status: "cancelled", error: t.messages.userCancelled },
				),
			)
			setProgress({
				phase: "cancelled",
				percent: 0,
				message: t.messages.cancelled,
			})
		} else {
			setProgress({
				phase: "complete",
				percent: 100,
				message: formatString(t.messages.completedCount, {
					completed: completed.length,
					total: sources.length,
				}),
			})
		}

		setElapsedMs(Date.now() - conversionStartedAt)
		conversionStartedAtRef.current = null
		setRunning(false)
		abortRef.current = null
	}, [clearOutputs, format, running, sources, t, updateItem])

	return {
		sources,
		items,
		format,
		setFormat,
		results,
		archive,
		progress,
		error,
		running,
		loadingInput,
		elapsedMs,
		concurrency,
		loadSources,
		setupSources,
		start,
		cancel,
		reset,
	}
}
