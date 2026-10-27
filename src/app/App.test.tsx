import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import App from "./App"

describe("应用首页交互", () => {
	beforeEach(() => {
		localStorage.clear()
	})

	it("默认渲染上传区域与格式控制，开始按钮在无文件时禁用", () => {
		render(<App />)
		expect(screen.getByRole("button", { name: /拖放 TGS/ })).toBeEnabled()
		expect(screen.getByRole("button", { name: "开始转换" })).toBeDisabled()
		expect(
			screen.getByRole("combobox", { name: /输出格式/i }),
		).toBeInTheDocument()
	})

	it("支持切换至 Bot API 获取贴图标签页并渲染对应输入框", () => {
		render(<App />)
		const botTab = screen.getByRole("tab", { name: /Bot API/ })
		expect(botTab).toBeInTheDocument()

		fireEvent.click(botTab)
		expect(screen.getByLabelText(/API 反向代理地址/i)).toBeInTheDocument()
		expect(screen.getByLabelText(/Bot Token/i)).toBeInTheDocument()
		expect(screen.getByLabelText(/贴图包短链或名称/i)).toBeInTheDocument()
		expect(screen.getByRole("button", { name: "获取贴图" })).toBeInTheDocument()
	})

	it("支持切换中英文语言并即时更新界面文案", () => {
		render(<App />)
		const langButton = screen.getByRole("button", { name: /语言/i })
		expect(langButton).toBeInTheDocument()

		// 切换到英文
		fireEvent.click(langButton)
		expect(screen.getByRole("button", { name: /Drop TGS/ })).toBeInTheDocument()
		expect(
			screen.getByRole("button", { name: "Start Conversion" }),
		).toBeDisabled()

		// 切换回中文
		fireEvent.click(langButton)
		expect(screen.getByRole("button", { name: /拖放 TGS/ })).toBeInTheDocument()
		expect(screen.getByRole("button", { name: "开始转换" })).toBeDisabled()
	})
})
