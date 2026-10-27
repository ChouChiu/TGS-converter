import { FileImage, Film, Loader2, XCircle } from "lucide-react"
import { memo, useMemo, useState } from "react"
import { formatBytes, formatElapsedTime } from "@/shared/lib/files"
import { formatString, useI18n } from "@/shared/lib/i18n"
import { cn } from "@/shared/lib/utils"
import type {
	ConversionResult,
	JobProgress,
	OutputFormat,
} from "@/shared/model/types"
import { ArchiveIcon } from "@/shared/ui/animate-ui/icons/archive"
import { CheckIcon } from "@/shared/ui/animate-ui/icons/check"
import { CheckCheckIcon } from "@/shared/ui/animate-ui/icons/check-check"
import { CopyIcon } from "@/shared/ui/animate-ui/icons/copy"
import { DownloadIcon } from "@/shared/ui/animate-ui/icons/download"
import { PauseIcon } from "@/shared/ui/animate-ui/icons/pause"
import { PlayIcon } from "@/shared/ui/animate-ui/icons/play"
import { SearchIcon } from "@/shared/ui/animate-ui/icons/search"
import { Badge } from "@/shared/ui/badge"
import { Button, buttonVariants } from "@/shared/ui/button"
import { Card, CardContent } from "@/shared/ui/card"
import { Input } from "@/shared/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip"

type BgMode = "dark" | "light" | "black" | "white"

interface ResultsGalleryProps {
	results: ConversionResult[]
	archive: { name: string; blob: Blob; url: string; size: number } | null
	running: boolean
	itemCount: number
	progress: JobProgress
	format: OutputFormat
	elapsedMs: number
}

const BG_CLASSES: Record<BgMode, string> = {
	dark: "preview-grid-dark",
	light: "preview-grid-light",
	black: "preview-grid-black",
	white: "preview-grid-white",
}

interface ResultCardProps {
	result: ConversionResult
	bgClass: string
	playAll: boolean
	copied: boolean
	copyFailed: boolean
	onCopy: (result: ConversionResult) => void
}

const ResultCard = memo(function ResultCard({
	result,
	bgClass,
	playAll,
	copied,
	copyFailed,
	onCopy,
}: ResultCardProps) {
	const { t } = useI18n()
	const [isHovered, setIsHovered] = useState(false)
	const [isManuallyPlaying, setIsManuallyPlaying] = useState(false)

	const isPlaying = playAll || isHovered || isManuallyPlaying
	const imageSrc = isPlaying
		? result.previewUrl
		: result.thumbnailUrl || result.previewUrl

	return (
		<Card
			className="overflow-hidden border-border/60 bg-card/40 transition-colors hover:border-border"
			style={{
				contentVisibility: "auto",
				containIntrinsicSize: "280px 340px",
			}}
		>
			{/* Preview Stage */}
			<button
				type="button"
				className={cn(
					"relative grid aspect-square w-full place-items-center overflow-hidden border-b border-border/60 p-4 cursor-pointer select-none border-t-0 border-x-0 rounded-none bg-transparent text-left",
					bgClass,
				)}
				onMouseEnter={() => setIsHovered(true)}
				onMouseLeave={() => setIsHovered(false)}
				onClick={() => setIsManuallyPlaying((prev) => !prev)}
				title={
					isPlaying
						? t.results.completed.pauseAll
						: t.results.completed.playHint
				}
				aria-label={
					isPlaying
						? t.results.completed.pauseAll
						: t.results.completed.playHint
				}
			>
				<img
					src={imageSrc}
					alt={formatString(t.results.completed.previewAlt, {
						name: result.name,
					})}
					loading="lazy"
					decoding="async"
					className="max-h-full max-w-full object-contain pointer-events-none"
				/>

				<Badge
					variant="secondary"
					className="absolute top-2 right-2 border-border/60 bg-background/80 px-1.5 py-0 font-mono text-[9px] uppercase pointer-events-none"
				>
					{result.format}
				</Badge>

				{/* Play / Pause Status Indicator */}
				<div className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1 rounded bg-background/85 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground backdrop-blur-xs shadow-xs">
					{isPlaying ? (
						<>
							<span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
							<span className="text-emerald-400 font-medium">
								{t.results.completed.playing}
							</span>
						</>
					) : (
						<>
							<PlayIcon size={10} className="fill-current" />
							<span>{t.results.completed.playHint}</span>
						</>
					)}
				</div>
			</button>

			{/* Metadata & Actions */}
			<CardContent className="p-3 space-y-2.5">
				<div>
					<p
						className="truncate text-xs font-medium text-foreground"
						title={result.name}
					>
						{result.name}
					</p>
					<div className="mt-1 flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
						<span>
							{result.width}×{result.height}
						</span>
						<span>·</span>
						<span className="flex items-center gap-0.5">
							<Film className="size-2.5" />
							{formatString(t.results.completed.frames, {
								count: result.frameCount,
							})}
						</span>
						<span>·</span>
						<span>{result.frameRate} FPS</span>
						<span className="ml-auto font-medium">
							{formatBytes(result.bytes.byteLength)}
						</span>
					</div>
				</div>

				<div className="flex items-center gap-1.5">
					<a
						className={buttonVariants({
							variant: "outline",
							size: "sm",
							className:
								"h-8 flex-1 gap-1 text-xs font-normal border-border/80 hover:border-primary/50 hover:text-primary transition-colors",
						})}
						href={result.previewUrl}
						download={result.name}
					>
						<DownloadIcon animateOnHover size={13} />
						{formatString(t.results.completed.btnDownload, {
							name: result.name,
						})}
					</a>

					<Tooltip>
						<TooltipTrigger
							render={
								<Button
									type="button"
									variant="outline"
									size="icon"
									onClick={() => onCopy(result)}
									aria-label={t.results.completed.btnCopy}
									className="size-8 text-muted-foreground hover:text-foreground hover:border-primary/50"
								>
									{copied ? (
										<CheckCheckIcon
											animateOnHover
											size={15}
											className="text-emerald-400"
										/>
									) : copyFailed ? (
										<XCircle className="size-3.5 text-rose-400" />
									) : (
										<CopyIcon animateOnHover size={13} />
									)}
								</Button>
							}
						/>
						<TooltipContent>
							{copied
								? t.results.completed.btnCopied
								: copyFailed
									? t.results.completed.copyFailed
									: t.results.completed.btnCopy}
						</TooltipContent>
					</Tooltip>
				</div>
			</CardContent>
		</Card>
	)
})

export function ResultsGallery({
	results,
	archive,
	running,
	itemCount,
	progress,
	elapsedMs,
}: ResultsGalleryProps) {
	const { t } = useI18n()
	const [bgMode, setBgMode] = useState<BgMode>("dark")
	const [searchQuery, setSearchQuery] = useState("")
	const [copiedId, setCopiedId] = useState<string | null>(null)
	const [copyFailedId, setCopyFailedId] = useState<string | null>(null)
	const [playAll, setPlayAll] = useState(false)

	const hasResults = results.length > 0

	const filteredResults = useMemo(() => {
		if (!searchQuery.trim()) return results
		const query = searchQuery.toLowerCase().trim()
		return results.filter((res) => res.name.toLowerCase().includes(query))
	}, [results, searchQuery])

	const copyImageToClipboard = async (result: ConversionResult) => {
		try {
			if (!navigator.clipboard?.write) {
				setCopyFailedId(result.id)
				setTimeout(() => setCopyFailedId(null), 2000)
				return
			}
			let pngBlob: Blob
			if (result.mimeType === "image/png") {
				pngBlob = result.blob
			} else {
				const img = new Image()
				img.src = result.thumbnailUrl || result.previewUrl
				await img.decode()
				const canvas = document.createElement("canvas")
				canvas.width = img.naturalWidth || img.width
				canvas.height = img.naturalHeight || img.height
				const ctx = canvas.getContext("2d")
				if (!ctx) {
					setCopyFailedId(result.id)
					setTimeout(() => setCopyFailedId(null), 2000)
					return
				}
				ctx.drawImage(img, 0, 0)
				pngBlob = await new Promise<Blob>((resolve, reject) => {
					canvas.toBlob((b) => {
						if (b) resolve(b)
						else reject(new Error("Canvas toBlob failed"))
					}, "image/png")
				})
			}
			await navigator.clipboard.write([
				new ClipboardItem({ "image/png": pngBlob }),
			])
			setCopiedId(result.id)
			setTimeout(() => setCopiedId(null), 1800)
		} catch {
			setCopyFailedId(result.id)
			setTimeout(() => setCopyFailedId(null), 2000)
		}
	}

	const emptyTitle = running
		? t.results.empty.runningTitle
		: itemCount > 0
			? formatString(t.results.empty.readyTitle, { count: itemCount })
			: t.results.empty.idleTitle
	const emptyDescription = running
		? (progress.currentFile ?? progress.message)
		: itemCount > 0
			? t.results.empty.readyDesc
			: t.results.empty.idleDesc

	const bgLabels: Record<BgMode, string> = {
		dark: t.results.bgModes.dark,
		light: t.results.bgModes.light,
		black: t.results.bgModes.black,
		white: t.results.bgModes.white,
	}

	return (
		<section
			id="conversion-results"
			className="flex min-h-[500px] flex-col p-5 lg:min-h-full lg:p-6"
			aria-labelledby="results-heading"
		>
			{/* Top Bar */}
			<div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
				<div className="flex items-center gap-2">
					<h2
						id="results-heading"
						className="text-sm font-semibold tracking-tight text-foreground"
					>
						{t.results.title}
					</h2>
					<Badge
						variant="outline"
						className="h-5 px-1.5 font-mono text-[10px] text-muted-foreground"
					>
						{formatString(t.results.countBadge, {
							count: results.length,
						})}
					</Badge>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					{hasResults && (
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-7 gap-1 px-2 text-[10px] border-border/80 hover:border-primary/40"
							onClick={() => setPlayAll((prev) => !prev)}
							title={
								playAll
									? t.results.completed.pauseAll
									: t.results.completed.playAll
							}
						>
							{playAll ? (
								<>
									<PauseIcon
										animateOnHover
										size={12}
										className="text-amber-400"
									/>
									<span>{t.results.completed.pauseAll}</span>
								</>
							) : (
								<>
									<PlayIcon
										animateOnHover
										size={12}
										className="text-emerald-400"
									/>
									<span>{t.results.completed.playAll}</span>
								</>
							)}
						</Button>
					)}

					<Tabs
						value={bgMode}
						onValueChange={(val) => setBgMode(val as BgMode)}
					>
						<TabsList className="h-7 border border-border/60 p-0.5">
							{(["dark", "light", "black", "white"] as const).map((mode) => (
								<TabsTrigger
									key={mode}
									value={mode}
									className="h-6 px-2 text-[10px]"
								>
									{bgLabels[mode]}
								</TabsTrigger>
							))}
						</TabsList>
					</Tabs>

					{results.length > 3 && (
						<div className="relative">
							<SearchIcon
								animateOnHover
								size={12}
								className="absolute top-2 left-2 text-muted-foreground"
							/>
							<Input
								type="text"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								placeholder={t.results.completed.searchPlaceholder}
								className="h-7 w-36 pr-2 pl-7 text-xs border-border/80 focus-visible:ring-primary/40"
							/>
						</div>
					)}
				</div>
			</div>

			{/* Empty / In-Progress State */}
			{!hasResults ? (
				<div className="flex flex-1 flex-col items-center justify-center py-20 text-center">
					<div className="output-placeholder-grid relative mb-4 grid size-36 place-items-center rounded-2xl border border-dashed border-border/80 bg-card/20 sm:size-44 transition-all duration-300 hover:border-primary/50 shadow-xs">
						{running ? (
							<div className="flex flex-col items-center gap-1.5">
								<Loader2 className="size-8 animate-spin text-primary" />
								<span className="font-mono text-xs font-semibold text-primary tabular-nums">
									{progress.percent}%
								</span>
							</div>
						) : (
							<FileImage className="size-8 stroke-[1.2] text-muted-foreground/80" />
						)}
						<span className="absolute top-2 left-2.5 font-mono text-[9px] text-muted-foreground/60">
							512 × 512
						</span>
						<span className="absolute right-2.5 bottom-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/60">
							Canvas
						</span>
					</div>

					<p className="text-sm font-semibold text-foreground">{emptyTitle}</p>
					<p className="mt-1 max-w-xs text-xs text-muted-foreground">
						{emptyDescription}
					</p>

					{running && (
						<div className="mt-4 w-44 overflow-hidden rounded-full bg-secondary p-0.5">
							<div
								className="h-1.5 rounded-full bg-gradient-to-r from-[#2AABEE] to-[#229ED9] transition-all duration-200"
								style={{ width: `${progress.percent}%` }}
							/>
						</div>
					)}
				</div>
			) : (
				/* Results Content */
				<div className="pt-4 space-y-4">
					{/* Prominent Batch Download & Summary Action Banner */}
					<div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card/60 p-3.5 shadow-sm sm:flex-row sm:items-center sm:justify-between backdrop-blur-xs">
						<div className="space-y-0.5">
							<div className="flex items-center gap-2">
								<div className="flex size-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
									<CheckIcon animateOnHover size={14} />
								</div>
								<h3 className="text-sm font-semibold text-foreground">
									{t.results.completed.heading}
								</h3>
							</div>
							<p className="text-xs text-muted-foreground">
								{formatString(t.results.completed.summary, {
									count: results.length,
									time: formatElapsedTime(elapsedMs),
								})}
							</p>
						</div>

						{archive ? (
							<a
								className={buttonVariants({
									variant: "telegram",
									size: "default",
									className:
										"h-9 gap-2 px-4 text-xs font-semibold shadow-md shadow-sky-500/20 shrink-0",
								})}
								href={archive.url}
								download={archive.name}
							>
								<ArchiveIcon animateOnHover size={15} />
								{formatString(t.results.completed.btnDownloadAll, {
									size: formatBytes(archive.size),
								})}
							</a>
						) : (
							running &&
							itemCount > 1 && (
								<div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
									<Loader2 className="size-3.5 animate-spin text-primary" />
									<span>{t.results.completed.preparingArchive}</span>
								</div>
							)
						)}
					</div>

					{/* Results Grid with Native Lazy Rendering */}
					{filteredResults.length === 0 ? (
						<div className="rounded-xl border border-dashed border-border/70 p-8 text-center text-xs text-muted-foreground">
							{t.results.completed.noMatch}
						</div>
					) : (
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
							{filteredResults.map((result) => (
								<ResultCard
									key={result.id}
									result={result}
									bgClass={BG_CLASSES[bgMode]}
									playAll={playAll}
									copied={copiedId === result.id}
									copyFailed={copyFailedId === result.id}
									onCopy={copyImageToClipboard}
								/>
							))}
						</div>
					)}
				</div>
			)}
		</section>
	)
}
