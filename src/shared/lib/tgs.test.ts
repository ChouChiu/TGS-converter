import { gzipSync } from "fflate"
import { describe, expect, it } from "vitest"
import { decompressTgs, parseTgs } from "./tgs"

function tgs(overrides: Record<string, unknown> = {}): Uint8Array {
	const document = {
		v: "5.7.4",
		w: 64,
		h: 64,
		fr: 30,
		ip: 0,
		op: 3,
		layers: [],
		...overrides,
	}
	return gzipSync(new TextEncoder().encode(JSON.stringify(document)))
}

describe("TGS 解析", () => {
	it("读取有效的 Lottie 元数据", async () => {
		await expect(parseTgs(tgs())).resolves.toMatchObject({
			width: 64,
			height: 64,
			frameRate: 30,
			frameCount: 3,
		})
	})

	it("兼容未压缩的 JSON TGS", async () => {
		const plain = new TextEncoder().encode(
			JSON.stringify({
				v: "5.10.1",
				w: 512,
				h: 512,
				fr: 60,
				ip: 0,
				op: 2,
				layers: [],
			}),
		)
		await expect(parseTgs(plain)).resolves.toMatchObject({
			width: 512,
			frameCount: 2,
		})
	})

	it("拒绝非 gzip 与超限动画", async () => {
		await expect(parseTgs(new Uint8Array([1, 2, 3]))).rejects.toThrow(
			"不是有效",
		)
		await expect(parseTgs(tgs({ w: 4096 }))).rejects.toThrow("2048px")
		await expect(parseTgs(tgs({ op: 601 }))).rejects.toThrow("600 帧")
		await expect(parseTgs(tgs({ fr: 0 }))).rejects.toThrow("帧率")
	})

	it("拒绝损坏或非法的 gzip 数据", async () => {
		// Valid gzip header (0x1f, 0x8b) but corrupted body
		const corruptedGzip = new Uint8Array([0x1f, 0x8b, 0x08, 0x00, 0xff, 0xff])
		await expect(decompressTgs(corruptedGzip)).rejects.toThrow(
			"数据损坏或无法解压",
		)
		await expect(decompressTgs(new Uint8Array([0x00, 0x00]))).rejects.toThrow(
			"不是有效的 TGS gzip 文件",
		)
	})

	it("拒绝无效的 Lottie JSON 结构", async () => {
		const invalidJsonTgs = gzipSync(new TextEncoder().encode("not-a-json"))
		await expect(parseTgs(invalidJsonTgs)).rejects.toThrow("Lottie JSON 无效")

		const missingLayersTgs = gzipSync(
			new TextEncoder().encode(
				JSON.stringify({ w: 100, h: 100, fr: 30, ip: 0, op: 10 }),
			),
		)
		await expect(parseTgs(missingLayersTgs)).rejects.toThrow(
			"缺少画布、帧率或图层信息",
		)
	})
})
