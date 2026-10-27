import { LIMITS } from "@/shared/config/limits"
import { sanitizeArchivePath } from "@/shared/lib/files"
import type { ConversionSource } from "@/shared/model/types"

export interface TelegramSticker {
	file_id: string
	file_unique_id: string
	type?: string
	width: number
	height: number
	is_animated?: boolean
	is_video?: boolean
	emoji?: string
	set_name?: string
	file_size?: number
}

export interface TelegramStickerSet {
	name: string
	title: string
	sticker_type?: string
	stickers: TelegramSticker[]
}

export interface TelegramFile {
	file_id: string
	file_unique_id: string
	file_size?: number
	file_path?: string
}

export interface TelegramApiResponse<T> {
	ok: boolean
	result?: T
	error_code?: number
	description?: string
	parameters?: {
		migrate_to_chat_id?: number
		retry_after?: number
	}
}

export interface FetchTelegramOptions {
	token: string
	setIdentifier: string
	apiBaseUrl: string
	concurrency?: number
	signal?: AbortSignal
	onProgress?: (message: string, fraction: number) => void
}

const DEFAULT_CONCURRENCY = 4

export function isValidProxyUrl(url: string): boolean {
	const trimmed = url.trim()
	if (!trimmed) return false
	try {
		const parsed = new URL(trimmed)
		return parsed.protocol === "http:" || parsed.protocol === "https:"
	} catch {
		return false
	}
}

export function isValidBotToken(token: string): boolean {
	return /^\d+:[A-Za-z0-9_-]{20,}$/.test(token.trim())
}

export function parseStickerSetName(input: string): string {
	const trimmed = input.trim()
	if (!trimmed) return ""

	const clean = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed

	const tgMatch = clean.match(
		/^tg:(?:\/\/)?(?:addstickers|stickers)\?set=([a-zA-Z0-9_]+)/i,
	)
	if (tgMatch) return tgMatch[1]

	const urlMatch = clean.match(/(?:addstickers|addemoji)\/([a-zA-Z0-9_]+)/i)
	if (urlMatch) return urlMatch[1]

	const directMatch = clean.match(/^([a-zA-Z0-9_]+)$/)
	if (directMatch) return directMatch[1]

	return clean
}

function handleFetchError(error: unknown): never {
	if (error instanceof DOMException && error.name === "AbortError") {
		throw error
	}
	if (
		error instanceof TypeError &&
		error.message.toLowerCase().includes("fetch")
	) {
		throw new Error(
			"请求代理地址失败，请检查反代服务是否正常运行或配置了正确的 CORS 跨域响应头。",
		)
	}
	if (error instanceof Error) {
		throw error
	}
	throw new Error(String(error))
}

async function fetchTelegramJson<T>(
	url: string,
	signal?: AbortSignal,
	retry = true,
): Promise<T> {
	let response: Response
	try {
		response = await fetch(url, { signal })
	} catch (error) {
		handleFetchError(error)
	}

	let data: TelegramApiResponse<T> | undefined
	try {
		data = (await response.json()) as TelegramApiResponse<T>
	} catch {
		// Response was not JSON
	}

	if (response.status === 429 && retry && data?.parameters?.retry_after) {
		if (signal?.aborted) {
			throw new DOMException("Operation aborted", "AbortError")
		}
		const waitMs = Math.min(data.parameters.retry_after * 1000, 10000)
		await new Promise<void>((resolve, reject) => {
			const timer = setTimeout(resolve, waitMs)
			signal?.addEventListener(
				"abort",
				() => {
					clearTimeout(timer)
					reject(new DOMException("Operation aborted", "AbortError"))
				},
				{ once: true },
			)
		})
		return fetchTelegramJson<T>(url, signal, false)
	}

	if (!response.ok || !data?.ok || !data.result) {
		if (response.status === 401) {
			throw new Error("Bot Token 无效，请检查 Token 是否正确")
		}
		if (
			response.status === 400 &&
			data?.description?.includes("STICKERSET_INVALID")
		) {
			throw new Error("未找到该贴图包，请检查贴图包短链或名称是否正确")
		}
		if (data?.description) {
			throw new Error(`Telegram API 错误: ${data.description}`)
		}
		throw new Error(`请求 Telegram API 失败 (HTTP ${response.status})`)
	}

	return data.result
}

function normalizeEndpoint(
	apiBaseUrl: string,
	token: string,
	path: string,
): string {
	const base = apiBaseUrl.trim().replace(/\/+$/, "")
	const trimmedToken = token.trim()
	return `${base}/bot${trimmedToken}/${path}`
}

export async function fetchStickerSetInfo(
	token: string,
	setName: string,
	apiBaseUrl: string,
	signal?: AbortSignal,
): Promise<TelegramStickerSet> {
	const url = `${normalizeEndpoint(apiBaseUrl, token, "getStickerSet")}?name=${encodeURIComponent(setName)}`
	return fetchTelegramJson<TelegramStickerSet>(url, signal)
}

export async function getStickerFilePath(
	token: string,
	fileId: string,
	apiBaseUrl: string,
	signal?: AbortSignal,
): Promise<string> {
	const url = `${normalizeEndpoint(apiBaseUrl, token, "getFile")}?file_id=${encodeURIComponent(fileId)}`
	const file = await fetchTelegramJson<TelegramFile>(url, signal)
	if (!file.file_path) {
		throw new Error("无法获取贴图文件下载路径")
	}
	return file.file_path
}

export async function downloadStickerFile(
	token: string,
	filePath: string,
	apiBaseUrl: string,
	signal?: AbortSignal,
): Promise<Uint8Array> {
	const base = apiBaseUrl.trim().replace(/\/+$/, "")
	const trimmedToken = token.trim()
	const url = `${base}/file/bot${trimmedToken}/${filePath}`
	let response: Response
	try {
		response = await fetch(url, { signal })
	} catch (error) {
		handleFetchError(error)
	}

	if (!response.ok) {
		if (response.status === 401) {
			throw new Error("Bot Token 无效，下载失败")
		}
		throw new Error(`下载贴图文件失败 (HTTP ${response.status})`)
	}

	const buffer = await response.arrayBuffer()
	return new Uint8Array(buffer)
}

export async function fetchTelegramStickerSources(
	options: FetchTelegramOptions,
): Promise<ConversionSource[]> {
	const {
		token,
		setIdentifier,
		apiBaseUrl,
		concurrency = DEFAULT_CONCURRENCY,
		signal,
		onProgress,
	} = options

	const trimmedBase = apiBaseUrl?.trim()
	if (!trimmedBase) {
		throw new Error("请输入 API 反向代理地址")
	}
	if (!isValidProxyUrl(trimmedBase)) {
		throw new Error("代理地址必须以 http:// 或 https:// 开头")
	}

	const trimmedToken = token.trim()
	if (!trimmedToken) {
		throw new Error("请输入 Bot Token")
	}

	const setName = parseStickerSetName(setIdentifier)
	if (!setName) {
		throw new Error("请输入贴图包短链或名称")
	}

	onProgress?.("正在获取贴图包信息...", 0.05)

	const stickerSet = await fetchStickerSetInfo(
		trimmedToken,
		setName,
		trimmedBase,
		signal,
	)

	const animatedStickers = stickerSet.stickers.filter((s) => s.is_animated)

	if (animatedStickers.length === 0) {
		const title = stickerSet.title || setName
		if (stickerSet.stickers.some((s) => s.is_video)) {
			throw new Error(
				`贴图包「${title}」包含的是视频贴图（.webm），目前仅支持 TGS 动画贴图`,
			)
		}
		if (stickerSet.stickers.length > 0) {
			throw new Error(
				`贴图包「${title}」包含的是静态贴图（.webp），目前仅支持 TGS 动画贴图`,
			)
		}
		throw new Error(`贴图包「${title}」中没有找到任何贴图`)
	}

	const totalCount = animatedStickers.length
	const padLength = Math.max(2, String(totalCount).length)
	const cleanSetName = sanitizeArchivePath(setName).replace(
		/[^a-zA-Z0-9_-]/g,
		"_",
	)

	const sources: (ConversionSource | null)[] = new Array(totalCount).fill(null)
	let downloadedCount = 0
	let totalBytes = 0

	async function downloadOne(index: number): Promise<void> {
		if (signal?.aborted) return
		const sticker = animatedStickers[index]
		const filePath = await getStickerFilePath(
			trimmedToken,
			sticker.file_id,
			trimmedBase,
			signal,
		)
		const bytes = await downloadStickerFile(
			trimmedToken,
			filePath,
			trimmedBase,
			signal,
		)

		if (bytes.byteLength > LIMITS.maxTgsBytes) {
			throw new Error(
				`贴图文件超过单文件 ${Math.round(LIMITS.maxTgsBytes / (1024 * 1024))}MiB 限制`,
			)
		}

		totalBytes += bytes.byteLength
		if (totalBytes > LIMITS.maxExtractedBytes) {
			throw new Error(
				`贴图包总量超过 ${Math.round(LIMITS.maxExtractedBytes / (1024 * 1024))}MiB 限制`,
			)
		}

		const numStr = String(index + 1).padStart(padLength, "0")
		const fileName = `${cleanSetName}_${numStr}.tgs`
		const safePath = `${cleanSetName}/${fileName}`

		sources[index] = {
			id: crypto.randomUUID(),
			name: fileName,
			path: safePath,
			bytes,
		}

		downloadedCount += 1
		const fraction = 0.05 + (downloadedCount / totalCount) * 0.95
		onProgress?.(`正在下载贴图 (${downloadedCount}/${totalCount})...`, fraction)
	}

	let nextIndex = 0
	const workerCount = Math.min(concurrency, totalCount)
	let workerError: unknown = null

	async function worker(): Promise<void> {
		while (nextIndex < totalCount && !signal?.aborted && !workerError) {
			const currentIndex = nextIndex
			nextIndex += 1
			try {
				await downloadOne(currentIndex)
			} catch (err) {
				workerError = err
				throw err
			}
		}
	}

	await Promise.all(Array.from({ length: workerCount }, () => worker()))

	if (signal?.aborted) {
		throw new DOMException("Operation aborted", "AbortError")
	}

	return sources.filter((s): s is ConversionSource => s !== null)
}
