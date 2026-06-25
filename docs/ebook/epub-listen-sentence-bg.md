# EPUB「听当前」逐句播放背景

## 延伸阅读

- [EPUB 引用「听当前」](epub-quote-listen.md) — 三入口朗读、TTS 复用与本机分句修复
- [云端长文分段流水线](../english/cloud-tts-segment-pipeline.md) — 云端按节奏段合成与预取
- [EPUB 用户划线实现](epub-user-highlight-impl.md) — marks-pane 批注与用户高亮（与本播放层解耦）

## 1. 背景与目标

**用户视角**：EPUB「听当前」朗读时，希望当前正在读的**那一句话**在正文上有淡黄色底提示；一句播完底色消失，下一句再亮；播放结束或点停止后底色全部清除；播放过程中手动划线、想法下划线不被清除或误删。

**目标**：

1. **逐句高亮**：与 TTS 节奏段对齐，按「句」显示/清除 `rgba(251, 231, 128, 0.28)` 背景，句内逗号子段不重复叠色。
2. **与划线解耦**：不调用 `rend.annotations`、不写 marks-pane 用户批注；独立 HTML 浮层 `#moke-epub-listen-overlay`。
3. **TTS 回调**：在共享 `englishTts.ts` 增加 `onCadenceChunk`，本机与云端分段播放均可驱动 UI。
4. **生命周期可靠**：停止、播完、离开阅读页均清除播放层；`overlayEpoch` 防止 relayout 竞态重绘。

**未纳入**：`epubUserHighlights.ts` 本轮仅缩进/格式调整，与播放背景无关。

## 2. 改动范围

| 路径 | 说明 |
| ---- | ---- |
| `apps/frontend/src/utils/englishTts.ts` | `TtsCadenceChunkEvent`、`onCadenceChunk`、句索引与 emit |
| `apps/frontend/src/views/ebook/utils/epubListenSegmentOverlay.ts` | **新增**：播放浮层会话、句 DOM 映射、绘制/清除 |
| `apps/frontend/src/views/ebook/hooks/useEbookQuoteListen.ts` | 接入 overlay + `cfiRange` + 节奏回调 |
| `apps/frontend/src/views/ebook/read.tsx` | 传入 `getRendition`、三处 `cfiRange` |

## 3. 实现思路

1. **数据流**：`toggleListen(text, key, cfiRange)` → `stripMarkdownForTts` 得 plain → `beginEpubListenOverlaySession` 预解析每句 `Range` → `playEnglishPreferred({ onCadenceChunk })` → `start` 时 `showEpubListenSentence(i)`，`end` 且 `isLastInSentence` 时 `clearEpubListenSentenceOverlay` → `finally` 时 `clearEpubListenSegmentOverlay`。
2. **句界**：与 TTS 相同正则 `(?<=[.!?。！？])\s*` 切句；TTS 子句（逗号段）共享同一句索引，句末最后一个 chunk 的 `end` 才清底色。
3. **DOM 映射**：`locateSentenceInRange` 在选区 `Range` 内按去空白紧凑串 `indexOf` 定位子句（对齐 `epubUserHighlights` 的 quote 定位思路）。
4. **绘制**：`getAccurateRangeLineClientRects` → iframe `body` 下固定定位 `div` 块；`pointer-events: none`；`z-index: 0` 置于正文之下、不挡点击。
5. **清除范围**：仅 `#moke-epub-listen-overlay` 及遗留 `moke-epub-listen-seg*`；**不**选择 `moke-epub-user-hl` / `moke-epub-thought-ul`。
6. **权衡**：不用 epub 批注槽位，避免与用户划线 sync 互相 purge；代价是同区域可能与用户底色视觉叠色（数据仍独立）。

## 4. 关键代码对比与注释

### 4.1 `useEbookQuoteListen`（`apps/frontend/src/views/ebook/hooks/useEbookQuoteListen.ts`）

**对比范围**：完整 hook（约 L1–L94）。

**改动前** · `apps/frontend/src/views/ebook/hooks/useEbookQuoteListen.ts`（基线）

```typescript
// 朗读失败时 Toast 提示
import { Toast } from '@ui/sonner';
// React 状态与副作用
import { useCallback, useEffect, useState } from 'react';
// 英语学习 TTS 栈
import {
	isEnglishPlaybackAvailable,
	playEnglishPreferred,
	stopAllEnglishPlayback,
	warmupEnglishTtsVoices,
} from '@/utils/englishTts';

/** 电子书引用/选区朗读：复用英语学习 TTS（本机 / 云端偏好） */
export function useEbookQuoteListen(t: (key: string) => string) {
	// 当前播放会话 key（popbar / thought-list / thought-dialog）
	const [playingKey, setPlayingKey] = useState<string | null>(null);

	// 挂载预热 voices；卸载时停止朗读
	useEffect(() => {
		warmupEnglishTtsVoices();
		return () => stopAllEnglishPlayback();
	}, []);

	// 切换播放/停止
	const toggleListen = useCallback(
		async (text: string, key: string) => {
			const trimmed = text.trim();
			if (!trimmed) return;
			if (playingKey === key) {
				stopAllEnglishPlayback();
				setPlayingKey(null);
				return;
			}
			if (!isEnglishPlaybackAvailable()) {
				Toast({
					type: 'warning',
					title: t('englishLearning.tts.unsupported'),
				});
				return;
			}
			stopAllEnglishPlayback();
			setPlayingKey(key);
			try {
				await playEnglishPreferred(trimmed);
			} catch {
				Toast({
					type: 'warning',
					title: t('englishLearning.tts.unsupported'),
				});
			} finally {
				setPlayingKey((k) => (k === key ? null : k));
			}
		},
		[playingKey, t],
	);

	const listenLabel = useCallback(
		(key: string, defaultLabel: string) =>
			playingKey === key ? t('englishLearning.tts.stop') : defaultLabel,
		[playingKey, t],
	);

	return { toggleListen, playingKey, listenLabel };
}
```

**改动后** · 同文件（当前，约 L1–L94）

```typescript
// 朗读失败时 Toast 提示
import { Toast } from '@ui/sonner';
// epub.js 渲染实例类型
import type { Rendition } from 'epubjs';
// React 状态与副作用
import { useCallback, useEffect, useState } from 'react';
// 英语学习 TTS 栈（含 stripMarkdown 与节奏回调）
import {
	isEnglishPlaybackAvailable,
	playEnglishPreferred,
	stopAllEnglishPlayback,
	stripMarkdownForTts,
	warmupEnglishTtsVoices,
} from '@/utils/englishTts';
// 播放背景浮层：会话、逐句显示、清除
import {
	beginEpubListenOverlaySession,
	clearEpubListenSegmentOverlay,
	clearEpubListenSentenceOverlay,
	showEpubListenSentence,
} from '../utils/epubListenSegmentOverlay';

/** 电子书引用/选区朗读：复用英语学习 TTS（本机 / 云端偏好） */
export function useEbookQuoteListen(
	t: (key: string) => string,
	getRendition?: () => Rendition | null,
) {
	// 当前播放会话 key（popbar / thought-list / thought-dialog）
	const [playingKey, setPlayingKey] = useState<string | null>(null);

	// 挂载预热；卸载时停止 TTS 并拆除播放浮层
	useEffect(() => {
		warmupEnglishTtsVoices();
		return () => {
			stopAllEnglishPlayback();
			clearEpubListenSegmentOverlay();
		};
	}, []);

	// 切换播放/停止；可选 cfiRange 驱动正文逐句底色
	const toggleListen = useCallback(
		async (text: string, key: string, cfiRange?: string) => {
			const trimmed = text.trim();
			if (!trimmed) return;
			if (playingKey === key) {
				stopAllEnglishPlayback();
				clearEpubListenSegmentOverlay();
				setPlayingKey(null);
				return;
			}
			if (!isEnglishPlaybackAvailable()) {
				Toast({
					type: 'warning',
					title: t('englishLearning.tts.unsupported'),
				});
				return;
			}
			stopAllEnglishPlayback();
			clearEpubListenSegmentOverlay();
			setPlayingKey(key);

			const rend = getRendition?.() ?? null;
			const cfi = cfiRange?.trim();
			const plain = stripMarkdownForTts(trimmed);
			if (rend && cfi && plain) {
				beginEpubListenOverlaySession(rend, cfi, plain);
			}

			try {
				await playEnglishPreferred(trimmed, {
					onCadenceChunk: (event) => {
						if (!rend || !cfi) return;
						if (event.phase === 'start') {
							showEpubListenSentence(event.sentenceIndex);
							return;
						}
						if (event.isLastInSentence) {
							clearEpubListenSentenceOverlay();
						}
					},
				});
			} catch {
				Toast({
					type: 'warning',
					title: t('englishLearning.tts.unsupported'),
				});
			} finally {
				clearEpubListenSegmentOverlay();
				setPlayingKey((k) => (k === key ? null : k));
			}
		},
		[getRendition, playingKey, t],
	);

	const listenLabel = useCallback(
		(key: string, defaultLabel: string) =>
			playingKey === key ? t('englishLearning.tts.stop') : defaultLabel,
		[playingKey, t],
	);

	return { toggleListen, playingKey, listenLabel };
}
```

**变更摘要**：新增 `getRendition` 与第三参 `cfiRange`；朗读前后维护 overlay 会话；`onCadenceChunk` 驱动逐句底色。

---

### 4.2 `TtsCadenceChunkEvent` 与 `emitCadenceChunk`（`apps/frontend/src/utils/englishTts.ts`）

**对比范围**：纯新增（基线无对应符号）。

**改动后** · `apps/frontend/src/utils/englishTts.ts`（当前，约 L432–L519）

```typescript
/** TTS 节奏分段播放事件（供电子书逐句高亮等） */
export type TtsCadenceChunkEvent = {
	phase: 'start' | 'end';
	index: number;
	text: string;
	sentenceIndex: number;
	isLastInSentence: boolean;
};

export type PlayEnglishPreferredOptions = {
	/** 为 true 时强制本机 Web Speech（如本机音色设置试听）；省略时会员走云端、非会员走本机 */
	preferLocal?: boolean;
	/** 本机朗读时透传给 Web Speech */
	speak?: SpeakEnglishOptions;
	/** 每个 TTS 节奏段开始/结束（句内子句不重复触发句末） */
	onCadenceChunk?: (event: TtsCadenceChunkEvent) => void;
};

type CadencePlaybackHooks = Pick<PlayEnglishPreferredOptions, 'onCadenceChunk'>;

function buildSentenceOffsetSpans(
	plain: string,
): Array<{ start: number; end: number }> {
	const trimmed = plain.trim();
	if (!trimmed) return [];
	const parts = trimmed
		.split(/(?<=[.!?。！？])\s*/)
		.map((s) => s.trim())
		.filter(Boolean);
	if (!parts.length) return [{ start: 0, end: trimmed.length }];

	const spans: Array<{ start: number; end: number }> = [];
	let searchFrom = 0;
	for (const part of parts) {
		const idx = trimmed.indexOf(part, searchFrom);
		if (idx < 0) continue;
		spans.push({ start: idx, end: idx + part.length });
		searchFrom = idx + part.length;
	}
	return spans.length > 0 ? spans : [{ start: 0, end: trimmed.length }];
}

function sentenceIndexAtOffset(
	spans: Array<{ start: number; end: number }>,
	offset: number,
): number {
	for (let i = 0; i < spans.length; i += 1) {
		const span = spans[i]!;
		if (offset >= span.start && offset < span.end) return i;
	}
	return Math.max(0, spans.length - 1);
}

function buildChunkOffsetMeta(plain: string, chunks: TtsCadenceChunk[]) {
	let searchPos = 0;
	return chunks.map((chunk) => {
		const idx = plain.indexOf(chunk.text, searchPos);
		const start = idx >= 0 ? idx : searchPos;
		const end = start + chunk.text.length;
		searchPos = end;
		return { start, end };
	});
}

function emitCadenceChunk(
	hooks: CadencePlaybackHooks | undefined,
	plain: string,
	chunks: TtsCadenceChunk[],
	index: number,
	phase: TtsCadenceChunkEvent['phase'],
): void {
	const onCadenceChunk = hooks?.onCadenceChunk;
	if (!onCadenceChunk) return;

	const chunk = chunks[index];
	if (!chunk) return;

	const sentences = buildSentenceOffsetSpans(plain);
	const offsets = buildChunkOffsetMeta(plain, chunks);
	const { start } = offsets[index] ?? { start: 0 };
	const sentenceIndex = sentenceIndexAtOffset(sentences, start);
	const nextStart = offsets[index + 1]?.start;
	const isLastInSentence =
		index === chunks.length - 1 ||
		(nextStart !== undefined &&
			sentenceIndexAtOffset(sentences, nextStart) !== sentenceIndex);

	onCadenceChunk({
		phase,
		index,
		text: chunk.text,
		sentenceIndex,
		isLastInSentence,
	});
}
```

**变更摘要**：导出节奏事件类型；`playEnglishPreferred` / 本机 / 云端分段循环在每段前后 `emitCadenceChunk`（`speakEnglishTextWithGeneration`、`playCloudTtsCadenceSegments` 内插入，此处略）。

---

### 4.3 播放浮层导出 API（`apps/frontend/src/views/ebook/utils/epubListenSegmentOverlay.ts`）

**对比范围**：纯新增模块；下列为四个导出符号（约 L224–L286）。

**改动后** · `apps/frontend/src/views/ebook/utils/epubListenSegmentOverlay.ts`（当前）

```typescript
/** 朗读开始前：按 TTS plain 文本预解析各句 DOM 范围 */
export function beginEpubListenOverlaySession(
	rend: Rendition,
	cfiRange: string,
	plainText: string,
): void {
	const key = cfiRange.trim();
	const plain = plainText.trim();
	if (!key || !plain) return;

	clearEpubListenSegmentOverlay();
	overlayEpoch += 1;
	const epoch = overlayEpoch;

	const outer = resolveCfiDomRange(rend, key);
	if (!outer) return;
	const normalized = normalizeSelectionRangeForEpub(outer) ?? outer;
	const sentenceRanges = splitListenSentences(plain).map((sentence) =>
		locateSentenceInRange(normalized, sentence),
	);

	session = {
		rend,
		epoch,
		sentenceRanges,
		activeSentence: -1,
	};

	detachRelayout = attachRelayoutListeners(rend, epoch);
}

/** 当前句开始播放：仅高亮该句 */
export function showEpubListenSentence(sentenceIndex: number): void {
	if (!session || sentenceIndex < 0) return;
	session.activeSentence = sentenceIndex;
	paintActiveSentence(session.epoch);
}

/** 当前句播放结束：去除播放背景（不影响用户划线） */
export function clearEpubListenSentenceOverlay(): void {
	if (session) session.activeSentence = -1;
	clearListenOverlayVisual();
}

/** 朗读结束 / 停止：拆除会话并清除播放层 */
export function clearEpubListenSegmentOverlay(): void {
	overlayEpoch += 1;
	const rend = session?.rend ?? null;
	session = null;
	detachRelayout?.();
	detachRelayout = null;
	cancelAnimationFrame(relayoutRaf);
	relayoutRaf = 0;

	for (const doc of collectDocsForClear(rend)) {
		try {
			clearListenOverlayInDoc(doc);
		} catch {
			// iframe 已卸载
		}
	}
	paintedDocs.clear();
}
```

**变更摘要**：模块级会话 + `overlayEpoch`；`paintRangeOverlay` 仅操作 `#moke-epub-listen-overlay`；`clearListenOverlayInDoc` 不触碰用户/想法 marks。

---

### 4.4 `read.tsx` 接线（`apps/frontend/src/views/ebook/read.tsx`）

**对比范围**：hook 调用与三处 `toggleListen` 传参。

**改动前** · 摘录

```typescript
const { toggleListen, listenLabel } = useEbookQuoteListen(t);
// ...
void toggleListen(payload.selectedText, 'popbar');
// ...
onListen: () => void toggleListen(quote, listenKey),
// ...
onListen: () => void toggleListen(thoughtDraft.quote, listenKey),
```

**改动后** · 摘录

```typescript
const { toggleListen, listenLabel } = useEbookQuoteListen(
	t,
	() => epubNavRef.current?.getRendition() ?? null,
);
// ...
void toggleListen(payload.selectedText, 'popbar', payload.cfiRange);
// ...
onListen: () => void toggleListen(quote, listenKey, cfiRange),
// ...
onListen: () =>
	void toggleListen(thoughtDraft.quote, listenKey, thoughtDraft.cfiRange),
```

**变更摘要**：向 hook 提供 rendition 与 CFI，供 overlay 定位正文。

## 5. 兼容性与影响

| 对象 | 影响 |
| ---- | ---- |
| 用户划线数据/API | **无**；不读写 `highlights`、不调用 `annotations.highlight` |
| 想法下划线 | **无**；不参与 `getThoughtCfisSuppressedByHighlights` |
| 点击命中 | **无**；浮层 `pointer-events: none` |
| 同区域视觉 | 可能与用户底色半透明叠色；删除播放层不影响用户 mark |
| 英语学习其它喇叭 | **无**；`onCadenceChunk` 可选，默认不传 |
| 无 `cfiRange` | 仅朗读、无播放底色（行为与旧版一致） |

## 6. 风险与回归建议

1. PopBar / 想法列表 / 详情三入口：多句书摘逐句亮灭、停止后无残留黄底。
2. 播放中划线、删划线：用户 mark 正常；停止后仅黄底消失。
3. 云端长文分段 + 本机朗读：句内多 chunk 不叠色，句间有短暂无底色间隔。
4. 滚动 / 翻章：播放中底色随 `relocated`/`rendered` 重定位。
5. 重复句在同一选区内：`locateSentenceInRange` 取首次 `indexOf`（已知局限）。

## 7. 相关源码路径

| 说明 | 路径 |
| ---- | ---- |
| TTS 节奏回调 | `apps/frontend/src/utils/englishTts.ts` |
| 播放浮层 | `apps/frontend/src/views/ebook/utils/epubListenSegmentOverlay.ts` |
| 朗读 hook | `apps/frontend/src/views/ebook/hooks/useEbookQuoteListen.ts` |
| 阅读页接线 | `apps/frontend/src/views/ebook/read.tsx` |
| 既有听当前专题 | `docs/ebook/epub-quote-listen.md` |

---

（若与仓库最新源码不一致，以源码为准）
