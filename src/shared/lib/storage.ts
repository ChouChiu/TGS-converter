export const storage = {
	get(key: string): string | null {
		try {
			return localStorage.getItem(key)
		} catch {
			return null
		}
	},
	set(key: string, value: string): void {
		try {
			localStorage.setItem(key, value)
		} catch {
			// Ignore quota or disabled storage in incognito
		}
	},
	remove(key: string): void {
		try {
			localStorage.removeItem(key)
		} catch {
			// Ignore
		}
	},
}
