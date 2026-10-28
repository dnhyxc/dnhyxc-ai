import type { ConfigService } from '@nestjs/config';
import { type DecideInput, decide } from '../../../../utils/glm-decide';
import {
	parseReadingOverride,
	type ReadingOverride,
	resolveAgentManual,
	type StoredProfile,
} from '../../../english-learning/daily-reading.rules';

const NOT_THEME =
	/^(?:一篇|一份|一个|长篇|短篇|中篇|长文|短文|长文章|文章|阅读|设置|配置|档位|默认|生成|自选|帮我|关于|有关|主题|相关|围绕|初级|中级|高级|中高级|难度|篇幅|A2|B1|B2|C1)$/i;

type ReadingSlots = {
	themes?: string[];
	length?: StoredProfile['length'];
};

const READING_TASK =
	'从用户原话抽出英语阅读要写的主题和篇幅，只返回 JSON，不要解释。' +
	'形状 {"themes":["主题"],"length":null}。' +
	'themes 必须是原话里连续出现的文章主题，可多个。不要编造。' +
	'长篇、短篇、设置、配置、生成、一篇、一份不是主题。没点名主题就 themes 为 null。' +
	'length 只能是 short、medium、long 或 null。短是 short，中是 medium，长或长文是 long。没说篇幅就 null。';

/** 规则已经抽出合法主题，或原话里没有可当主题的词，就不必再问模型。 */
export function readingThemesTrusted(
	userText: string,
	said: ReadingOverride,
): boolean {
	const text = userText.trim();
	if (said.themes?.length)
		return said.themes.every((theme) => text.includes(theme));
	const rest = text
		.replace(
			/请|帮我|给我|帮忙|生成|自选|写|来|一篇|一份|一个|长篇|短篇|中篇|长文|短文|长文章|文章|阅读|主题|关于|有关|相关|围绕|的|吧|了|啊/g,
			'',
		)
		.replace(/A2|B1|B2|C1|初级|中级|中高级|高级/gi, '')
		.replace(/[，。！？、\s「」『』"“”]/g, '');
	return !/[\u4e00-\u9fa5A-Za-z]{2,}/.test(rest);
}

function trimPiece(raw: string): string {
	let t = raw
		.trim()
		.replace(/[「」『』"“”'']/g, '')
		.trim();
	t = t.replace(/^(?:关于|有关)/, '').trim();
	t = t
		.replace(/(?:的)?(?:长篇|短篇|中篇|长文|短文|长文章)[\s\S]*$/, '')
		.trim();
	t = t.replace(/的$/, '').trim();
	return t;
}

function takeThemes(text: string, raw: unknown): string[] | undefined {
	if (!Array.isArray(raw)) return undefined;
	const list: string[] = [];
	for (const item of raw) {
		if (typeof item !== 'string') continue;
		const theme = trimPiece(item);
		if (theme.length < 2 || theme.length > 16 || NOT_THEME.test(theme))
			continue;
		if (!text.includes(theme) || list.includes(theme)) continue;
		list.push(theme);
	}
	return list.length ? list : undefined;
}

function takeLength(
	text: string,
	raw: unknown,
): StoredProfile['length'] | undefined {
	if (
		raw === 'long' &&
		/长篇|长文|长文章|写长|长一点|长一些|篇幅长|偏长/.test(text)
	) {
		return 'long';
	}
	if (
		raw === 'short' &&
		/短篇|短文|写短|短一点|短一些|篇幅短|偏短/.test(text)
	) {
		return 'short';
	}
	if (raw === 'medium' && /中篇|中等篇幅|不长不短/.test(text)) return 'medium';
	return undefined;
}

function acceptReadingSlots(
	userText: string,
	raw: unknown,
): ReadingSlots | null {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
	const body = raw as { themes?: unknown; length?: unknown };
	const themes = takeThemes(userText, body.themes);
	const length = takeLength(userText, body.length);
	if (!themes && !length) return null;
	return { themes, length };
}

/**
 * 规则先认。原话里还有没认出来的主题或篇幅时，才问一次 flash。
 * 模型给的主题不在原话里就丢掉，失败则沿用规则和已保存档。
 */
export async function resolveAgentManualAsk(
	config: ConfigService,
	saved: { themes: string[]; profile: StoredProfile },
	userText: string,
	complete?: DecideInput<ReadingSlots>['complete'],
): Promise<{ themes: string[]; profile: StoredProfile }> {
	const said = parseReadingOverride(userText, saved.themes);
	const ruled = resolveAgentManual(saved, userText);
	if (readingThemesTrusted(userText, said)) return ruled;
	const flashed = await decide(config, {
		task: READING_TASK,
		input: userText,
		parse: (raw) =>
			raw && typeof raw === 'object' && !Array.isArray(raw)
				? (raw as ReadingSlots)
				: null,
		accept: (_value, input) => acceptReadingSlots(input, _value),
		complete,
	});
	if (!flashed) return ruled;
	return {
		themes: said.themes?.length
			? ruled.themes
			: (flashed.themes ?? ruled.themes),
		profile: {
			...ruled.profile,
			length: said.length
				? ruled.profile.length
				: (flashed.length ?? ruled.profile.length),
		},
	};
}
