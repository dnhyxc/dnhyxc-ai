# 英语学习：本机 TTS 音色设置与默认 Karen

> 播放世代、单词本机优先、云端缓存见 [`english-tts-playback.md`](./english-tts-playback.md)、[`english-tts-cache-consistency.md`](./english-tts-cache-consistency.md)。

## 1. 背景与目标

用户希望在**系统设置**中选择本机 Web Speech 英语音色并试听；单词场景 `preferLocal: true` 时使用该偏好。默认女声由 **Moira** 调整为 **Karen**，且首次进入应用即写入 `localStorage`，避免「只有点选后才生效」。

## 2. 改动范围

| 说明 | 路径 |
|------|------|
| TTS 核心 | `apps/frontend/src/utils/englishTts.ts` |
| 系统设置 UI | `apps/frontend/src/views/setting/system/TtsVoiceSetting.tsx`（新建） |
| 设置页挂载 | `apps/frontend/src/views/setting/system/index.tsx` |
| i18n | `apps/frontend/src/i18n/locales/zh-CN.ts`、`en-US.ts` |

## 3. 实现思路

### 3.1 默认与持久化

- **`DEFAULT_LOCAL_ENGLISH_TTS_VOICE_KEY = 'karen'`**
- **`ensureDefaultLocalEnglishVoicePreference()`**：无 `english_learning_local_tts_voice` 时写入 `karen`
- **`PREFERRED_LOCAL_ENGLISH_FEMALE_VOICES`** 回退顺序：`karen` → `moira` → …

选「默认（Karen）」时 `setPreferredLocalEnglishVoiceKey(null)` 会恢复并写回默认 key。

### 3.2 系统设置 UI

- 使用 **DropdownMenu + RadioGroup**（非 Select），分组展示女声/男声（`classifyEnglishVoiceGender` 过滤 `unknown`）
- 试听：`playEnglishPreferred(previewText, { preferLocal: true })`
- 触发器样式：无阴影、边框颜色在 focus/hover/open 时保持 `border-theme/20`

### 3.3 与朗读调用的关系

`resolveVoiceKeyForPlayback()` 在每次本机播放前解析关键字并匹配 `speechSynthesis.getVoices()`；未改云端 TTS 路径。

## 4. 关键代码

**来源**：`apps/frontend/src/utils/englishTts.ts`（约 L83–L90、L163–L179）

```typescript
// 说明：默认关键字与女声回退列表首位均为 karen
export const DEFAULT_LOCAL_ENGLISH_TTS_VOICE_KEY = 'karen';

export const PREFERRED_LOCAL_ENGLISH_FEMALE_VOICES = [
	'karen',
	'moira',
	// ...
];
```

**来源**：`apps/frontend/src/views/setting/system/TtsVoiceSetting.tsx`（`DropdownMenuRadioGroup` 与 `onVoiceChange`，组件中部）

```typescript
// 说明：LOCAL_ENGLISH_TTS_VOICE_AUTO 表示恢复默认 Karen；否则按 voiceURI 持久化
if (value === LOCAL_ENGLISH_TTS_VOICE_AUTO) {
	setPreferredLocalEnglishVoiceKey(null);
} else {
	setPreferredLocalEnglishVoiceByUri(value);
}
```

## 5. 回归建议

| 场景 | 预期 |
|------|------|
| 首次打开设置 | 显示默认 Karen，试听可用 |
| 切换音色后单词朗读 | 资源库/收藏喇叭使用新音色 |
| 清 localStorage 后 | 再次进入恢复 karen |

若与仓库最新源码不一致，**以源码为准**。
