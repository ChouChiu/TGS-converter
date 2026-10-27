import type { OutputFormat } from "@/shared/model/types"

export const FORMAT_META: Record<
	OutputFormat,
	{ extension: string; mimeType: string }
> = {
	gif: {
		extension: "gif",
		mimeType: "image/gif",
	},
	apng: {
		extension: "png",
		mimeType: "image/png",
	},
	webp: {
		extension: "webp",
		mimeType: "image/webp",
	},
}

export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`
	return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`
}

export function formatElapsedTime(milliseconds: number): string {
	const ms = Math.max(0, milliseconds)
	const totalSeconds = Math.floor(ms / 1000)
	const tenths = Math.floor((ms % 1000) / 100)
	const hours = Math.floor(totalSeconds / 3600)
	const minutes = Math.floor((totalSeconds % 3600) / 60)
	const seconds = totalSeconds % 60
	const time = `${minutes.toString().padStart(2, "0")}:${seconds
		.toString()
		.padStart(2, "0")}.${tenths}`
	return hours > 0 ? `${hours.toString().padStart(2, "0")}:${time}` : time
}

export function sanitizeArchivePath(input: string): string {
	const normalized = input.replaceAll("\\", "/").replace(/^\/+/, "")
	const safeParts = normalized
		.split("/")
		.filter((part) => part && part !== "." && part !== "..")
		// biome-ignore lint/suspicious/noControlCharactersInRegex: sanitize ASCII control characters
		.map((part) => part.replace(/[\x00-\x1f<>:"|?*]/g, "_"))
	return safeParts.join("/") || "sticker.tgs"
}

export function outputPathFor(inputPath: string, format: OutputFormat): string {
	const extension = FORMAT_META[format].extension
	const safe = sanitizeArchivePath(inputPath)
	return /\.tgs$/i.test(safe)
		? safe.replace(/\.tgs$/i, `.${extension}`)
		: `${safe.replace(/\.[^/.]+$/, "")}.${extension}`
}

export function makeUniquePath(path: string, used: Set<string>): string {
	const lower = path.toLowerCase()
	if (!used.has(lower)) {
		used.add(lower)
		return path
	}
	const slash = path.lastIndexOf("/")
	const directory = slash >= 0 ? path.slice(0, slash + 1) : ""
	const filename = slash >= 0 ? path.slice(slash + 1) : path
	const dot = filename.lastIndexOf(".")
	const stem = dot >= 0 ? filename.slice(0, dot) : filename
	const extension = dot >= 0 ? filename.slice(dot) : ""
	let suffix = 2
	let candidate = ""
	do {
		candidate = `${directory}${stem} (${suffix})${extension}`
		suffix += 1
	} while (used.has(candidate.toLowerCase()))
	used.add(candidate.toLowerCase())
	return candidate
}

export function basename(path: string): string {
	return path.slice(path.lastIndexOf("/") + 1)
}
