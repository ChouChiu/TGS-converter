import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Logo } from "./logo"

describe("Logo 组件", () => {
	it("正确渲染 SVG 及其无障碍属性", () => {
		render(<Logo data-testid="app-logo" />)
		const svg = screen.getByTestId("app-logo")
		expect(svg).toBeInTheDocument()
		expect(svg).toHaveAttribute("role", "img")
		expect(svg).toHaveAttribute("aria-label", "TGS Converter")
		expect(screen.getByText("TGS Converter")).toBeInTheDocument()
	})

	it("支持应用自定义 className 与尺寸类", () => {
		render(<Logo data-testid="app-logo-custom" className="size-12 shadow-lg" />)
		const svg = screen.getByTestId("app-logo-custom")
		expect(svg.getAttribute("class")).toContain("size-12")
		expect(svg.getAttribute("class")).toContain("shadow-lg")
	})
})
