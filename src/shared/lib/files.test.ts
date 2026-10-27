import { describe, expect, it } from "vitest"
import {
	basename,
	formatBytes,
	formatElapsedTime,
	makeUniquePath,
	outputPathFor,
	sanitizeArchivePath,
} from "./files"

describe("文件路径工具", () => {
	it("清理危险 ZIP 路径", () => {
		expect(sanitizeArchivePath("../../stickers/../wave.tgs")).toBe(
			"stickers/wave.tgs",
		)
		expect(sanitizeArchivePath("/pack/a:b?.tgs")).toBe("pack/a_b_.tgs")
	})

	it("替换输出扩展名并处理重名", () => {
		expect(outputPathFor("pack/wave.tgs", "apng")).toBe("pack/wave.png")
		const used = new Set<string>()
		expect(makeUniquePath("pack/wave.webp", used)).toBe("pack/wave.webp")
		expect(makeUniquePath("pack/wave.webp", used)).toBe("pack/wave (2).webp")
	})

	it("格式化转换耗时与文件大小", () => {
		expect(formatElapsedTime(0)).toBe("00:00.0")
		expect(formatElapsedTime(12_345)).toBe("00:12.3")
		expect(formatElapsedTime(65_900)).toBe("01:05.9")
		expect(formatElapsedTime(3_665_000)).toBe("01:01:05.0")

		expect(formatBytes(512)).toBe("512 B")
		expect(formatBytes(2048)).toBe("2.0 KiB")
		expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MiB")
	})

	it("提取文件名", () => {
		expect(basename("pack/folder/wave.tgs")).toBe("wave.tgs")
		expect(basename("wave.tgs")).toBe("wave.tgs")
	})
})
