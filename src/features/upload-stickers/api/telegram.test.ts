import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
	fetchTelegramStickerSources,
	isValidBotToken,
	isValidProxyUrl,
	parseStickerSetName,
} from "./telegram"

describe("Telegram 贴图工具", () => {
	describe("parseStickerSetName", () => {
		it("正确解析各种格式的短链、URL 与贴图名称", () => {
			const cases: [string, string][] = [
				["HotCherry", "HotCherry"],
				["@HotCherry", "HotCherry"],
				["  HotCherry  ", "HotCherry"],
				["", ""],
				["https://t.me/addstickers/HotCherry", "HotCherry"],
				["http://t.me/addstickers/HotCherry", "HotCherry"],
				["t.me/addstickers/HotCherry", "HotCherry"],
				["https://t.me/addstickers/HotCherry/", "HotCherry"],
				["https://t.me/addstickers/HotCherry?start=123", "HotCherry"],
				["https://telegram.me/addstickers/HotCherry", "HotCherry"],
				["https://telegram.dog/addstickers/HotCherry", "HotCherry"],
				["telegram.me/addstickers/HotCherry", "HotCherry"],
				["tg://addstickers?set=HotCherry", "HotCherry"],
				["tg:addstickers?set=HotCherry", "HotCherry"],
				["https://t.me/addemoji/HotCherry", "HotCherry"],
			]
			for (const [input, expected] of cases) {
				expect(parseStickerSetName(input)).toBe(expected)
			}
		})
	})

	describe("格式校验函数", () => {
		it("验证合法的代理地址并拒绝非法地址", () => {
			expect(isValidProxyUrl("https://tg.yourdomain.com")).toBe(true)
			expect(isValidProxyUrl("http://localhost:8080")).toBe(true)
			expect(isValidProxyUrl("")).toBe(false)
			expect(isValidProxyUrl("tg.yourdomain.com")).toBe(false)
			expect(isValidProxyUrl("ftp://example.com")).toBe(false)
		})

		it("验证合法的 Bot Token 并拒绝非法 Token", () => {
			expect(
				isValidBotToken("123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ_1234567"),
			).toBe(true)
			expect(isValidBotToken("")).toBe(false)
			expect(isValidBotToken("invalid-token")).toBe(false)
			expect(isValidBotToken("abc:123456789ABCdefGhIJKlmNoPQRs")).toBe(false)
			expect(isValidBotToken("123456:short")).toBe(false)
		})
	})

	describe("fetchTelegramStickerSources", () => {
		const originalFetch = globalThis.fetch
		const testProxy = "https://tg.example.com"
		const validToken = "123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ_1234567"

		beforeEach(() => {
			globalThis.fetch = vi.fn()
		})

		afterEach(() => {
			globalThis.fetch = originalFetch
		})

		it("参数不合法或缺失时抛出明确错误", async () => {
			await expect(
				fetchTelegramStickerSources({
					token: validToken,
					setIdentifier: "HotCherry",
					apiBaseUrl: "",
				}),
			).rejects.toThrow("请输入 API 反向代理地址")

			await expect(
				fetchTelegramStickerSources({
					token: validToken,
					setIdentifier: "HotCherry",
					apiBaseUrl: "ftp://invalid-url",
				}),
			).rejects.toThrow("代理地址必须以 http:// 或 https:// 开头")

			await expect(
				fetchTelegramStickerSources({
					token: "",
					setIdentifier: "HotCherry",
					apiBaseUrl: testProxy,
				}),
			).rejects.toThrow("请输入 Bot Token")

			await expect(
				fetchTelegramStickerSources({
					token: validToken,
					setIdentifier: "",
					apiBaseUrl: testProxy,
				}),
			).rejects.toThrow("请输入贴图包短链或名称")
		})

		it("成功下载并构建 ConversionSource 列表（保留顺序并编号）", async () => {
			const mockFetch = vi.mocked(fetch)

			mockFetch.mockImplementation(async (input) => {
				const url = String(input)
				if (url.includes("getStickerSet")) {
					return {
						ok: true,
						status: 200,
						json: async () => ({
							ok: true,
							result: {
								name: "HotCherry",
								title: "Hot Cherry",
								stickers: [
									{
										file_id: "id_1",
										file_unique_id: "u_1",
										width: 512,
										height: 512,
										is_animated: true,
									},
									{
										file_id: "id_2",
										file_unique_id: "u_2",
										width: 512,
										height: 512,
										is_animated: true,
									},
								],
							},
						}),
					} as Response
				}
				if (url.includes("getFile?file_id=id_1")) {
					return {
						ok: true,
						status: 200,
						json: async () => ({
							ok: true,
							result: {
								file_id: "id_1",
								file_unique_id: "u_1",
								file_path: "documents/file_1.tgs",
							},
						}),
					} as Response
				}
				if (url.includes("getFile?file_id=id_2")) {
					return {
						ok: true,
						status: 200,
						json: async () => ({
							ok: true,
							result: {
								file_id: "id_2",
								file_unique_id: "u_2",
								file_path: "documents/file_2.tgs",
							},
						}),
					} as Response
				}
				if (url.includes("file_1.tgs")) {
					return {
						ok: true,
						status: 200,
						arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
					} as Response
				}
				if (url.includes("file_2.tgs")) {
					return {
						ok: true,
						status: 200,
						arrayBuffer: async () => new Uint8Array([4, 5, 6]).buffer,
					} as Response
				}
				return { ok: false, status: 404 } as Response
			})

			const progressUpdates: string[] = []
			const sources = await fetchTelegramStickerSources({
				token: validToken,
				setIdentifier: "https://t.me/addstickers/HotCherry",
				apiBaseUrl: testProxy,
				onProgress: (msg) => progressUpdates.push(msg),
			})

			expect(sources).toHaveLength(2)
			expect(sources[0].name).toBe("HotCherry_01.tgs")
			expect(sources[0].path).toBe("HotCherry/HotCherry_01.tgs")
			expect(sources[0].bytes).toEqual(new Uint8Array([1, 2, 3]))

			expect(sources[1].name).toBe("HotCherry_02.tgs")
			expect(sources[1].path).toBe("HotCherry/HotCherry_02.tgs")
			expect(sources[1].bytes).toEqual(new Uint8Array([4, 5, 6]))
			expect(progressUpdates.length).toBeGreaterThan(0)
		})

		it("处理 401 与 400 STICKERSET_INVALID 等 API 错误", async () => {
			const mockFetch = vi.mocked(fetch)
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 401,
				json: async () => ({
					ok: false,
					error_code: 401,
					description: "Unauthorized",
				}),
			} as Response)

			await expect(
				fetchTelegramStickerSources({
					token: "123456:invalid",
					setIdentifier: "HotCherry",
					apiBaseUrl: testProxy,
				}),
			).rejects.toThrow("Bot Token 无效，请检查 Token 是否正确")

			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 400,
				json: async () => ({
					ok: false,
					error_code: 400,
					description: "Bad Request: STICKERSET_INVALID",
				}),
			} as Response)

			await expect(
				fetchTelegramStickerSources({
					token: validToken,
					setIdentifier: "NonExistentPack",
					apiBaseUrl: testProxy,
				}),
			).rejects.toThrow("未找到该贴图包，请检查贴图包短链或名称是否正确")
		})

		it("对非动画贴图包（视频或静态）给出明确的不支持提示", async () => {
			const mockFetch = vi.mocked(fetch)
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({
					ok: true,
					result: {
						name: "VideoPack",
						title: "Video Pack",
						stickers: [
							{
								file_id: "vid_1",
								file_unique_id: "uv_1",
								width: 512,
								height: 512,
								is_video: true,
							},
						],
					},
				}),
			} as Response)

			await expect(
				fetchTelegramStickerSources({
					token: validToken,
					setIdentifier: "VideoPack",
					apiBaseUrl: testProxy,
				}),
			).rejects.toThrow("包含的是视频贴图（.webm），目前仅支持 TGS 动画贴图")

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({
					ok: true,
					result: {
						name: "StaticPack",
						title: "Static Pack",
						stickers: [
							{
								file_id: "stat_1",
								file_unique_id: "us_1",
								width: 512,
								height: 512,
								is_animated: false,
								is_video: false,
							},
						],
					},
				}),
			} as Response)

			await expect(
				fetchTelegramStickerSources({
					token: validToken,
					setIdentifier: "StaticPack",
					apiBaseUrl: testProxy,
				}),
			).rejects.toThrow("包含的是静态贴图（.webp），目前仅支持 TGS 动画贴图")
		})

		it("网络请求失败时转换为友好提示", async () => {
			const mockFetch = vi.mocked(fetch)
			mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"))

			await expect(
				fetchTelegramStickerSources({
					token: validToken,
					setIdentifier: "HotCherry",
					apiBaseUrl: testProxy,
				}),
			).rejects.toThrow(
				"请求代理地址失败，请检查反代服务是否正常运行或配置了正确的 CORS 跨域响应头。",
			)
		})
	})
})
