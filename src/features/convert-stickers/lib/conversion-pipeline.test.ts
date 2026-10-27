import { describe, expect, it, vi } from "vitest"
import zhCN from "@/shared/locales/zh-CN.json"
import type { ConversionSource } from "@/shared/model/types"
import { runConversionPipeline } from "./conversion-pipeline"

describe("runConversionPipeline", () => {
	it("在 AbortSignal 已处于中止状态时直接退出并返回空结果", async () => {
		const controller = new AbortController()
		controller.abort()

		const dummySource: ConversionSource = {
			id: "s1",
			name: "test.tgs",
			path: "test.tgs",
			bytes: new Uint8Array([1, 2, 3]),
		}

		const onItemStatus = vi.fn()
		const onItemComplete = vi.fn()
		const onProgress = vi.fn()

		const result = await runConversionPipeline({
			sources: [dummySource],
			format: "webp",
			signal: controller.signal,
			t: zhCN,
			onItemStatus,
			onItemComplete,
			onProgress,
		})

		expect(result.completed).toEqual([])
		expect(result.archive).toBeNull()
		expect(onItemComplete).not.toHaveBeenCalled()
	})

	it("在源列表为空时安全返回空结果", async () => {
		const controller = new AbortController()

		const result = await runConversionPipeline({
			sources: [],
			format: "webp",
			signal: controller.signal,
			t: zhCN,
			onItemStatus: vi.fn(),
			onItemComplete: vi.fn(),
			onProgress: vi.fn(),
		})

		expect(result.completed).toEqual([])
		expect(result.archive).toBeNull()
		expect(result.failures).toEqual([])
	})
})
