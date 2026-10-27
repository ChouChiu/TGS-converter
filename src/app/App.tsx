import { Code2 } from "lucide-react"
import { ConversionPanel, useConverter } from "@/features/convert-stickers"
import { ResultsGallery } from "@/features/download-results"
import {
	fetchTelegramStickerSources,
	TelegramBotForm,
	UploadDropzone,
} from "@/features/upload-stickers"
import { extractInputFile } from "@/shared/lib/archive"
import { I18nProvider, LOCALES, type Locale, useI18n } from "@/shared/lib/i18n"
import { BotIcon } from "@/shared/ui/animate-ui/icons/bot"
import { GlobeIcon } from "@/shared/ui/animate-ui/icons/globe"
import { LockIcon } from "@/shared/ui/animate-ui/icons/lock"
import { ShieldCheckIcon } from "@/shared/ui/animate-ui/icons/shield-check"
import { UploadIcon } from "@/shared/ui/animate-ui/icons/upload"
import { Badge } from "@/shared/ui/badge"
import { Button } from "@/shared/ui/button"
import { Logo } from "@/shared/ui/logo"
import { Separator } from "@/shared/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs"
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/shared/ui/tooltip"

function AppContent() {
	const converter = useConverter()
	const { t, locale, setLocale } = useI18n()

	const toggleLocale = () => {
		const next: Locale = locale === "zh-CN" ? "en-US" : "zh-CN"
		setLocale(next)
	}

	const handleFile = (file: File) => {
		converter.loadSources(() => extractInputFile(file), t.messages.readingFile)
	}

	const handleTelegramFetch = (
		token: string,
		setIdentifier: string,
		apiBaseUrl: string,
	) => {
		return converter.loadSources(
			(signal, onProgress) =>
				fetchTelegramStickerSources({
					token,
					setIdentifier,
					apiBaseUrl,
					signal,
					onProgress,
				}),
			t.messages.fetchingStickerSet,
		)
	}

	return (
		<TooltipProvider>
			<div className="dark min-h-svh bg-background text-foreground antialiased selection:bg-primary selection:text-white relative">
				{/* Ambient Telegram Blue Radial Glow */}
				<div
					aria-hidden="true"
					className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_-10%,rgba(36,161,222,0.14),transparent_70%)]"
				/>

				{/* Top Navigation Bar */}
				<header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border/70 bg-background/80 px-4 backdrop-blur-md sm:px-6 shadow-xs">
					<div className="flex items-center gap-2.5">
						<Logo className="size-7 transition-transform duration-300 hover:scale-105 hover:drop-shadow-[0_0_12px_rgba(36,161,222,0.4)]" />
						<div className="flex items-center gap-2">
							<span className="text-sm font-semibold tracking-tight text-foreground">
								{t.app.title}
							</span>
							<span className="hidden sm:inline-block rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-400">
								Telegram TGS
							</span>
						</div>
					</div>

					<div className="flex items-center gap-2">
						{/* Language Toggle */}
						<Tooltip>
							<TooltipTrigger
								render={
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={toggleLocale}
										aria-label={t.app.language}
										className="h-7 gap-1.5 px-2 text-xs font-medium border-border/60 bg-card/40 text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-card/70"
									>
										<GlobeIcon
											animateOnHover
											size={14}
											className="size-3.5 shrink-0"
										/>
										<span className="inline-flex items-center text-xs font-medium leading-none">
											{LOCALES[locale].label}
										</span>
									</Button>
								}
							/>
							<TooltipContent>
								{locale === "zh-CN" ? "Switch to English" : "切换为简体中文"}
							</TooltipContent>
						</Tooltip>

						<Tooltip>
							<TooltipTrigger
								render={
									<Badge
										variant="outline"
										className="h-7 gap-1.5 border-emerald-500/30 bg-emerald-500/10 px-2.5 text-xs font-normal text-emerald-400 transition-colors hover:bg-emerald-500/15"
									>
										<LockIcon
											animateOnHover
											size={12}
											className="size-3 shrink-0"
										/>
										<span className="inline-flex items-center leading-none">
											{t.app.badgeLocal}
										</span>
									</Badge>
								}
							/>
							<TooltipContent>{t.app.badgeLocalTooltip}</TooltipContent>
						</Tooltip>

						<Tooltip>
							<TooltipTrigger
								render={
									<a
										href="https://github.com/ChouChiu/TGS-Converter"
										target="_blank"
										rel="noreferrer"
										aria-label={t.app.githubTooltip}
										className="grid size-7 place-items-center rounded-md border border-border/60 text-muted-foreground transition-all hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
									>
										<Code2 className="size-3.5" />
									</a>
								}
							/>
							<TooltipContent>{t.app.githubTooltip}</TooltipContent>
						</Tooltip>
					</div>
				</header>

				{/* Two-Column Split Workspace */}
				<main className="relative z-10 grid min-h-[calc(100svh-3.5rem)] w-full grid-cols-1 lg:grid-cols-[400px_1fr] xl:grid-cols-[440px_1fr]">
					{/* Left Configuration Column */}
					<aside className="border-b border-border/70 bg-card/30 p-5 lg:border-r lg:border-b-0 lg:p-6 backdrop-blur-xs">
						<div className="space-y-5">
							{/* Panel Header */}
							<div className="space-y-1">
								<h1 className="text-base font-semibold tracking-tight text-foreground">
									{t.app.hero.heading}
								</h1>
								<p className="text-xs text-muted-foreground">
									{t.app.hero.description}
								</p>
							</div>

							<Separator className="bg-border/60" />

							{/* Step 1: Upload / Fetch */}
							<div className="space-y-2">
								<h2 className="text-xs font-medium text-foreground">
									{t.app.step1.title}
								</h2>
								<Tabs defaultValue="file" className="w-full">
									<TabsList className="grid w-full grid-cols-2 p-1 bg-muted/60 border border-border/60 rounded-lg">
										<TabsTrigger
											value="file"
											className="gap-1.5 text-xs font-medium data-active:text-primary"
										>
											<UploadIcon animateOnHover size={14} />
											{t.telegram.tabUpload}
										</TabsTrigger>
										<TabsTrigger
											value="bot"
											className="gap-1.5 text-xs font-medium data-active:text-primary"
										>
											<BotIcon animateOnHover size={14} />
											{t.telegram.tabBot}
										</TabsTrigger>
									</TabsList>

									<TabsContent value="file" className="pt-2">
										<UploadDropzone
											sources={converter.sources}
											disabled={converter.running || converter.loadingInput}
											onFile={handleFile}
										/>
									</TabsContent>
									<TabsContent value="bot" className="pt-2">
										<TelegramBotForm
											sources={converter.sources}
											disabled={converter.running}
											loading={converter.loadingInput}
											onFetch={handleTelegramFetch}
										/>
									</TabsContent>
								</Tabs>
							</div>

							{/* Step 2: Format & Convert */}
							<div className="space-y-2">
								<h2 className="text-xs font-medium text-foreground">
									{t.app.step2.title}
								</h2>
								<ConversionPanel
									format={converter.format}
									onFormatChange={converter.setFormat}
									items={converter.items}
									progress={converter.progress}
									running={converter.running}
									loadingInput={converter.loadingInput}
									elapsedMs={converter.elapsedMs}
									concurrency={converter.concurrency}
									error={converter.error}
									results={converter.results}
									onStart={converter.start}
									onCancel={converter.cancel}
									onReset={converter.reset}
								/>
							</div>

							<Separator className="bg-border/60" />

							{/* Compact Reassurance Note */}
							<div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
								<ShieldCheckIcon
									animateOnHover
									size={14}
									className="text-emerald-400"
								/>
								<span>{t.app.footer.privacy}</span>
							</div>
						</div>
					</aside>

					{/* Right Live Workspace & Results Gallery */}
					<div className="min-w-0 bg-background/40 backdrop-blur-xs">
						<ResultsGallery
							results={converter.results}
							archive={converter.archive}
							running={converter.running}
							itemCount={converter.items.length}
							progress={converter.progress}
							elapsedMs={converter.elapsedMs}
							format={converter.format}
						/>
					</div>
				</main>
			</div>
		</TooltipProvider>
	)
}

export default function App() {
	return (
		<I18nProvider>
			<AppContent />
		</I18nProvider>
	)
}
