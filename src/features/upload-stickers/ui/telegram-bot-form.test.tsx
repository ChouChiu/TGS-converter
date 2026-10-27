import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { TelegramBotForm } from "./telegram-bot-form"

describe("TelegramBotForm 组件", () => {
	beforeEach(() => {
		localStorage.clear()
	})

	it("渲染表单元素与安全提示", () => {
		render(
			<TelegramBotForm
				sources={[]}
				disabled={false}
				loading={false}
				onFetch={vi.fn()}
			/>,
		)

		const proxyInput = screen.getByLabelText(/API 反向代理地址/i)
		expect(proxyInput).toBeInTheDocument()
		expect(proxyInput).toHaveAttribute("type", "password")

		const toggleProxyBtn = screen.getByRole("button", { name: "显示代理地址" })
		fireEvent.click(toggleProxyBtn)
		expect(proxyInput).toHaveAttribute("type", "text")

		const tokenInput = screen.getByLabelText(/Bot Token/i)
		expect(tokenInput).toBeInTheDocument()
		expect(tokenInput).toHaveAttribute("type", "password")

		expect(screen.getByLabelText(/贴图包短链或名称/i)).toBeInTheDocument()
		expect(screen.getByRole("button", { name: "获取贴图" })).toBeDisabled()
		expect(
			screen.getByText(/Token 与请求仅通过你提供的反向代理/),
		).toBeInTheDocument()
		expect(screen.getByRole("link", { name: /获取 Token/ })).toHaveAttribute(
			"href",
			"https://t.me/BotFather",
		)
	})

	it("验证非法的反向代理地址并阻止提交", async () => {
		const onFetch = vi.fn()
		render(
			<TelegramBotForm
				sources={[]}
				disabled={false}
				loading={false}
				onFetch={onFetch}
			/>,
		)

		const proxyInput = screen.getByLabelText(/API 反向代理地址/i)
		const tokenInput = screen.getByLabelText(/Bot Token/i)
		const setInput = screen.getByLabelText(/贴图包短链或名称/i)

		fireEvent.change(proxyInput, { target: { value: "invalid-proxy-url" } })
		fireEvent.change(tokenInput, {
			target: { value: "123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ_1234567" },
		})
		fireEvent.change(setInput, { target: { value: "HotCherry" } })

		const submitBtn = screen.getByRole("button", { name: "获取贴图" })
		expect(submitBtn).toBeEnabled()

		fireEvent.click(submitBtn)
		expect(onFetch).not.toHaveBeenCalled()
		expect(
			screen.getByText(/代理地址必须以 http:\/\/ 或 https:\/\/ 开头/),
		).toBeInTheDocument()
	})

	it("验证非法的 Bot Token 并阻止提交", async () => {
		const onFetch = vi.fn()
		render(
			<TelegramBotForm
				sources={[]}
				disabled={false}
				loading={false}
				onFetch={onFetch}
			/>,
		)

		const proxyInput = screen.getByLabelText(/API 反向代理地址/i)
		const tokenInput = screen.getByLabelText(/Bot Token/i)
		const setInput = screen.getByLabelText(/贴图包短链或名称/i)

		fireEvent.change(proxyInput, {
			target: { value: "https://tg.yourdomain.com" },
		})
		fireEvent.change(tokenInput, { target: { value: "invalid-token" } })
		fireEvent.change(setInput, { target: { value: "HotCherry" } })

		const submitBtn = screen.getByRole("button", { name: "获取贴图" })
		expect(submitBtn).toBeEnabled()

		fireEvent.click(submitBtn)
		expect(onFetch).not.toHaveBeenCalled()
		expect(screen.getByText(/Bot Token 格式不正确/)).toBeInTheDocument()
	})

	it("合法输入时成功触发 onFetch 并保存 Token 与代理至 localStorage", async () => {
		const onFetch = vi.fn().mockResolvedValue(undefined)
		render(
			<TelegramBotForm
				sources={[]}
				disabled={false}
				loading={false}
				onFetch={onFetch}
			/>,
		)

		const validProxy = "https://tg.yourdomain.com"
		const validToken = "123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ_1234567"
		const proxyInput = screen.getByLabelText(/API 反向代理地址/i)
		const tokenInput = screen.getByLabelText(/Bot Token/i)
		const setInput = screen.getByLabelText(/贴图包短链或名称/i)

		fireEvent.change(proxyInput, { target: { value: validProxy } })
		fireEvent.change(tokenInput, { target: { value: validToken } })
		fireEvent.change(setInput, {
			target: { value: "https://t.me/addstickers/HotCherry" },
		})

		const submitBtn = screen.getByRole("button", { name: "获取贴图" })
		fireEvent.click(submitBtn)

		expect(onFetch).toHaveBeenCalledWith(
			validToken,
			"https://t.me/addstickers/HotCherry",
			validProxy,
		)

		expect(localStorage.getItem("tgs_converter_bot_token")).toBe(validToken)
		expect(localStorage.getItem("tgs_converter_api_base")).toBe(validProxy)
	})

	it("从 localStorage 恢复已保存的 Token 与代理地址", () => {
		const savedToken = "987654321:ABCdefGhIJKlmNoPQRsTUVwxyZ_7654321"
		const savedProxy = "https://my-tg-worker.example.workers.dev"
		localStorage.setItem("tgs_converter_bot_token", savedToken)
		localStorage.setItem("tgs_converter_api_base", savedProxy)

		render(
			<TelegramBotForm
				sources={[]}
				disabled={false}
				loading={false}
				onFetch={vi.fn()}
			/>,
		)

		const tokenInput = screen.getByLabelText(/Bot Token/i) as HTMLInputElement
		const proxyInput = screen.getByLabelText(
			/API 反向代理地址/i,
		) as HTMLInputElement
		expect(tokenInput.value).toBe(savedToken)
		expect(proxyInput.value).toBe(savedProxy)
	})

	it("有已加载贴图时显示贴图统计信息", () => {
		const sources = [
			{
				id: "1",
				name: "test_01.tgs",
				path: "test/test_01.tgs",
				bytes: new Uint8Array([1, 2, 3]),
			},
			{
				id: "2",
				name: "test_02.tgs",
				path: "test/test_02.tgs",
				bytes: new Uint8Array([4, 5, 6]),
			},
		]

		render(
			<TelegramBotForm
				sources={sources}
				disabled={false}
				loading={false}
				onFetch={vi.fn()}
			/>,
		)

		expect(screen.getByText("已添加 2 个贴图")).toBeInTheDocument()
		expect(screen.getByRole("button", { name: "重新获取" })).toBeInTheDocument()
	})
})
