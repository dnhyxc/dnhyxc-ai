import type { OnMount } from '@monaco-editor/react';
import type React from 'react';

import type { MonacoEditorContextActions } from './contextMenu';

/**
 * 集中注册 Monaco Editor 的快捷键（command/命令）逻辑。
 *
 * 设计目标：
 * - **不改变既有行为**：只是把 `index.tsx` 的 `editor.addCommand(...)` 抽离出来，便于维护与复用
 * - **职责清晰**：本文件只关心“快捷键→执行动作”，不关心 UI/布局/右键菜单渲染
 * - **可组合**：依赖均从外部注入（selection 获取、剪贴板、格式化、外部回调），避免硬编码与循环依赖
 *
 * 术语说明：
 * - command（命令）：Monaco 的快捷键处理单元，通过 `editor.addCommand(...)` 注册
 * - IME（输入法，Input Method Editor）合成态：输入法正在组合文字时（候选/上屏前），应避免执行自定义粘贴等命令
 */
export function registerMonacoEditorCommands(params: {
	/**
	 * Monaco 编辑器实例：
	 * - 用于注册命令、读取模型/选区、执行编辑（`executeEdits`）、触发内置 action（`editor.trigger`）等
	 */
	editor: Parameters<OnMount>[0];
	/**
	 * Monaco 命名空间：
	 * - 提供 `KeyMod/KeyCode/Range` 等常量与类型
	 * - 用于组合快捷键（例如 Ctrl/⌘ + Shift + V）与构造删除范围
	 */
	monaco: Parameters<OnMount>[1];
	/**
	 * IME（输入法，Input Method Editor）合成态 ref：
	 * - 合成态时不要执行自定义粘贴，否则会打断输入法上屏流程
	 * - 使用 ref 避免闭包过期，始终读取最新状态
	 */
	imeComposingRef: React.RefObject<boolean>;
	/**
	 * 右键菜单动作集合 ref：
	 * - 一些快捷键可以选择复用“右键菜单动作”（例如发送选区到助手）
	 * - 这里用 ref 连接两套入口：快捷键与右键菜单点击，保证语义一致
	 */
	editorContextActionsRef: React.RefObject<MonacoEditorContextActions | null>;
	/**
	 * Copy（复制）语义：从当前选区计算“应该复制”的文本。
	 * - 有选区：复制选区内容
	 * - 无选区（仅光标）：复制当前行（与常见编辑器一致）
	 */
	getCopyTextFromSelections: () => string;
	/**
	 * Cut（剪切）语义：在“仅光标、无选区”时计算应删除的范围。
	 * - 目标：尽量对齐 VS Code 的剪切行为（剪切整行并处理换行）
	 * - 返回 `monaco.Range`，供 `executeEdits` 删除使用
	 */
	rangeForCutWhenCursorOnly: (
		sel: NonNullable<
			ReturnType<Parameters<OnMount>[0]['getSelections']>
		>[number],
	) => InstanceType<Parameters<OnMount>[1]['Range']>;
	/**
	 * 写入系统剪贴板：
	 * - 统一封装（Clipboard API/tauri 插件）以适配 WebView/Tauri 场景
	 * - 返回 Promise 或 void，调用方无需关心具体实现
	 */
	copyToClipboard: (text: string) => Promise<void> | void;
	/**
	 * 从系统剪贴板读取文本：
	 * - 统一封装（Clipboard API/tauri 插件）以适配 WebView/Tauri 场景
	 */
	pasteFromClipboard: () => Promise<string>;
	/**
	 * Markdown 安全格式化（safe format/安全格式化）：
	 * - 专用于 markdown：避免围栏反引号数量、缩进等被不安全的 formatter 破坏
	 * - 返回 null/undefined 表示“不做修改”
	 */
	safeFormatMarkdownValue: (
		text: string,
	) => Promise<string | null | undefined> | string | null | undefined;
	/**
	 * Selection（选区）语义：仅返回“真实选区文本”。
	 * - 多选区：按模型 EOL 进行拼接
	 * - 无选区（仅光标）：返回空串（**不降级为整行**）
	 *
	 * 该语义专用于“发送选区到外部输入框”（如知识库助手），避免把整行当作对话草稿。
	 */
	getSelectedTextOnlyFromSelections: () => string;
	/**
	 * 外部接入：将选区写入“助手输入框”。
	 * - 是否自动展开助手面板、如何与现有草稿合并，由外部决定
	 * - Monaco 侧只负责：在快捷键触发时，把“选区文本”交给外部
	 */
	onInsertSelectionToAssistant?: (text: string) => void;
	/**
	 * 同步父级 value（受控 onChange）：
	 * - 在触发可能导致 UI 变化的命令前，先把当前 editor 值推到父级
	 * - 用于规避“开启助手/切换视图 → 重挂载瞬态 → 看起来像内容被清空”的观感问题
	 */
	flushEditorValueToParent: () => void;
}) {
	const {
		editor,
		monaco,
		imeComposingRef,
		editorContextActionsRef,
		getCopyTextFromSelections,
		rangeForCutWhenCursorOnly,
		copyToClipboard,
		pasteFromClipboard,
		safeFormatMarkdownValue,
		getSelectedTextOnlyFromSelections,
		onInsertSelectionToAssistant,
		flushEditorValueToParent,
	} = params;

	/**
	 * Shift+Alt+F：格式化文档
	 * - Markdown：走安全格式化（避免围栏反引号数量等问题）
	 * - 其它语言：走 Monaco 默认 formatDocument
	 */
	editor.addCommand(
		monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF,
		() => {
			const model = editor.getModel();
			if (!model) return;
			if (model.getLanguageId() === 'markdown') {
				if (editor.getOption(monaco.editor.EditorOption.readOnly)) return;
				void (async () => {
					const next = await safeFormatMarkdownValue(model.getValue());
					if (next == null) return;
					// 以 “两段 undoStop + 一次替换全量内容” 的方式写入，保证撤销体验稳定
					editor.pushUndoStop();
					editor.executeEdits('dnhyxc-markdown-safe-format', [
						{ range: model.getFullModelRange(), text: next },
					]);
					editor.pushUndoStop();
				})();
				return;
			}
			// 非 markdown：直接触发 Monaco 内置格式化
			editor.trigger('keyboard', 'editor.action.formatDocument', null);
		},
	);

	/**
	 * Ctrl/⌘+B：注释当前行
	 * - 这里复用 Monaco 内置 action，保持与编辑器默认行为一致
	 */
	editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB, () => {
		editor.trigger('keyboard', 'editor.action.commentLine', null);
	});

	/**
	 * Ctrl/⌘+C：复制
	 * - WebView/Tauri 场景系统默认复制可能失败，因此强制走统一剪贴板写入
	 * - 文本来源遵循 Copy 语义（无选区复制当前行）
	 */
	editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyC, () => {
		const text = getCopyTextFromSelections();
		if (!text) return;
		void copyToClipboard(text);
	});

	/**
	 * Ctrl/⌘+X：剪切
	 * - 只读模式下不允许修改，直接 return
	 * - 剪切流程：先 copyToClipboard → 再 executeEdits 删除
	 * - 删除范围遵循 Cut 语义（无选区删除“当前逻辑行”）
	 */
	editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyX, () => {
		if (editor.getOption(monaco.editor.EditorOption.readOnly)) return;
		void (async () => {
			const text = getCopyTextFromSelections();
			if (!text) return;
			await copyToClipboard(text);
			const sels = editor.getSelections();
			if (!sels?.length) return;
			editor.executeEdits(
				'cut',
				sels.map((sel) => ({
					range: rangeForCutWhenCursorOnly(sel),
					text: '',
				})),
			);
		})();
	});

	/**
	 * Ctrl/⌘+V：粘贴
	 * - 只读模式下不允许修改
	 * - IME 合成期间跳过：避免打断输入法候选/上屏
	 * - 读取剪贴板文本后，以 `executeEdits` 替换当前选区/插入到光标处
	 */
	editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyV, () => {
		if (editor.getOption(monaco.editor.EditorOption.readOnly)) return;
		if (editor.inComposition || imeComposingRef.current) return;
		void (async () => {
			const text = await pasteFromClipboard();
			if (!text) return;
			const sels = editor.getSelections();
			if (!sels?.length) return;
			editor.executeEdits(
				'paste',
				sels.map((sel) => ({ range: sel, text })),
			);
		})();
	});

	/**
	 * Ctrl/Cmd+Shift+V：知识库助手
	 * - 先取真实选区；无选区直接 return（避免无意义切换/刷新感）
	 * - 先同步父级 value（避免开启助手后 edit→split 重挂载看到“内容被清空”）
	 * - 再把选区写入助手输入框（由外部决定是否自动打开助手）
	 */
	editor.addCommand(
		monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyV,
		() => {
			// 只认“真实选区”：不做“无选区复制整行”的降级，避免误触把整行塞进对话草稿
			const selected = getSelectedTextOnlyFromSelections();
			if (!selected.trim()) return;
			// 先同步父级内容：外部可能会触发视图切换，确保最新 markdown 已上抛
			flushEditorValueToParent();
			/**
			 * 关键：只走一条写入链路，避免重复写入输入框。
			 *
			 * 优先复用右键菜单动作（`sendSelectionToAssistant`）：
			 * - 该动作内部会再次读取“真实选区”并调用 `onInsertSelectionToAssistant`
			 * - 与右键菜单点击行为保持一致
			 *
			 * 兜底：如果未注入右键动作，则直接调用外部回调写入输入框。
			 */
			const action = editorContextActionsRef.current?.sendSelectionToAssistant;
			if (action) {
				action();
				return;
			}
			onInsertSelectionToAssistant?.(selected);
		},
	);
}
