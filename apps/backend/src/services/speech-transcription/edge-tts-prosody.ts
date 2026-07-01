/** MiniMax 语速 0.5–2 → Edge rate 如 +50% / -50% */
export function edgeRateFromSpeed(speed: number): string {
	const pct = Math.round((speed - 1) * 100);
	return pct >= 0 ? `+${pct}%` : `${pct}%`;
}

/** MiniMax 音量 0.01–10（5 为标准）→ Edge volume 百分比 */
export function edgeVolumeFromVol(vol: number): string {
	const pct = Math.round(((vol - 5) / 5) * 100);
	return pct >= 0 ? `+${pct}%` : `${pct}%`;
}

/** MiniMax 音高 -12–12 → Edge pitch 如 +10Hz */
export function edgePitchFromPitch(pitch: number): string {
	const hz = Math.round(pitch * 5);
	return hz >= 0 ? `+${hz}Hz` : `${hz}Hz`;
}
