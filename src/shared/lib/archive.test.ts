import { gzipSync, unzipSync, zipSync } from "fflate"
import { describe, expect, it } from "vitest"
import type { ConversionResult } from "@/shared/model/types"
import { createResultArchive, extractInputFile } from "./archive"

const lottie = gzipSync(
	new TextEncoder().encode(
		JSON.stringify({ w: 32, h: 32, fr: 10, ip: 0, op: 2, layers: [] }),
	),
)

describe("ZIP 输入", () => {
	it("递归提取 TGS 并忽略其他文件", async () => {
		const zipped = zipSync({
			"pack/one.tgs": lottie,
			"pack/readme.txt": new TextEncoder().encode("ignored"),
		})
		const sources = await extractInputFile(
			new File([zipped], "stickers.zip", {
				type: "application/zip",
			}),
		)
		expect(sources).toHaveLength(1)
		expect(sources[0].path).toBe("pack/one.tgs")
		expect(sources[0].name).toBe("one.tgs")
	})

	it("拒绝空文件与非支持的文件扩展名", async () => {
		await expect(extractInputFile(new File([], "empty.tgs"))).rejects.toThrow(
			"文件为空",
		)

		await expect(
			extractInputFile(new File([new Uint8Array([1])], "invalid.txt")),
		).rejects.toThrow("请选择 .tgs 或 .zip 文件")
	})

	it("拒绝未包含 TGS 的 ZIP", async () => {
		const zipped = zipSync({ "readme.txt": new Uint8Array([1]) })
		await expect(
			extractInputFile(new File([zipped], "empty.zip")),
		).rejects.toThrow("没有找到")
	})

	it("按照文件路径中的数字自然排序", async () => {
		const zipped = zipSync({
			"pack/10.tgs": lottie,
			"pack/2.tgs": lottie,
			"pack/1.tgs": lottie,
			"pack/20.tgs": lottie,
		})
		const sources = await extractInputFile(new File([zipped], "numbered.zip"))
		expect(sources.map((source) => source.path)).toEqual([
			"pack/1.tgs",
			"pack/2.tgs",
			"pack/10.tgs",
			"pack/20.tgs",
		])
	})

	it("忽略 ZIP 中的目录项", async () => {
		const zipped = zipSync({
			"pack/folder.tgs/": new Uint8Array(),
			"pack/real.tgs": lottie,
		})
		const sources = await extractInputFile(new File([zipped], "folders.zip"))
		expect(sources).toHaveLength(1)
		expect(sources[0].path).toBe("pack/real.tgs")
	})
})

describe("结果 ZIP 打包", () => {
	it("打包转换结果，并在有失败项时包含转换报告", async () => {
		const fakeResult: ConversionResult = {
			id: "res-1",
			inputPath: "pack/sticker1.tgs",
			outputPath: "pack/sticker1.webp",
			name: "sticker1.webp",
			format: "webp",
			mimeType: "image/webp",
			bytes: new Uint8Array([1, 2, 3]),
			blob: new Blob([new Uint8Array([1, 2, 3])]),
			previewUrl: "blob:http://localhost/test",
			width: 512,
			height: 512,
			frameRate: 30,
			frameCount: 10,
		}

		const zipBytes = await createResultArchive(
			[fakeResult],
			[{ path: "pack/failed.tgs", error: "动画尺寸超出限制" }],
		)

		expect(zipBytes.byteLength).toBeGreaterThan(0)

		const unzipped = unzipSync(zipBytes)
		expect(unzipped["pack/sticker1.webp"]).toEqual(new Uint8Array([1, 2, 3]))
		expect(unzipped["conversion-report.txt"]).toBeDefined()

		const report = new TextDecoder().decode(unzipped["conversion-report.txt"])
		expect(report).toContain("pack/failed.tgs: 动画尺寸超出限制")
	})
})
