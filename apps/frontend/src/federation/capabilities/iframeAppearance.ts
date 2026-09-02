import type { HostIframeAppearance } from '@dnhyxc-ai/federation-kit';
import {
	ACCENT_BOOTSTRAP_STORAGE_KEY,
	ACCENT_COLORS,
	type AccentId,
	readWindowChromeThemeSync,
} from '@/hooks/theme';

/**
 * 同步强调色；Host 无 `.dark` 时同步表面 token（theme-black / theme-orange 等彩色主题都在 body 上）。
 * 勿在「无 .dark」时给 iframe 强加 `.dark`，否则会误触 dark:border-input 等工具类。
 */
function accentVarsFromHex(hex: string): Record<string, string> {
	return {
		'--brand-accent': hex,
		'--brand-accent-soft': `color-mix(in oklch, ${hex} 55%, white)`,
		'--brand-accent-light': `color-mix(in oklch, ${hex} 75%, white)`,
		'--brand-accent-dark': `color-mix(in oklch, ${hex} 85%, black)`,
	};
}

/**
 * 主题类挂在 body，优先读 body 的计算值（与 applyThemeVariables 一致）。
 * 只用 getComputedStyle：inline 上可能仍是 `var(--x)`，写进 iframe 会断链，
 * 导致 border-theme/10 的 color-mix 拿到无效色。
 */
function readHostVar(name: string): string {
	const body = document.body;
	const root = document.documentElement;
	const raw =
		(body ? getComputedStyle(body).getPropertyValue(name).trim() : '') ||
		getComputedStyle(root).getPropertyValue(name).trim();
	if (!raw || raw.includes('var(')) return '';
	return raw;
}

function resolveAccentId(raw: string | null | undefined): AccentId | null {
	if (!raw) return null;
	return ACCENT_COLORS.some((c) => c.id === raw) ? (raw as AccentId) : null;
}

function readStoredAccentHex(): string | null {
	try {
		const fromBootstrap = resolveAccentId(
			localStorage.getItem(ACCENT_BOOTSTRAP_STORAGE_KEY),
		);
		let fromSettings: AccentId | null = null;
		const j = localStorage.getItem('dnhyxc_settings_json');
		if (j) {
			fromSettings = resolveAccentId(
				(JSON.parse(j) as { accentColor?: string }).accentColor,
			);
		}
		const id = fromBootstrap ?? fromSettings;
		if (!id) return null;
		return ACCENT_COLORS.find((c) => c.id === id)?.hex ?? null;
	} catch {
		return null;
	}
}

function pickVars(names: string[]): Record<string, string> {
	const out: Record<string, string> = {};
	for (const name of names) {
		const v = readHostVar(name);
		if (v) out[name] = v;
	}
	return out;
}

function hostHasDarkClass(): boolean {
	return (
		document.body.classList.contains('dark') ||
		document.documentElement.classList.contains('dark')
	);
}

/**
 * Host chrome 主题：优先看 body.theme-black / body.dark（主站暗色挂在 body）；
 * 再与 changeTheme 的 bootstrap/settings 对齐（black→dark）。
 */
export function readHostChromeTheme(): 'light' | 'dark' {
	try {
		if (
			document.body.classList.contains('theme-black') ||
			document.body.classList.contains('dark') ||
			document.documentElement.classList.contains('dark')
		) {
			return 'dark';
		}
		return readWindowChromeThemeSync();
	} catch {
		return 'light';
	}
}

/** 读取当前 Host 主题 + 强调色 +（必要时）表面 token，供 iframe init / appearance 下发 */
export function readHostIframeAppearance(
	theme: 'light' | 'dark' = readHostChromeTheme(),
): HostIframeAppearance {
	const hex =
		readHostVar('--brand-accent') ||
		readStoredAccentHex() ||
		ACCENT_COLORS.find((c) => c.id === 'teal')!.hex;

	const darkClass = hostHasDarkClass();
	const cssVars: Record<string, string> = {
		...accentVarsFromHex(hex),
		// Select 等用 border-theme/*，靠的是 --theme-color，不是 --border
		...pickVars(['--theme-color', '--border', '--theme-border', '--ring']),
	};

	// 有真实 .dark：iframe 也加 .dark，本地 :root/.dark 管背景；只补边框/主题色
	// 无 .dark：彩色主题（orange/green…）与 theme-black 都在 body.theme-* 上，iframe 无对应类，须下发表面 token
	if (!darkClass) {
		Object.assign(
			cssVars,
			pickVars([
				'--background',
				'--foreground',
				'--card',
				'--popover',
				'--muted',
				'--secondary',
				'--border',
				'--input',
				'--ring',
				'--primary',
				'--theme-background',
				'--theme-foreground',
				'--theme-card',
				'--theme-muted',
				'--theme-border',
				'--theme-secondary',
				'--theme-textcolor',
				'--theme-color',
			]),
		);
	} else {
		const input = readHostVar('--input');
		if (input) cssVars['--input'] = input;
	}

	return { theme, darkClass, cssVars };
}
