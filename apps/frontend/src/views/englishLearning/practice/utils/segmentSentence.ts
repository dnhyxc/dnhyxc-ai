/**
 * 经典句看中写：英文自动分词与逐词比对（保留词后标点供槽间展示）
 */

/** 一句英文切成可作答词槽（保留原大小写；比对用小写） */
export type SentenceWordToken = {
	/** 展示用原词形，如 The / house / I'm */
	raw: string;
	/** 判分用规范化（小写、统一撇号） */
	expect: string;
	/**
	 * 紧跟该词之后、下一词之前的标点（不含空格），如 ! . ? ,
	 * 展示在相邻词槽下划线之间
	 */
	after?: string;
};

/**
 * 从英文原句提取词槽，并记下每个词后的标点。
 * 例：Hello! I'm Sarah. → Hello(+!) / I'm / Sarah(+.)
 */
export function segmentEnglishSentence(english: string): SentenceWordToken[] {
	const re = /([\p{L}\p{N}'']+)([^\p{L}\p{N}\s'']*)/gu;
	const out: SentenceWordToken[] = [];
	let m: RegExpExecArray | null;
	while ((m = re.exec(english)) !== null) {
		const raw = m[1]!;
		const after = (m[2] ?? '').trim();
		out.push({
			raw,
			expect: raw.toLowerCase().replace(/['']/g, "'"),
			...(after ? { after } : {}),
		});
	}
	return out;
}

export type SlotMatchKind = 'empty' | 'prefix' | 'correct' | 'wrong';

/** 规范化用户槽位输入（与 expect 同规则） */
export function normalizeSlotInput(raw: string): string {
	return raw.trim().toLowerCase().replace(/['']/g, "'");
}

/**
 * 逐词实时比对：空 / 正确前缀 / 完全正确 / 错误。
 * 前缀仅用于内部逻辑（如跳词）；UI 只有 correct 才标绿，prefix 视为未完成。
 */
export function matchSlotInput(input: string, expect: string): SlotMatchKind {
	const u = normalizeSlotInput(input);
	if (!u) return 'empty';
	const e = expect.toLowerCase().replace(/['']/g, "'");
	if (!e) return 'wrong';
	if (u === e) return 'correct';
	if (e.startsWith(u)) return 'prefix';
	return 'wrong';
}

/** 全部词槽是否与期望一致 */
export function gradeSentenceSlots(
	inputs: readonly string[],
	tokens: readonly SentenceWordToken[],
): boolean {
	if (tokens.length === 0) return false;
	if (inputs.length !== tokens.length) return false;
	return tokens.every(
		(t, i) => matchSlotInput(inputs[i] ?? '', t.expect) === 'correct',
	);
}

/** 将词槽输入拼回整句（用于错题记录 / 与旧判分兼容） */
export function joinSlotInputs(
	inputs: readonly (string | undefined)[],
): string {
	return inputs
		.map((s) => (s ?? '').trim())
		.filter(Boolean)
		.join(' ');
}
