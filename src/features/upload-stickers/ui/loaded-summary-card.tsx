import { formatBytes } from "@/shared/lib/files"
import { formatString } from "@/shared/lib/i18n"
import { ArchiveIcon } from "@/shared/ui/animate-ui/icons/archive"
import { CheckIcon } from "@/shared/ui/animate-ui/icons/check"
import { RefreshCwIcon } from "@/shared/ui/animate-ui/icons/refresh-cw"
import { Button } from "@/shared/ui/button"
import { Card, CardContent } from "@/shared/ui/card"

interface LoadedSummaryCardProps {
	count: number
	totalBytes: number
	disabled: boolean
	buttonText: string
	onAction: () => void
	loadedCountLabel: string
	totalSizeLabel: string
}

export function LoadedSummaryCard({
	count,
	totalBytes,
	disabled,
	buttonText,
	onAction,
	loadedCountLabel,
	totalSizeLabel,
}: LoadedSummaryCardProps) {
	if (count <= 0) return null

	return (
		<Card className="border-border/80 bg-card/60 shadow-xs backdrop-blur-xs">
			<CardContent className="flex items-center justify-between gap-3 p-3 text-xs">
				<div className="flex min-w-0 items-center gap-2.5">
					<div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
						{count > 1 ? (
							<ArchiveIcon animateOnHover size={16} />
						) : (
							<CheckIcon animateOnHover size={16} />
						)}
					</div>
					<div className="min-w-0">
						<p className="truncate font-medium text-foreground">
							{formatString(loadedCountLabel, { count })}
						</p>
						<p className="font-mono text-[11px] text-muted-foreground">
							{formatString(totalSizeLabel, {
								size: formatBytes(totalBytes),
							})}
						</p>
					</div>
				</div>
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={disabled}
					onClick={onAction}
					className="h-7 text-xs gap-1 border-border/80 hover:border-primary/40"
				>
					<RefreshCwIcon animateOnHover size={12} />
					{buttonText}
				</Button>
			</CardContent>
		</Card>
	)
}
