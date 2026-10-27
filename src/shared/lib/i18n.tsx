import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useState,
} from "react"
import { storage } from "@/shared/lib/storage"
import enUS from "@/shared/locales/en-US.json"
import zhCN from "@/shared/locales/zh-CN.json"

export type Locale = "zh-CN" | "en-US"
export type Translations = typeof zhCN

export const LOCALES: Record<Locale, { label: string; name: string }> = {
	"zh-CN": { label: "中", name: "简体中文" },
	"en-US": { label: "EN", name: "English" },
}

const translations: Record<Locale, Translations> = {
	"zh-CN": zhCN,
	"en-US": enUS,
}

const STORAGE_KEY_LOCALE = "tgs_converter_locale"

export function getInitialLocale(): Locale {
	const saved = storage.get(STORAGE_KEY_LOCALE)
	if (saved === "zh-CN" || saved === "en-US") return saved
	return "zh-CN"
}

interface I18nContextValue {
	locale: Locale
	setLocale: (locale: Locale) => void
	t: Translations
}

const I18nContext = createContext<I18nContextValue>({
	locale: "zh-CN",
	setLocale: () => {},
	t: zhCN,
})

export function I18nProvider({ children }: { children: ReactNode }) {
	const [locale, setLocaleState] = useState<Locale>(getInitialLocale)

	const setLocale = (newLocale: Locale) => {
		setLocaleState(newLocale)
		storage.set(STORAGE_KEY_LOCALE, newLocale)
	}

	useEffect(() => {
		if (typeof document !== "undefined") {
			document.documentElement.lang = locale
		}
	}, [locale])

	return (
		<I18nContext.Provider
			value={{
				locale,
				setLocale,
				t: translations[locale] ?? zhCN,
			}}
		>
			{children}
		</I18nContext.Provider>
	)
}

export function useI18n(): I18nContextValue {
	return useContext(I18nContext)
}

export const t: Translations = zhCN

export function getTranslations(locale: Locale = "zh-CN"): Translations {
	return translations[locale] ?? zhCN
}

export function formatString(
	template: string,
	vars: Record<string, string | number>,
): string {
	return template.replace(
		/\{(\w+)\}/g,
		(_, key) => vars[key]?.toString() ?? `{${key}}`,
	)
}
