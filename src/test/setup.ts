import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

afterEach(() => {
	cleanup()
	try {
		localStorage.clear()
	} catch {
		// Ignore
	}
})

if (!globalThis.crypto.randomUUID) {
	Object.defineProperty(globalThis.crypto, "randomUUID", {
		value: () => `test-${Math.random()}`,
	})
}

if (typeof window !== "undefined") {
	if (!window.matchMedia) {
		Object.defineProperty(window, "matchMedia", {
			writable: true,
			value: (query: string) => ({
				matches: false,
				media: query,
				onchange: null,
				addListener: () => {},
				removeListener: () => {},
				addEventListener: () => {},
				removeEventListener: () => {},
				dispatchEvent: () => false,
			}),
		})
	}

	if (!window.ResizeObserver) {
		window.ResizeObserver = class ResizeObserver {
			observe() {}
			unobserve() {}
			disconnect() {}
		}
	}

	if (!window.IntersectionObserver) {
		window.IntersectionObserver = class IntersectionObserver {
			readonly root = null
			readonly rootMargin = ""
			readonly thresholds = []
			observe() {}
			unobserve() {}
			disconnect() {}
			takeRecords() {
				return []
			}
		} as unknown as typeof IntersectionObserver
	}
}
