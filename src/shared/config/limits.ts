export const MIB = 1024 * 1024

export const LIMITS = {
	maxTgsBytes: 10 * MIB,
	maxZipBytes: 100 * MIB,
	maxExtractedBytes: 100 * MIB,
	maxInflatedJsonBytes: 64 * MIB,
	maxDimension: 2048,
	maxFrames: 600,
	maxFrameRate: 120,
	maxFrameBufferBytes: 256 * MIB,
	maxOutputBytes: 512 * MIB,
} as const
