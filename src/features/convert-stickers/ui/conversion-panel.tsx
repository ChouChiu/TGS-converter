import {
	AlertCircle,
	CircleStop,
	Cpu,
	FileSearch,
	Loader2,
	Palette,
} from "lucide-react"
import { formatElapsedTime } from "@/shared/lib/files"
import { formatString, useI18n } from "@/shared/lib/i18n"
import { cn } from "@/shared/lib/utils"
import type {
	ConversionItem,
	ConversionResult,
	JobProgress,
	OutputFormat,
} from "@/shared/model/types"
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert"
import { CheckIcon } from "@/shared/ui/animate-ui/icons/check"
import { ClockIcon } from "@/shared/ui/animate-ui/icons/clock"
import { PlayIcon } from "@/shared/ui/animate-ui/icons/play"
import { RotateCcwIcon } from "@/shared/ui/animate-ui/icons/rotate-ccw"
import { Badge } from "@/shared/ui/badge"
import { Button } from "@/shared/ui/button"
import { Card, CardContent } from "@/shared/ui/card"
import { Progress } from "@/shared/ui/progress"
import { ScrollArea } from "@/shared/ui/scroll-area"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip"

const STATUS_CLASS_MAP: Record<ConversionItem["status"], string> = {
	queued: "text-muted-foreground border-border",
	parsing: "text-sky-400 border-sky-500/30",
	rendering: "text-indigo-400 border-indigo-500/30",
	encoding: "text-violet-400 border-violet-500/30",
	done: "text-emerald-400 border-emerald-500/30",
	error: "text-rose-400 border-rose-500/30",
	cancelled: "text-muted-foreground border-border",
}

const AVAILABLE_FORMATS: OutputFormat[] = ["webp", "gif", "apng"]

interface ConversionPanelProps {
	format: OutputFormat
	onFormatChange: (format: OutputFormat) => void
	items: ConversionItem[]
	progress: JobProgress
	running: boolean
	loadingInput: boolean
	elapsedMs: number
	concurrency?: number
	error: string | null
	results: ConversionResult[]
	onStart: () => void
	onCancel: () => void
	onReset: () => void
}

export function ConversionPanel(props: ConversionPanelProps) {
	const { t } = useI18n()
	const canStart =
		props.items.length > 0 && !props.running && !props.loadingInput
	const isComplete =
		props.progress.phase === "complete" && props.results.length > 0

	const currentPhaseIcon = () => {
		if (isComplete)
			return <CheckIcon animateOnHover size={14} className="text-emerald-400" />
		if (props.progress.phase === "extracting")
			return <FileSearch className="size-3.5 text-sky-400 animate-pulse" />
		if (props.progress.phase === "rendering")
			return <Palette className="size-3.5 text-indigo-400 animate-pulse" />
		if (props.progress.phase === "encoding")
			return <Cpu className="size-3.5 text-violet-400 animate-pulse" />
		if (props.running)
			return <Loader2 className="size-3.5 text-primary animate-spin" />
		return null
	}

	return (
		<div className="space-y-4">
			{/* Format & Start Controls */}
			<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
				<div className="flex-1">
					<label htmlFor="output-format" className="sr-only">
						{t.conversion.formatLabel}
					</label>
					<Select
						value={props.format}
						onValueChange={(value) =>
							props.onFormatChange(value as OutputFormat)
						}
						disabled={props.running}
					>
						<SelectTrigger
							id="output-format"
							aria-label={t.conversion.formatLabel}
							className="h-10 w-full border-border/80 bg-background/50 px-3 text-xs text-foreground focus-visible:ring-primary/40"
						>
							<SelectValue>
								{t.conversion.formats[props.format].label}
							</SelectValue>
						</SelectTrigger>
						<SelectContent className="border-border bg-popover">
							{AVAILABLE_FORMATS.map((fmt) => (
								<SelectItem key={fmt} value={fmt} className="text-xs">
									<span className="font-semibold text-foreground">
										{t.conversion.formats[fmt].label}
									</span>
									<span className="ml-2 text-muted-foreground">
										· {t.conversion.formats[fmt].desc}
									</span>
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="flex items-center gap-2">
					{props.running ? (
						<Button
							type="button"
							variant="destructive"
							className="h-10 flex-1 sm:flex-none sm:min-w-32 text-xs font-medium"
							onClick={props.onCancel}
						>
							<CircleStop className="mr-1.5 size-4" />
							{t.conversion.actions.cancel}
						</Button>
					) : (
						<Button
							type="button"
							variant={canStart ? "telegram" : "default"}
							disabled={!canStart}
							onClick={props.onStart}
							className="h-10 flex-1 sm:flex-none sm:min-w-36 text-xs font-semibold"
						>
							{props.loadingInput ? (
								<Loader2 className="mr-1.5 size-4 animate-spin" />
							) : (
								<PlayIcon animateOnHover size={14} className="mr-1.5" />
							)}
							{t.conversion.actions.start}
						</Button>
					)}

					<Tooltip>
						<TooltipTrigger
							render={
								<Button
									type="button"
									variant="outline"
									disabled={props.running}
									onClick={props.onReset}
									aria-label={t.conversion.actions.resetAria}
									className="size-10 shrink-0 text-muted-foreground hover:text-foreground hover:border-primary/40"
								>
									<RotateCcwIcon animateOnHover size={15} />
								</Button>
							}
						/>
						<TooltipContent>{t.conversion.actions.resetTooltip}</TooltipContent>
					</Tooltip>
				</div>
			</div>

			{/* Error Alert */}
			{props.error && (
				<Alert variant="destructive" className="p-3 text-xs">
					<AlertCircle className="size-4" />
					<div className="ml-2">
						<AlertTitle className="text-xs font-semibold">
							{t.conversion.errorTitle}
						</AlertTitle>
						<AlertDescription className="text-xs">
							{props.error}
						</AlertDescription>
					</div>
				</Alert>
			)}

			{/* Progress Indicator */}
			{(props.running || isComplete) && (
				<Card className="border-border/80 bg-card/60 shadow-xs backdrop-blur-xs">
					<CardContent className="space-y-2 p-3">
						<div className="flex items-center justify-between gap-3 text-xs">
							<div className="flex min-w-0 items-center gap-2">
								{currentPhaseIcon()}
								<span className="truncate text-foreground font-medium">
									{isComplete
										? t.conversion.phases.complete
										: (props.progress.currentFile ?? props.progress.message)}
								</span>
							</div>
							<div className="flex shrink-0 items-center gap-2 font-mono text-[11px] text-muted-foreground">
								<span className="flex items-center gap-1">
									<ClockIcon animateOnHover size={12} />
									{formatElapsedTime(props.elapsedMs)}
								</span>
								<span className="font-semibold text-primary inline-flex items-center tabular-nums">
									{props.progress.percent}%
								</span>
							</div>
						</div>
						<Progress value={props.progress.percent} className="h-1.5" />
					</CardContent>
				</Card>
			)}

			{/* Queue List */}
			{props.items.length > 0 && (
				<Card className="overflow-hidden border-border/60 bg-card/30">
					<div className="flex items-center justify-between border-b border-border/50 px-3 py-1.5 text-xs">
						<span className="text-muted-foreground font-medium">
							{t.conversion.queue.title} (
							{formatString(t.conversion.queue.count, {
								count: props.items.length,
							})}
							)
						</span>
						<div className="flex items-center gap-2">
							{props.concurrency && props.concurrency > 1 && (
								<Badge
									variant="outline"
									className="h-4 px-1 text-[9px] font-mono text-muted-foreground border-border/60"
									title={formatString(t.conversion.queue.threadsTooltip, {
										count: props.concurrency,
									})}
								>
									<Cpu className="mr-0.5 size-2.5 text-violet-400" />
									{formatString(t.conversion.queue.threads, {
										count: props.concurrency,
									})}
								</Badge>
							)}
							<span className="font-mono text-[10px] text-muted-foreground">
								{props.items.filter((item) => item.status === "done").length}/
								{props.items.length}
							</span>
						</div>
					</div>
					<ScrollArea className="max-h-48">
						<ul
							className="divide-y divide-border/40"
							aria-label={t.conversion.queue.listAriaLabel}
						>
							{props.items.map((item, index) => {
								const statusLabel =
									t.conversion.status[item.status] ?? item.status
								const statusClass =
									STATUS_CLASS_MAP[item.status] ?? STATUS_CLASS_MAP.queued
								return (
									<li
										key={item.id}
										className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs"
									>
										<div className="flex min-w-0 items-center gap-2">
											<span className="w-5 font-mono text-[10px] text-muted-foreground">
												{index + 1}
											</span>
											<span className="truncate text-foreground">
												{item.name}
											</span>
										</div>
										<Badge
											variant="outline"
											className={cn("h-4 px-1 text-[9px]", statusClass)}
										>
											{statusLabel}
										</Badge>
									</li>
								)
							})}
						</ul>
					</ScrollArea>
				</Card>
			)}
		</div>
	)
}
