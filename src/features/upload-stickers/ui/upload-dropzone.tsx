import { useEffect, useRef, useState } from "react"
import { useI18n } from "@/shared/lib/i18n"
import { cn } from "@/shared/lib/utils"
import type { ConversionSource } from "@/shared/model/types"
import { UploadIcon } from "@/shared/ui/animate-ui/icons/upload"
import { LoadedSummaryCard } from "./loaded-summary-card"

interface UploadDropzoneProps {
	sources: ConversionSource[]
	disabled: boolean
	onFiles: (files: File[]) => void
}

export function UploadDropzone({
	sources,
	disabled,
	onFiles,
}: UploadDropzoneProps) {
	const { t } = useI18n()
	const inputRef = useRef<HTMLInputElement>(null)
	const [dragging, setDragging] = useState(false)
	const totalBytes = sources.reduce(
		(total, source) => total + source.bytes.byteLength,
		0,
	)

	const chooseFiles = (fileList: FileList | null) => {
		if (!fileList || fileList.length === 0) return
		onFiles(Array.from(fileList))
	}

	useEffect(() => {
		const handlePaste = (event: ClipboardEvent) => {
			if (disabled) return
			const target = event.target as HTMLElement | null
			if (
				target &&
				(target.tagName === "INPUT" || target.tagName === "TEXTAREA")
			) {
				return
			}
			const items = event.clipboardData?.items
			if (!items) return
			const pastedFiles: File[] = []
			for (let i = 0; i < items.length; i += 1) {
				const item = items[i]
				if (item.kind === "file") {
					const file = item.getAsFile()
					if (file) pastedFiles.push(file)
				}
			}
			if (pastedFiles.length > 0) {
				onFiles(pastedFiles)
			}
		}
		window.addEventListener("paste", handlePaste)
		return () => window.removeEventListener("paste", handlePaste)
	}, [disabled, onFiles])

	return (
		<div className="space-y-3">
			<button
				type="button"
				disabled={disabled}
				onClick={() => inputRef.current?.click()}
				onDragEnter={(event) => {
					event.preventDefault()
					if (!disabled) setDragging(true)
				}}
				onDragOver={(event) => event.preventDefault()}
				onDragLeave={(event) => {
					if (!event.currentTarget.contains(event.relatedTarget as Node)) {
						setDragging(false)
					}
				}}
				onDrop={(event) => {
					event.preventDefault()
					setDragging(false)
					if (!disabled) chooseFiles(event.dataTransfer.files)
				}}
				aria-label={t.upload.ariaLabel}
				className={cn(
					"group relative flex min-h-36 w-full flex-col items-center justify-center rounded-xl border border-dashed p-4 text-center transition-all duration-200 cursor-pointer",
					"border-border/80 bg-card/40 hover:border-primary/60 hover:bg-card/70 hover:shadow-md hover:shadow-sky-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
					dragging &&
						"border-primary bg-primary/10 scale-[1.01] shadow-lg shadow-sky-500/10",
					disabled &&
						"cursor-not-allowed opacity-50 hover:border-border/80 hover:bg-card/40",
				)}
			>
				<div className="mb-2.5 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-110 group-hover:bg-primary/15">
					<UploadIcon animateOnHover size={20} />
				</div>
				<p className="text-xs font-semibold text-foreground">
					{t.upload.dropPrompt}
				</p>
				<p className="mt-1 text-[11px] text-muted-foreground">
					{t.upload.dropSub}
				</p>
			</button>

			<input
				ref={inputRef}
				type="file"
				multiple
				accept=".tgs,.zip,application/x-tgsticker,application/zip"
				disabled={disabled}
				onChange={(event) => {
					chooseFiles(event.target.files)
					event.target.value = ""
				}}
				className="sr-only"
			/>

			<LoadedSummaryCard
				count={sources.length}
				totalBytes={totalBytes}
				disabled={disabled}
				buttonText={t.upload.btnReselect}
				onAction={() => inputRef.current?.click()}
				loadedCountLabel={t.upload.loadedCount}
				totalSizeLabel={t.upload.totalSize}
			/>
		</div>
	)
}
