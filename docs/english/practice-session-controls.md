# 听写/拼写单题：两档答错、重答、键盘与播放

## 延伸阅读

- 单题「提示」：[practice-session-hint.md](./practice-session-hint.md)
- 结算与入口：[practice-summary-ui.md](./practice-summary-ui.md)、[practice-entry-navigation.md](./practice-entry-navigation.md)
- TTS 播放竞态：[english-tts-playback.md](./english-tts-playback.md)

---

## 1. 背景与目标

单词与经典句听写/拼写在单题 `Session` 中作答。本轮在「答错后怎么办」与「怎么听」上做了完整迭代：

1. **两档答错（方案 B）**：首次答错**不展示英文正确答案**，仅标红你的答案 + 自动展开提示 + 可播放；第二次答错或点 **看答案** 才完整揭示。
2. **再试一次**：软揭示 / 完整揭示均可回到本题重新作答（清空输入、不换题、不提前记入结算）。
3. **键盘**：作答 **Enter** 仅检查；首次答错 **←** 播放、**→** 看答案、**↑** 再试一次、**↓** 下一题；完整揭示 **↑/↓** 为再试 / 下一题。
4. **听写三连播**：进题、再听一遍、再试一次（听写）时连续 **3 次**朗读，间隔 **3 秒**，可停止。
5. **看中写播放**：顶栏「提示」展开、首次答错提示区均含听写同款圆形播放钮；**看答案** 时停止播放。
6. **UI**：底栏「再试一次」与「下一题」同为主按钮样式；播放钮下方无「再听一遍/停止」文案；看中写主释义字号略缩小。

---

## 2. 改动范围

| 路径 | 说明 |
|------|------|
| `apps/frontend/src/views/englishLearning/practice/Session.tsx` | 三态 `phase`、连播、键盘、软揭示 UI |
| `apps/frontend/src/views/englishLearning/practice/types.ts` | `PracticeItemPhase` 增加 `soft_wrong`；`SpellingPromptBodyProps` 播放 props |
| `apps/frontend/src/views/englishLearning/practice/components/dictation/DictationPrompt.tsx` | 导出 `DictationPlayButton` / `DictationHintPanel`；默认播放区去掉底部文案 |
| `apps/frontend/src/views/englishLearning/practice/components/spelling/SpellingPromptBody.tsx` | 提示展开时播放钮；释义 `text-xl` / 展开后 `text-lg` |
| `apps/frontend/src/i18n/locales/zh-CN.ts`、`en-US.ts` | `tryAgain`、`showAnswer`、`softWrongHint` 等 |

---

## 3. 实现思路

### 3.1 三态与 `wrongAttemptCount`

| `phase` | 触发 | 展示 |
|---------|------|------|
| `prompt` | 初始 / 再试一次后 | 作答区 |
| `soft_wrong` | 本题**第 1 次**答错 | 你的答案（红）；**无**英文正确答案；自动 `hintOpen`；听写/看中写均可播放 |
| `revealed` | 第 2 次答错，或点 **看答案** | `RevealedPanelInner` 完整对错 |

`wrongAttemptCount` 按 `item.key` 重置；再试一次**不**清零计数，故重答后再错会直接进入 `revealed`。

### 3.2 结算边界

- 仅 **答对** 或点 **下一题**（`completeStep(lastWrong)`）写入 `results`。
- **再试一次** 清空 `lastWrong` 回到 `prompt`，不推进 `index`。

### 3.3 键盘（`soft_wrong` / `revealed`）

| 阶段 | 按键 | 行为 |
|------|------|------|
| `prompt` | Enter | 检查 |
| `soft_wrong` | ← | 播放 / 停止（听写三连播或看中写单次） |
| `soft_wrong` | → | 看答案（`onRevealAnswer`，**先停止播放**） |
| `soft_wrong` | ↑ / ↓ | 再试一次 / 下一题 |
| `revealed` | ↑ / ↓ | 再试一次 / 下一题 |

焦点在 `INPUT` / `TEXTAREA` / `SELECT` 时不拦截方向键。

### 3.4 听写连播与取消

- `DICTATION_PLAY_COUNT = 3`、`DICTATION_PLAY_GAP_MS = 3000`。
- `dictationPlayRunRef` + `cancelDictationPlay()` 取消朗读与 `sleepMs` 等待。
- 看中写 `playWord` 仍为单次 `playEnglishPreferred`。

### 3.5 播放 UI 复用

- 听写作答、软揭示、看中写提示区共用 `DictationPlayButton`（`strip` 或 `hero`）+ `DictationEqualizer`。
- 完整揭示区单词卡仍用 `VocabWordPlayButton`。

---

## 4. 关键代码与注释

### 4.1 类型：`PracticeItemPhase` 与拼写 props

**来源**：`apps/frontend/src/views/englishLearning/practice/types.ts`（约 L237、L278–L287）

```typescript
/** 单题作答阶段：作答 → 首次答错（软揭示）→ 完整揭示 */
export type PracticeItemPhase = 'prompt' | 'soft_wrong' | 'revealed';

export type SpellingPromptBodyProps = {
  promptLabel: string;
  translationZh: string;
  pos?: string;
  hintOpen: boolean;
  hintContent: PracticeHintFields;
  playing: boolean;   // 说明：由 Session 统一管理 TTS 播放态
  playLabel: string;    // 说明：aria-label，「再听一遍」或「停止」
  onPlay: () => void;   // 说明：绑定 Session.playWord（看中写为单次播放）
};
```

### 4.2 常量、状态与换题重置

**来源**：`apps/frontend/src/views/englishLearning/practice/Session.tsx`（约 L44–L74、L140–L151）

```typescript
/** 听写自动/手动播放：次数与间隔（毫秒） */
const DICTATION_PLAY_COUNT = 3;
const DICTATION_PLAY_GAP_MS = 3000;

// 说明：phase 驱动三张叠放面板（prompt / soft_wrong / revealed）的显隐
const [phase, setPhase] = useState<PracticeItemPhase>('prompt');
const [wrongAttemptCount, setWrongAttemptCount] = useState(0);
const [lastWrong, setLastWrong] = useState<PracticeAttemptResult | null>(null);
/** 递增以取消进行中的听写连播（含间隔等待） */
const dictationPlayRunRef = useRef(0);

// 说明：item.key 变化 = 进入下一题，全部作答态归零
useEffect(() => {
  dictationPlayRunRef.current += 1; // 取消上一题未结束的连播
  setPlaying(false);
  setPhase('prompt');
  setInput('');
  setWrongAttemptCount(0);  // 新题从 0 次错计起
  setLastWrong(null);
  setHintOpen(false);
  autoPlayedKeyRef.current = null;
  requestAnimationFrame(() => inputRef.current?.focus());
}, [item.key]);
```

### 4.3 听写三连播与可取消播放

**来源**：`apps/frontend/src/views/englishLearning/practice/Session.tsx`（约 L78–L138、L153–L158）

```typescript
/** 说明：每次 cancel 或新开播放时 runId 自增，旧异步循环在 await 后自检并退出 */
const cancelDictationPlay = useCallback(() => {
  dictationPlayRunRef.current += 1;
  stopAllEnglishPlayback();
}, []);

const playDictationSequence = useCallback(
  async (runId: number) => {
    for (let i = 0; i < DICTATION_PLAY_COUNT; i += 1) {
      if (dictationPlayRunRef.current !== runId) return; // 已被取消
      await playEnglishPreferred(answerText, { preferLocal: true });
      if (dictationPlayRunRef.current !== runId) return;
      if (i < DICTATION_PLAY_COUNT - 1) {
        await sleepMs(DICTATION_PLAY_GAP_MS); // 第 1、2 次后各等 3s
      }
    }
  },
  [answerText],
);

const playWord = useCallback(async () => {
  if (!isEnglishTtsSupported()) { /* Toast 警告 */ return; }
  if (playing) {
    // 说明：播放中再点 = 停止（toggle）
    cancelDictationPlay();
    setPlaying(false);
    return;
  }
  dictationPlayRunRef.current += 1;
  const runId = dictationPlayRunRef.current;
  stopAllEnglishPlayback();
  setPlaying(true);
  try {
    if (mode === 'dictation') {
      await playDictationSequence(runId); // 听写：3 连播
    } else {
      await playEnglishPreferred(answerText, { preferLocal: true }); // 拼写：单次
    }
  } finally {
    if (dictationPlayRunRef.current === runId) setPlaying(false);
  }
}, [/* answerText, mode, playing, … */]);

// 说明：听写进题自动触发一次 playWord（内含三连播）
useEffect(() => {
  if (mode !== 'dictation') return;
  if (autoPlayedKeyRef.current === item.key) return;
  autoPlayedKeyRef.current = item.key;
  void playWord();
}, [item.key, mode, playWord]);
```

### 4.4 提交检查与两档答错分流

**来源**：`apps/frontend/src/views/englishLearning/practice/Session.tsx`（`onSubmit`，约 L173–L215）

```typescript
const onSubmit = useCallback((e?: FormEvent) => {
  e?.preventDefault();
  if (phase !== 'prompt') return; // 说明：软揭示/完整揭示时底栏无输入区，此处双保险
  const trimmed = input.trim();
  if (!trimmed) return;

  const correct = gradeSpelling(trimmed, answerText, {
    compareAsSentence: isPracticeClassicItem(item),
  });
  const attempt: PracticeAttemptResult = { item, userInput: trimmed, correct };

  if (correct) {
    completeStep(attempt); // 答对：写入 results 并换题
    return;
  }

  // 说明：答错先停播，避免软揭示态仍背景朗读
  cancelDictationPlay();
  setPlaying(false);
  setLastWrong(attempt);

  const nextAttempt = wrongAttemptCount + 1;
  setWrongAttemptCount(nextAttempt);

  if (nextAttempt >= 2) {
    setPhase('revealed'); // 本题第 2 次错 → 直接完整揭示
  } else {
    setPhase('soft_wrong'); // 第 1 次错 → 软揭示
    if (hasPracticeHintContent(item, mode)) {
      setHintOpen(true); // 有线索则自动展开（仍不显示英文词面）
    }
  }
}, [/* … */]);
```

### 4.5 再试一次、下一题、看答案

**来源**：`apps/frontend/src/views/englishLearning/practice/Session.tsx`（约 L217–L242）

```typescript
const onNext = useCallback(() => {
  // 说明：带 lastWrong 完成本题（记错题）并交给父组件推进 index
  if (lastWrong) completeStep(lastWrong);
}, [completeStep, lastWrong]);

/** 软揭示态：主动查看正确答案 */
const onRevealAnswer = useCallback(() => {
  cancelDictationPlay(); // 说明：看答案必须停播
  setPlaying(false);
  setPhase('revealed');
}, [cancelDictationPlay]);

/** 答错后回到作答区重新作答（不换题、不记入结算） */
const onRetryCurrent = useCallback(() => {
  cancelDictationPlay();
  setPlaying(false);
  setLastWrong(null);       // 说明：清除错题快照，底栏回到输入+检查
  setPhase('prompt');
  setInput('');
  // 说明：wrongAttemptCount 不清零 → 再错会直接进入 revealed
  if (mode === 'dictation') {
    void playWord();        // 听写再试：重新三连播
  }
  requestAnimationFrame(() => inputRef.current?.focus());
}, [cancelDictationPlay, mode, playWord]);
```

### 4.6 键盘：软揭示与完整揭示

**来源**：`apps/frontend/src/views/englishLearning/practice/Session.tsx`（`useEffect` 内 `onKeyDown`，约 L244–L299）

```typescript
useEffect(() => {
  if ((phase !== 'soft_wrong' && phase !== 'revealed') || !lastWrong) return;

  inputRef.current?.blur(); // 说明：避免方向键被输入框吞掉

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    const tag = (e.target as HTMLElement | null)?.tagName;
    // 说明：焦点在表单控件时不拦截，保留原生光标移动
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (phase === 'soft_wrong') {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        void playWord();      // ← 播放/停止
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        onRevealAnswer();     // → 看答案（内部会停播）
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        onRetryCurrent();     // ↑ 再试一次
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        onNext();             // ↓ 下一题
      }
      return;
    }

    // revealed：仅 ↑↓
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      onRetryCurrent();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      onNext();
    }
  };

  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}, [phase, lastWrong, onNext, onRevealAnswer, onRetryCurrent, playWord]);
```

### 4.7 三面板叠放与软揭示 UI

**来源**：`apps/frontend/src/views/englishLearning/practice/Session.tsx`（约 L349–L517）

```tsx
/** 说明：软揭示共用播放块——听写放提示下方，看中写可单独出现 */
const softWrongPlayBlock = (
  <div className="mt-2 flex flex-col items-center gap-2">
    <DictationPlayButton playing={playing} playLabel={playLabel}
      onPlay={() => void playWord()} size="strip" />
    <DictationEqualizer playing={playing} className="h-5 w-full" />
  </div>
);

// 说明：grid 三格同位叠放，用 hidden 切换，避免高度动画
<div className="grid … *:col-start-1 *:row-start-1">
  {/* prompt：听写 DictationPromptBody / 拼写 SpellingPromptBody */}
  <SessionPromptPanel className={cn(phase !== 'prompt' && 'hidden')} … />

  {/* soft_wrong：只标红用户答案 + 提示 + 播放，无 RevealedPanelInner */}
  <SessionPromptPanel className={cn(phase !== 'soft_wrong' && 'hidden')} …>
    <p>…<span className="text-rose-500">{revealedWrongInput}</span></p>
    {canHint && hintOpen ? (
      mode === 'dictation'
        ? <DictationHintPanel hintContent={hintContent} />
        : /* 拼写：音标/出处 + softWrongPlayBlock */
    ) : mode === 'spelling' ? softWrongPlayBlock : null}
    <p>{t('englishLearning.practice.softWrongHint')}</p>
    {mode === 'dictation' ? softWrongPlayBlock : null}
    <Button onClick={onRevealAnswer}>{t('…showAnswer')}</Button>
  </SessionPromptPanel>

  {/* revealed：完整对错 + VocabWordPlayButton */}
  <SessionPromptPanel className={cn(phase !== 'revealed' && 'hidden')} …>
    <RevealedPanelInner … playButton={wordPlayButton} />
  </SessionPromptPanel>
</div>
```

### 4.8 底栏：检查 / 再试一次 / 下一题

**来源**：`apps/frontend/src/views/englishLearning/practice/Session.tsx`（约 L520–L586）

```tsx
<form onSubmit={onSubmit} className="… transition-none">
  {/* 作答态：输入 + 检查 */}
  <div className={cn(phase !== 'prompt' && 'hidden')}>
    <Input ref={inputRef} value={input} onChange={…} />
    <Button type="submit" disabled={!input.trim()}>
      {t('englishLearning.practice.check')}
    </Button>
  </div>

  {/* 答错态：两枚主按钮并排，无 variant=outline */}
  <div className={cn(
    'grid grid-cols-2 gap-2 pt-4 transition-none',
    !showWrongActions && 'hidden',
  )}>
    <Button type="button" className="h-10 w-full transition-none"
      onClick={onRetryCurrent}>
      {t('englishLearning.practice.tryAgain')}
    </Button>
    <Button type="button" className="h-10 w-full transition-none"
      onClick={onNext}>
      {isLastQuestion ? t('…viewResults') : t('…next')}
    </Button>
  </div>
</form>
```

### 4.9 听写播放钮（可复用）

**来源**：`apps/frontend/src/views/englishLearning/practice/components/dictation/DictationPrompt.tsx`（`DictationPlayButton`，约 L44–L96）

```tsx
export function DictationPlayButton({
  playing, playLabel, onPlay, size = 'hero',
}: { /* … */ size?: 'hero' | 'strip' }) {
  const isStrip = size === 'strip';
  // 说明：hero=作答区大圆钮；strip=提示/软揭示小圆钮
  return (
    <button type="button" onClick={onPlay} aria-label={playLabel}
      className={cn('… rounded-full …', isStrip ? 'size-10' : 'size-14')}>
      <span className="…">
        {playing
          ? <Square className="fill-current" />   // 停止图标
          : <Volume2 />}                          // 播放图标
      </span>
      {/* 说明：无可见 playLabel 文案，仅 aria-label 供读屏 */}
    </button>
  );
}
```

**来源**：同上文件（`DictationPromptDefault`，约 L214–L245）

```tsx
/** 默认听写作答：大播放钮 + 均衡器；底部仅保留灰色说明 hint，无「再听一遍」文字 */
function DictationPromptDefault({ hint, playing, playLabel, onPlay }) {
  return (
    <>
      <DictationPlayButton playing={playing} playLabel={playLabel}
        onPlay={onPlay} size="hero" />
      <DictationEqualizer playing={playing} className="h-8" />
      <p className="text-[11px] text-textcolor/55">{hint}</p>
    </>
  );
}
```

### 4.10 看中写：释义字号与提示区播放

**来源**：`apps/frontend/src/views/englishLearning/practice/components/spelling/SpellingPromptBody.tsx`（约 L38–L92）

```tsx
{/* 说明：展开提示后释义略缩小，为音标/播放腾出垂直空间 */}
<p className={cn(
  'text-textcolor font-semibold',
  hintOpen ? 'text-lg' : 'text-xl',
)}>
  {translationZh}
</p>

{hintOpen ? (
  <div className="mt-3 flex flex-col items-center gap-2">
    {/* 说明：与听写共用 DictationPlayButton，拼写模式下 onPlay 为单次 TTS */}
    <DictationPlayButton
      playing={playing}
      playLabel={playLabel}
      onPlay={onPlay}
      size="strip"
    />
    <DictationEqualizer playing={playing} className="h-5 w-full" />
  </div>
) : null}
```

### 4.11 文案（i18n）

**来源**：`apps/frontend/src/i18n/locales/zh-CN.ts`（`englishLearning.practice` 段，约 L755–L757）

```typescript
'englishLearning.practice.tryAgain': '再试一次',
'englishLearning.practice.showAnswer': '看答案',
'englishLearning.practice.softWrongHint': '可再试一次，也可以查看正确答案后继续',
// 说明：playAgain / stop 仍用于播放钮 aria-label；previous 键保留未用于底栏
```

---

## 5. 兼容性与影响

| 维度 | 影响 |
|------|------|
| 首次答错 | 用户可凭提示与播放再试，看不到英文正确答案 |
| 第二次答错 / 看答案后 | 与旧版「一次错即揭示」一致 |
| 看中写 | 无三连播；提示与软揭示均可播放 |
| 听写时长 | 每轮连播最长约 3 次 + 2×3s 间隔 |
| i18n | `tryAgain`、`showAnswer`、`softWrongHint`（`previous` 键保留未删） |

**建议回归**：

1. 看中写 / 听写：第一次错 → 无英文答案、有提示与播放；**→** 或第二次错 → 完整揭示。
2. **看答案** 时连播应立即停止。
3. 看中写顶栏「提示」展开 → 有播放钮；**←** 在软揭示可播。
4. 再试一次 → 输入清空；听写再试触发三连播。
5. 底栏两钮样式一致；听写播放区无底部文字。

---

## 6. 相关源码路径

| 说明 | 路径 |
|------|------|
| 单题会话 | `apps/frontend/src/views/englishLearning/practice/Session.tsx` |
| 听写播放组件 | `apps/frontend/src/views/englishLearning/practice/components/dictation/DictationPrompt.tsx` |
| 拼写题干 | `apps/frontend/src/views/englishLearning/practice/components/spelling/SpellingPromptBody.tsx` |
| 提示可用性 | `apps/frontend/src/views/englishLearning/practice/utils/hint.ts` |
| TTS | `apps/frontend/src/utils/englishTts.ts` |

若与仓库最新源码不一致，以源码为准。
