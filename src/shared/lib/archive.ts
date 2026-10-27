import { unzip, zip } from "fflate"
import { LIMITS } from "@/shared/config/limits"
import { basename, sanitizeArchivePath } from "@/shared/lib/files"
import type { ConversionResult, ConversionSource } from "@/shared/model/types"

const NATURAL_PATH_COLLATOR = new Intl.Collator("zh-CN", {
	numeric: true,
	sensitivity: "base",
})

export async function extractInputFile(
	file: File,
): Promise<ConversionSource[]> {
	if (file.size === 0) {
		throw new Error("文件为空")
	}

	const lowerName = file.name.toLowerCase()
	if (!lowerName.endsWith(".tgs") && !lowerName.endsWith(".zip")) {
		throw new Error("请选择 .tgs 或 .zip 文件")
	}

	if (lowerName.endsWith(".tgs")) {
		if (file.size > LIMITS.maxTgsBytes) throw new Error("TGS 文件超过 10MiB")
		return [
			{
				id: crypto.randomUUID(),
				name: file.name,
				path: sanitizeArchivePath(file.name),
				bytes: new Uint8Array(await file.arrayBuffer()),
			},
		]
	}

	if (file.size > LIMITS.maxZipBytes) throw new Error("ZIP 文件超过 100MiB")
	const archive = new Uint8Array(await file.arrayBuffer())

	return new Promise((resolve, reject) => {
		unzip(
			archive,
			{
				filter(entry) {
					if (entry.name.endsWith("/")) return false
					const path = sanitizeArchivePath(entry.name)
					return (
						path.toLowerCase().endsWith(".tgs") && !path.includes("__MACOSX/")
					)
				},
			},
			(error, files) => {
				if (error) {
					reject(new Error("ZIP 已损坏、使用了不支持的压缩方式或已加密"))
					return
				}

				let totalBytes = 0
				const sources: ConversionSource[] = []

				for (const [path, bytes] of Object.entries(files)) {
					const safePath = sanitizeArchivePath(path)
					if (bytes.byteLength > LIMITS.maxTgsBytes) {
						reject(new Error(`${safePath} 超过单文件 10MiB 限制`))
						return
					}

					totalBytes += bytes.byteLength
					if (totalBytes > LIMITS.maxExtractedBytes) {
						reject(new Error("ZIP 解压后的 TGS 总量超过 100MiB"))
						return
					}

					sources.push({
						id: crypto.randomUUID(),
						name: basename(safePath),
						path: safePath,
						bytes,
					})
				}

				if (sources.length === 0) {
					reject(new Error("ZIP 中没有找到 TGS 文件"))
					return
				}

				sources.sort((left, right) =>
					NATURAL_PATH_COLLATOR.compare(left.path, right.path),
				)
				resolve(sources)
			},
		)
	})
}

export function createResultArchive(
	results: ConversionResult[],
	failures: { path: string; error: string }[],
): Promise<Uint8Array> {
	const files: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {}
	for (const result of results) {
		files[result.outputPath] = [result.bytes, { level: 0 }]
	}

	if (failures.length > 0) {
		const lines = [
			"TGS Converter 转换报告",
			`生成时间：${new Date().toISOString()}`,
			"",
			...failures.map(({ path, error }) => `- ${path}: ${error}`),
		]
		files["conversion-report.txt"] = new TextEncoder().encode(lines.join("\n"))
	}

	return new Promise((resolve, reject) => {
		zip(files, { level: 0 }, (error, data) => {
			if (error) reject(new Error("无法生成结果 ZIP"))
			else resolve(data)
		})
	})
}
