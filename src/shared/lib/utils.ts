import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs))
}

export function createAbortError(message = "转换已取消"): DOMException {
	return new DOMException(message, "AbortError")
}

export function isAbortError(error: unknown): boolean {
	return (
		(error instanceof DOMException || error instanceof Error) &&
		error.name === "AbortError"
	)
}

export function getErrorMessage(
	error: unknown,
	fallback = "发生未知错误",
): string {
	return error instanceof Error ? error.message : fallback
}
