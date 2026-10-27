import { ExternalLink, Eye, EyeOff, Globe, Key, Loader2 } from "lucide-react"
import { type FormEvent, useEffect, useState } from "react"
import { useI18n } from "@/shared/lib/i18n"
import { storage } from "@/shared/lib/storage"
import type { ConversionSource } from "@/shared/model/types"
import { Alert, AlertDescription } from "@/shared/ui/alert"
import { DownloadIcon } from "@/shared/ui/animate-ui/icons/download"
import { ShieldCheckIcon } from "@/shared/ui/animate-ui/icons/shield-check"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { isValidBotToken, isValidProxyUrl } from "../api/telegram"
import { LoadedSummaryCard } from "./loaded-summary-card"

const STORAGE_KEY_TOKEN = "tgs_converter_bot_token"
const STORAGE_KEY_REMEMBER = "tgs_converter_remember_token"
const STORAGE_KEY_API_BASE = "tgs_converter_api_base"

interface TelegramBotFormProps {
	sources: ConversionSource[]
	disabled: boolean
	loading: boolean
	onFetch: (
		token: string,
		setIdentifier: string,
		apiBaseUrl: string,
	) => Promise<void>
}

export function TelegramBotForm({
	sources,
	disabled,
	loading,
	onFetch,
}: TelegramBotFormProps) {
	const { t } = useI18n()
	const [token, setToken] = useState(() => storage.get(STORAGE_KEY_TOKEN) ?? "")
	const [rememberConfig, setRememberConfig] = useState(
		() => storage.get(STORAGE_KEY_REMEMBER) !== "false",
	)
	const [showToken, setShowToken] = useState(false)
	const [showProxy, setShowProxy] = useState(false)
	const [setIdentifier, setSetIdentifier] = useState("")
	const [apiBaseUrl, setApiBaseUrl] = useState(
		() => storage.get(STORAGE_KEY_API_BASE) ?? "",
	)
	const [clientError, setClientError] = useState<string | null>(null)

	const totalBytes = sources.reduce(
		(total, source) => total + source.bytes.byteLength,
		0,
	)

	useEffect(() => {
		if (rememberConfig) {
			if (token) storage.set(STORAGE_KEY_TOKEN, token)
			else storage.remove(STORAGE_KEY_TOKEN)

			if (apiBaseUrl) storage.set(STORAGE_KEY_API_BASE, apiBaseUrl)
			else storage.remove(STORAGE_KEY_API_BASE)
		} else {
			storage.remove(STORAGE_KEY_TOKEN)
			storage.remove(STORAGE_KEY_API_BASE)
		}
		storage.set(STORAGE_KEY_REMEMBER, String(rememberConfig))
	}, [token, apiBaseUrl, rememberConfig])

	const handleSubmit = async (event: FormEvent) => {
		event.preventDefault()
		setClientError(null)

		const cleanProxy = apiBaseUrl.trim()
		if (!cleanProxy) {
			setClientError(t.telegram.emptyProxy)
			return
		}
		if (!isValidProxyUrl(cleanProxy)) {
			setClientError(t.telegram.invalidProxy)
			return
		}

		const cleanToken = token.trim()
		if (!cleanToken || !isValidBotToken(cleanToken)) {
			setClientError(t.telegram.invalidToken)
			return
		}

		const cleanSet = setIdentifier.trim()
		if (!cleanSet) {
			setClientError(t.telegram.emptySetName)
			return
		}

		await onFetch(cleanToken, cleanSet, cleanProxy)
	}

	const isActionDisabled = disabled || loading

	return (
		<div className="space-y-3">
			<form onSubmit={handleSubmit} noValidate className="space-y-3">
				{/* Proxy URL Input */}
				<div className="space-y-1.5">
					<div className="flex items-center justify-between text-xs">
						<label
							htmlFor="tg-proxy-url"
							className="font-medium text-foreground flex items-center gap-1.5"
						>
							<Globe className="size-3.5 text-muted-foreground" />
							{t.telegram.proxyLabel}
						</label>
						<span className="text-[11px] text-muted-foreground">
							{t.telegram.proxyHelp}
						</span>
					</div>
					<div className="relative">
						<Input
							id="tg-proxy-url"
							type={showProxy ? "text" : "password"}
							autoComplete="off"
							disabled={isActionDisabled}
							value={apiBaseUrl}
							onChange={(event) => {
								setApiBaseUrl(event.target.value)
								if (clientError) setClientError(null)
							}}
							placeholder={t.telegram.proxyPlaceholder}
							className="pr-9 font-mono text-xs"
						/>
						<button
							type="button"
							tabIndex={-1}
							disabled={isActionDisabled}
							onClick={() => setShowProxy((prev) => !prev)}
							className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
							aria-label={
								showProxy ? t.telegram.hideProxy : t.telegram.showProxy
							}
						>
							{showProxy ? (
								<EyeOff className="size-3.5" />
							) : (
								<Eye className="size-3.5" />
							)}
						</button>
					</div>
				</div>

				{/* Token Input */}
				<div className="space-y-1.5">
					<div className="flex items-center justify-between text-xs">
						<label
							htmlFor="tg-bot-token"
							className="font-medium text-foreground flex items-center gap-1.5"
						>
							<Key className="size-3.5 text-muted-foreground" />
							{t.telegram.tokenLabel}
						</label>
						<a
							href="https://t.me/BotFather"
							target="_blank"
							rel="noreferrer"
							className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
						>
							<span>{t.telegram.tokenHelpLink}</span>
							<ExternalLink className="size-3" />
						</a>
					</div>

					<div className="relative">
						<Input
							id="tg-bot-token"
							type={showToken ? "text" : "password"}
							autoComplete="off"
							disabled={isActionDisabled}
							value={token}
							onChange={(event) => {
								setToken(event.target.value)
								if (clientError) setClientError(null)
							}}
							placeholder={t.telegram.tokenPlaceholder}
							className="pr-9 font-mono text-xs"
						/>
						<button
							type="button"
							tabIndex={-1}
							disabled={isActionDisabled}
							onClick={() => setShowToken((prev) => !prev)}
							className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
							aria-label={
								showToken ? t.telegram.hideToken : t.telegram.showToken
							}
						>
							{showToken ? (
								<EyeOff className="size-3.5" />
							) : (
								<Eye className="size-3.5" />
							)}
						</button>
					</div>

					<div className="flex items-center justify-between pt-0.5 text-[11px]">
						<label className="flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground">
							<input
								type="checkbox"
								checked={rememberConfig}
								disabled={isActionDisabled}
								onChange={(event) => setRememberConfig(event.target.checked)}
								className="size-3 rounded border-border/80 bg-background accent-foreground"
							/>
							<span>{t.telegram.rememberToken}</span>
						</label>

						{(token || apiBaseUrl) && (
							<button
								type="button"
								disabled={isActionDisabled}
								onClick={() => {
									setToken("")
									setApiBaseUrl("")
									storage.remove(STORAGE_KEY_TOKEN)
									storage.remove(STORAGE_KEY_API_BASE)
								}}
								className="text-muted-foreground hover:text-foreground text-[11px]"
							>
								{t.telegram.clearToken}
							</button>
						)}
					</div>
				</div>

				{/* Sticker Set Input */}
				<div className="space-y-1.5">
					<label
						htmlFor="tg-sticker-set"
						className="block text-xs font-medium text-foreground"
					>
						{t.telegram.setLabel}
					</label>
					<Input
						id="tg-sticker-set"
						type="text"
						disabled={isActionDisabled}
						value={setIdentifier}
						onChange={(event) => {
							setSetIdentifier(event.target.value)
							if (clientError) setClientError(null)
						}}
						placeholder={t.telegram.setPlaceholder}
						className="text-xs"
					/>
				</div>

				{/* Client Validation Error */}
				{clientError && (
					<Alert variant="destructive" className="py-2 text-xs">
						<AlertDescription>{clientError}</AlertDescription>
					</Alert>
				)}

				{/* Fetch Button */}
				<Button
					type="submit"
					variant="telegram"
					disabled={
						isActionDisabled ||
						!token.trim() ||
						!setIdentifier.trim() ||
						!apiBaseUrl.trim()
					}
					className="w-full text-xs h-8 font-semibold shadow-xs"
				>
					{loading ? (
						<>
							<Loader2 className="mr-1.5 size-3.5 animate-spin" />
							{t.telegram.btnFetching}
						</>
					) : (
						<>
							<DownloadIcon animateOnHover size={14} className="mr-1.5" />
							{t.telegram.btnFetch}
						</>
					)}
				</Button>
			</form>

			{/* Loaded Sources Summary */}
			<LoadedSummaryCard
				count={sources.length}
				totalBytes={totalBytes}
				disabled={isActionDisabled}
				buttonText={t.telegram.btnRefetch}
				onAction={() => handleSubmit({ preventDefault: () => {} } as FormEvent)}
				loadedCountLabel={t.telegram.loadedCount}
				totalSizeLabel={t.telegram.totalSize}
			/>

			{/* Security / Privacy Hint */}
			<div className="flex items-start gap-1.5 text-[11px] text-muted-foreground/80 leading-tight">
				<ShieldCheckIcon
					animateOnHover
					size={14}
					className="shrink-0 text-emerald-400 mt-0.5"
				/>
				<span>{t.telegram.tokenSecurityTip}</span>
			</div>
		</div>
	)
}
