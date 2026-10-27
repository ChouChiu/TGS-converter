import type { SVGProps } from "react"
import { useId } from "react"
import { cn } from "@/shared/lib/utils"

export interface LogoProps extends SVGProps<SVGSVGElement> {
	className?: string
}

export function Logo({ className, ...props }: LogoProps) {
	const baseId = useId()
	const bgId = `${baseId}-bg`
	const loopId = `${baseId}-loop`
	const shadowId = `${baseId}-shadow`

	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 240 240"
			fill="none"
			role="img"
			aria-label="TGS Converter"
			className={cn("size-7 shrink-0", className)}
			{...props}
		>
			<title>TGS Converter</title>
			<defs>
				<linearGradient
					id={bgId}
					x1="120"
					y1="240"
					x2="120"
					y2="0"
					gradientUnits="userSpaceOnUse"
				>
					<stop offset="0%" stopColor="#1d93d2" />
					<stop offset="100%" stopColor="#38b0e3" />
				</linearGradient>
				<linearGradient
					id={loopId}
					x1="40"
					y1="40"
					x2="200"
					y2="200"
					gradientUnits="userSpaceOnUse"
				>
					<stop offset="0%" stopColor="#e0f2fe" />
					<stop offset="100%" stopColor="#7dd3fc" />
				</linearGradient>
				<filter id={shadowId} x="-20%" y="-20%" width="140%" height="140%">
					<feDropShadow
						dx="0"
						dy="6"
						stdDeviation="6"
						floodColor="#0284c7"
						floodOpacity="0.4"
					/>
				</filter>
			</defs>

			{/* Base Squircle with Official Telegram Gradient */}
			<rect width="240" height="240" rx="60" fill={`url(#${bgId})`} />
			<rect
				width="234"
				height="234"
				x="3"
				y="3"
				rx="57"
				stroke="white"
				strokeOpacity="0.25"
				strokeWidth="4"
			/>

			{/* Dynamic Conversion Flow Ring (Non-overlapping with Official Plane) */}
			<path
				d="M 148 38 C 188 44 212 76 212 120 C 212 164 186 200 148 206"
				stroke={`url(#${loopId})`}
				strokeWidth="9"
				strokeLinecap="round"
			/>
			<path
				d="M 162 194 L 148 206 L 164 214"
				fill="none"
				stroke={`url(#${loopId})`}
				strokeWidth="9"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>

			<path
				d="M 92 202 C 52 196 28 164 28 120 C 28 76 54 40 92 34"
				stroke={`url(#${loopId})`}
				strokeWidth="9"
				strokeLinecap="round"
			/>
			<path
				d="M 78 46 L 92 34 L 76 26"
				fill="none"
				stroke={`url(#${loopId})`}
				strokeWidth="9"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>

			{/* Official Telegram Paper Plane Paths */}
			<g filter={`url(#${shadowId})`}>
				<path
					d="M81.229,128.772l14.237,39.406s1.78,3.687,3.686,3.687,30.255-29.492,30.255-29.492l31.525-60.89L81.737,118.6Z"
					fill="#c8daea"
				/>
				<path
					d="M100.106,138.878l-2.733,29.046s-1.144,8.9,7.754,0,17.415-15.763,17.415-15.763"
					fill="#a9c6d8"
				/>
				<path
					d="M81.486,130.178,52.2,120.636s-3.5-1.42-2.373-4.64c.232-.664.7-1.229,2.1-2.2,6.489-4.523,120.106-45.36,120.106-45.36s3.208-1.081,5.1-.362a2.766,2.766,0,0,1,1.885,2.055,9.357,9.357,0,0,1,.254,2.585c-.009.752-.1,1.449-.169,2.542-.692,11.165-21.4,94.493-21.4,94.493s-1.239,4.876-5.678,5.043A8.13,8.13,0,0,1,146.1,172.5c-8.711-7.493-38.819-27.727-45.472-32.177a1.27,1.27,0,0,1-.546-.9c-.093-.469.417-1.05.417-1.05s52.426-46.6,53.821-51.492c.108-.379-.3-.566-.848-.4-3.482,1.281-63.844,39.4-70.506,43.607A3.21,3.21,0,0,1,81.486,130.178Z"
					fill="#fff"
				/>
			</g>
		</svg>
	)
}
