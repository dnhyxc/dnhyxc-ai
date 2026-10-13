/** en-US · setting */
export const setting = {
	'setting.about.cache.clear': 'Clear cache',
	'setting.about.cache.size': 'Current cache size ',
	'setting.about.cache.title': 'App cache',
	'setting.about.checkUpdate': 'Check for updates',
	'setting.about.download.done': 'Download complete',
	'setting.about.download.downloading': 'Downloading',
	'setting.about.latestVersion': 'Latest version',
	'setting.about.relaunchDialog.desc':
		'The app is about to relaunch to finish updating. To keep your data safe, please save any unsaved work before relaunching. Unsaved data cannot be recovered after relaunch. We recommend confirming that important data has been saved before clicking "Relaunch now".',
	'setting.about.relaunchDialog.later': 'Relaunch later',
	'setting.about.relaunchDialog.now': 'Relaunch now',
	'setting.about.relaunchDialog.title': 'Relaunch the app now?',
	'setting.about.releaseDate': 'Release date',
	'setting.about.toast.cacheCleared': 'Cache cleared',
	'setting.about.toast.fetchVersionFailed': 'Failed to fetch version info',
	'setting.about.toast.latestVersion': "You're on the latest version",
	'setting.about.toast.relaunchFailed': 'Relaunch failed',
	'setting.about.update.notifyMe': 'Notify me when a new version is available',
	'setting.about.update.title': 'Software update',
	'setting.about.updateAndRelaunch': 'Update and relaunch',
	'setting.about.viewReleaseNotes': 'View release notes',
	'setting.cloudTts.advancedHint':
		'Advanced audio parameters; defaults are usually fine.',
	'setting.cloudTts.bitrate': 'Bitrate',
	'setting.cloudTts.channel': 'Channels',
	'setting.cloudTts.decreaseValue': 'Decrease {label}',
	'setting.cloudTts.desc':
		'When MiniMax cloud is selected above, fill in API Key and model name to use custom settings; leave blank or click "Reset to defaults" to use default configuration.',
	'setting.cloudTts.edgeHint':
		'Applies when Edge cloud is selected above; Microsoft Edge online TTS.',
	'setting.cloudTts.edgePreview': 'Edge preview',
	'setting.cloudTts.edgeTitle': 'Edge voice settings',
	'setting.cloudTts.edgeVoice': 'Voice',
	'setting.cloudTts.emotion': 'Emotion',
	'setting.cloudTts.emotion.angry': 'Angry',
	'setting.cloudTts.emotion.calm': 'Neutral',
	'setting.cloudTts.emotion.disgusted': 'Disgusted',
	'setting.cloudTts.emotion.fearful': 'Fearful',
	'setting.cloudTts.emotion.fluent': 'Lively',
	'setting.cloudTts.emotion.happy': 'Happy',
	'setting.cloudTts.emotion.sad': 'Sad',
	'setting.cloudTts.emotion.surprised': 'Surprised',
	'setting.cloudTts.emotionNone': 'None (default)',
	'setting.cloudTts.enabledHelp':
		'When on, cloud playback uses the parameters below; when off, server defaults apply.',
	'setting.cloudTts.enabledLabel': 'Use custom playback parameters',
	'setting.cloudTts.fieldHelp.bitrate':
		'Bitrate affects compressed quality and file size; default 128000.',
	'setting.cloudTts.fieldHelp.channel':
		'1 = mono (recommended for narration), 2 = stereo.',
	'setting.cloudTts.fieldHelp.emotionIntro':
		'Optional emotional style; choose none to omit and use the voice default.',
	'setting.cloudTts.fieldHelp.format':
		'Output format; mp3 is universal—pcm/wav if your player or pipeline needs them.',
	'setting.cloudTts.fieldHelp.languageBoost':
		'Tells the engine which language to optimize pronunciation for, reducing misread language or odd accent. Choose English or Chinese when the text is mostly one language; use Auto when mixed or unsure.',
	'setting.cloudTts.fieldHelp.model':
		'Cloud synthesis model, e.g. speech-2.8-turbo (default, faster) or hd (higher quality).',
	'setting.cloudTts.fieldHelp.pitch':
		'Pitch from -12 to 12; 0 is neutral—positive is higher, negative is lower.',
	'setting.cloudTts.fieldHelp.sampleRate':
		'Sample rate in Hz; default 32000. Higher can mean more detail and larger files.',
	'setting.cloudTts.fieldHelp.speed':
		'Speech rate from 0.5 to 2; 1 is normal speed.',
	'setting.cloudTts.fieldHelp.voiceId':
		'Voice used for playback; choose from the preset list.',
	'setting.cloudTts.fieldHelp.vol':
		'Volume from 0.01 to 10; default 5—louder values increase output (1 is standard volume).',
	'setting.cloudTts.format': 'Audio format',
	'setting.cloudTts.increaseValue': 'Increase {label}',
	'setting.cloudTts.languageBoost': 'Language boost',
	'setting.cloudTts.languageBoostOption.auto': 'Auto',
	'setting.cloudTts.languageBoostOption.Chinese': 'Chinese',
	'setting.cloudTts.languageBoostOption.English': 'English',
	'setting.cloudTts.minimaxCredentialsHint':
		'Leave API Key empty to use the server environment variable; model name falls back to server config when empty.',
	'setting.cloudTts.model': 'Model',
	'setting.cloudTts.modelOption.speech28Hd': 'speech-2.8-hd (higher quality)',
	'setting.cloudTts.modelOption.speech28Turbo': 'speech-2.8-turbo (default)',
	'setting.cloudTts.paramsDesc':
		'Voice, speed, audio format, and related options.',
	'setting.cloudTts.paramsHelpAria': 'Playback parameter field help',
	'setting.cloudTts.paramsHelpTitle': 'Field reference',
	'setting.cloudTts.paramsTitle': 'Playback parameters',
	'setting.cloudTts.pitch': 'Pitch',
	'setting.cloudTts.playbackHelp':
		'Mutually exclusive with “Use local voice for playback” above; the parameter form applies when this is on.',
	'setting.cloudTts.playbackLabel': 'Use cloud voice for playback',
	'setting.cloudTts.playbackSource.cloud': 'MiniMax cloud',
	'setting.cloudTts.playbackSource.edge': 'Edge cloud',
	'setting.cloudTts.playbackSource.local': 'Local voice',
	'setting.cloudTts.playbackSource.xfyun': 'iFlytek cloud',
	'setting.cloudTts.playbackSourceHelp':
		'Active members choose one: local Web Speech, Edge cloud, MiniMax cloud, or iFlytek online TTS.',
	'setting.cloudTts.playbackSourceHelp.cloud':
		'MiniMax streaming synthesis; parameters in the MiniMax section below.',
	'setting.cloudTts.playbackSourceHelp.edge':
		'Microsoft Edge online TTS; see Edge section below.',
	'setting.cloudTts.playbackSourceHelp.local':
		'Browser Web Speech; voice from the local section below.',
	'setting.cloudTts.playbackSourceHelp.xfyun':
		'iFlytek online synthesis; good for Chinese narration; see the iFlytek section below.',
	'setting.cloudTts.playbackSourceHelpFree':
		'Choose one: local Web Speech or Edge cloud (free).',
	'setting.cloudTts.playbackSourceTitle': 'Playback source',
	'setting.cloudTts.preview': 'Cloud preview',
	'setting.cloudTts.previewText':
		'This is a preview of the cloud reading effect with the parameters set above.',
	'setting.cloudTts.reset': 'Reset to defaults',
	'setting.cloudTts.sampleRate': 'Sample rate',
	'setting.cloudTts.speed': 'Speed',
	'setting.cloudTts.title': 'Cloud voice settings',
	'setting.cloudTts.voiceGroup.female': 'Female',
	'setting.cloudTts.voiceGroup.male': 'Male',
	'setting.cloudTts.voiceId': 'Voice category',
	'setting.cloudTts.vol': 'Volume',
	'setting.cloudTts.xfyunApiKey': 'API Key',
	'setting.cloudTts.xfyunApiSecret': 'API Secret',
	'setting.cloudTts.xfyunAppId': 'APP ID',
	'setting.cloudTts.xfyunCredentialsHint':
		'Applies when iFlytek cloud is selected above; Fill APP ID, API Key, and API Secret to use your own iFlytek app; leave blank or click "Reset to defaults" to use server default configuration.',
	'setting.cloudTts.xfyunPreview': 'iFlytek preview',
	'setting.cloudTts.xfyunTitle': 'xfyun voice settings',
	'setting.language.current': 'Current: {lang}',
	'setting.language.en': 'English',
	'setting.language.zh': '中文（简体）',
	'setting.llm.activeHint': '{modelName} model configuration is in use',
	'setting.llm.apiKey': 'API Key',
	'setting.llm.apiKeyConfigured': 'Configured: {{mask}}',
	'setting.llm.apiKeyKeepPlaceholder': 'Leave blank to keep saved key',
	'setting.llm.apiKeyPlaceholder': 'Enter API Key',
	'setting.llm.apiSecretPlaceholder': 'Enter API Secret',
	'setting.llm.appIdPlaceholder': 'Enter APP ID',
	'setting.llm.baseUrl': 'Base URL',
	'setting.llm.baseUrlOption.deepseek': 'DeepSeek (api.deepseek.com)',
	'setting.llm.baseUrlOption.glm': 'Zhipu GLM (open.bigmodel.cn)',
	'setting.llm.baseUrlOption.siliconflow': 'SiliconFlow (api.siliconflow.cn)',
	'setting.llm.baseUrlPlaceholder': 'Enter base URL',
	'setting.llm.clear': 'Restore default configuration',
	'setting.llm.clearSuccess': 'Reverted to environment variables',
	'setting.llm.connectionDesc':
		'Enter the API Key, Base URL, and model name for your OpenAI-compatible endpoint, then save at the bottom.',
	'setting.llm.connectionTitle': 'Connection',
	'setting.llm.defaultHint': 'Default {modelName} model is in use',
	'setting.llm.desc':
		'Fill in API Key, Base URL, and model name, then click Save to enable custom LLM settings for chat, assistant, RAG, and English learning. Restore default turns off custom config and uses membership-based defaults.',
	'setting.llm.hideApiKey': 'Hide API Key',
	'setting.llm.incompleteDraftHint':
		'Complete all three fields, then save to apply the model',
	'setting.llm.incompleteHint':
		'Enabled but incomplete; still using environment variables',
	'setting.llm.modelName': 'Model name',
	'setting.llm.modelNamePlaceholder': 'Enter model name',
	'setting.llm.modelOption.deepseekChat': 'deepseek-chat',
	'setting.llm.modelOption.glm51': 'Pro/zai-org/GLM-5.1',
	'setting.llm.modelOption.glmFlash': 'glm-4.7-flash',
	'setting.llm.openPresets': 'Choose preset',
	'setting.llm.presetOrCustomHint':
		'Type directly in the field, or use the button on the right for presets',
	'setting.llm.readyToSaveHint': 'Save to apply your custom model',
	'setting.llm.save': 'Save model configuration',
	'setting.llm.saveSuccess': 'LLM settings saved',
	'setting.llm.showApiKey': 'Show API Key',
	'setting.llm.title': 'LLM configuration',
	'setting.llm.unsavedHint': 'Unsaved changes—please save',
	'setting.llm.vectorActiveHint':
		'{embeddingModel} vector configuration is in use',
	'setting.llm.vectorBgeOnlyActiveHint':
		'BGE-only vector mode active (knowledge_chunks_v2)',
	'setting.llm.vectorBgeOnlyDesc':
		'When enabled, indexing, RAG retrieval, and rerank use only BAAI/bge-large-zh-v1.5, BAAI/bge-reranker-v2-m3, and knowledge_chunks_v2—no other collections are queried.',
	'setting.llm.vectorBgeOnlyLabel': 'BGE vector collection only',
	'setting.llm.vectorClear': 'Restore vector defaults',
	'setting.llm.vectorClearSuccess': 'Vector settings reverted to defaults',
	'setting.llm.vectorCollectionName': 'Vector collection name',
	'setting.llm.vectorCollectionNamePlaceholder': 'Qdrant collection name',
	'setting.llm.vectorCollectionOption.default':
		'knowledge_chunks_v2 (default 1024-dim)',
	'setting.llm.vectorCollectionOption.qwen3':
		'knowledge_chunks_qwen3_2560 (2560-dim)',
	'setting.llm.vectorDefaultHint':
		'Using default vector model {embeddingModel}',
	'setting.llm.vectorDesc':
		'Embedding and rerank models for Knowledge indexing and RAG. Provide full URLs for both embeddings and rerank endpoints.',
	'setting.llm.vectorEmbeddingModel': 'Embedding model',
	'setting.llm.vectorEmbeddingModelPlaceholder': 'Embedding model name',
	'setting.llm.vectorEmbeddingUrl': 'Vector model URL',
	'setting.llm.vectorEmbeddingUrlOption.siliconflow':
		'SiliconFlow embeddings (api.siliconflow.cn/v1/embeddings)',
	'setting.llm.vectorEmbeddingUrlPlaceholder': 'Full vector model endpoint URL',
	'setting.llm.vectorIncompleteDraftHint':
		'Complete all vector fields before saving',
	'setting.llm.vectorModelOption.bgeLargeZh': 'BAAI/bge-large-zh-v1.5',
	'setting.llm.vectorModelOption.qwen3Emb': 'Qwen/Qwen3-Embedding-4B',
	'setting.llm.vectorReadyToSaveHint':
		'Save to apply your vector configuration',
	'setting.llm.vectorRerankModel': 'Rerank model',
	'setting.llm.vectorRerankModelPlaceholder': 'Rerank model name',
	'setting.llm.vectorRerankOption.bgeReranker': 'BAAI/bge-reranker-v2-m3',
	'setting.llm.vectorRerankOption.qwen3Rerank': 'Qwen/Qwen3-Reranker-4B',
	'setting.llm.vectorRerankUrl': 'Rerank model URL',
	'setting.llm.vectorRerankUrlOption.siliconflow':
		'SiliconFlow rerank (api.siliconflow.cn/v1/rerank)',
	'setting.llm.vectorRerankUrlPlaceholder': 'Full rerank model endpoint URL',
	'setting.llm.vectorSave': 'Save vector configuration',
	'setting.llm.vectorSaveSuccess': 'Vector settings saved',
	'setting.llm.vectorSearchProfilesDesc':
		'Each save records collections below; RAG always searches them plus the system default bge collection (knowledge_chunks_v2), even if not listed here.',
	'setting.llm.vectorSearchProfilesTitle': 'Collections included in search',
	'setting.llm.vectorTitle': 'Vector model configuration',
	'setting.llm.vectorUnsavedHint': 'Unsaved vector changes—please save',
	'setting.menu.about': 'About',
	'setting.menu.cloudTts': 'Voice settings',
	'setting.menu.language': 'Language',
	'setting.menu.llm': 'Model configuration',
	'setting.menu.system': 'System',
	'setting.menu.theme': 'Theme',
	'setting.system.close.closeApp': 'When closing the app',
	'setting.system.close.minimizeToTray': 'Minimize to tray and keep running',
	'setting.system.close.quit': 'Quit the app',
	'setting.system.close.title': 'Close behavior',
	'setting.system.localTts.autoOption': 'Default (Karen)',
	'setting.system.localTts.desc':
		'English learning uses local browser speech. Pick a voice from female/male groups and preview. Preferences are saved on this device for the signed-in account.',
	'setting.system.localTts.enabledHelp':
		'When on, speaker buttons in English learning use the local voice above. Mutually exclusive with Cloud voice settings below. Non-members always use local playback.',
	'setting.system.localTts.enabledLabel': 'Use local voice for playback',
	'setting.system.localTts.groupFemale': 'Female',
	'setting.system.localTts.groupMale': 'Male',
	'setting.system.localTts.noVoices':
		'No English voices found. Install voices in system accessibility / speech settings, then retry.',
	'setting.system.localTts.preview': 'Preview',
	'setting.system.localTts.previewText':
		'This is a preview of the cloud reading effect with the parameters set above.',
	'setting.system.localTts.title': 'Local voice settings',
	'setting.system.localTts.unsupported':
		'Local speech synthesis is not available in this environment.',
	'setting.system.localTts.voiceLabel': 'Voice',
	'setting.system.shortcuts.conflictMessage':
		'This shortcut conflicts with “{label}”. Please use another combination.',
	'setting.system.shortcuts.conflictTitle': 'Shortcut conflict',
	'setting.system.shortcuts.desc':
		'App visibility/reload (including window actions) sync to the menu bar; knowledge and other shortcuts only work in their windows.',
	'setting.system.shortcuts.globalOnlyDesktop':
		'Global shortcuts are only available in the desktop app',
	'setting.system.shortcuts.group.appVisibility': 'App visibility / refresh',
	'setting.system.shortcuts.group.other': 'Other',
	'setting.system.shortcuts.item.file.quit': 'Quit',
	'setting.system.shortcuts.item.hide': 'Hide app',
	'setting.system.shortcuts.item.hideOrShowApp': 'Toggle app visibility',
	'setting.system.shortcuts.item.knowledge.bar.diff':
		'Editor: Split diff (Diff)',
	'setting.system.shortcuts.item.knowledge.bar.editSource':
		'Editor: Edit source',
	'setting.system.shortcuts.item.knowledge.bar.followBidirectional':
		'Editor: Bidirectional follow',
	'setting.system.shortcuts.item.knowledge.bar.followEditorFollowsPreview':
		'Editor: Editor follows preview',
	'setting.system.shortcuts.item.knowledge.bar.followPreviewFollowsEditor':
		'Editor: Preview follows editor',
	'setting.system.shortcuts.item.knowledge.bar.previewRender':
		'Editor: Preview render',
	'setting.system.shortcuts.item.knowledge.bar.resetPosition':
		'Editor: Reset position',
	'setting.system.shortcuts.item.knowledge.bar.splitPreview':
		'Editor: Split preview',
	'setting.system.shortcuts.item.knowledge.bar.toggleAssistant':
		'Editor: Toggle AI assistant',
	'setting.system.shortcuts.item.knowledge.bar.toggleAutoSave':
		'Editor: Toggle auto save',
	'setting.system.shortcuts.item.knowledge.bar.toggleOverrideSave':
		'Editor: Toggle override save',
	'setting.system.shortcuts.item.knowledge.clearDraft': 'General: New',
	'setting.system.shortcuts.item.knowledge.import': 'Knowledge: Import file',
	'setting.system.shortcuts.item.knowledge.openList': 'Knowledge: Open list',
	'setting.system.shortcuts.item.knowledge.openTrash': 'Knowledge: Open trash',
	'setting.system.shortcuts.item.knowledge.save': 'General: Save',
	'setting.system.shortcuts.item.knowledge.sendSelectionToAssistant':
		'Knowledge: Send selection to assistant input',
	'setting.system.shortcuts.item.knowledge.share': 'Knowledge: Share article',
	'setting.system.shortcuts.item.knowledge.toggleActionBar':
		'Editor: Toggle action bar',
	'setting.system.shortcuts.item.openSubwindow': 'Open subwindow',
	'setting.system.shortcuts.item.reload': 'Reload app',
	'setting.system.shortcuts.item.window.center': 'Center window',
	'setting.system.shortcuts.item.window.close': 'Close window',
	'setting.system.shortcuts.item.window.fill': 'Fill window',
	'setting.system.shortcuts.item.window.fullscreen': 'Full screen',
	'setting.system.shortcuts.item.window.minimize': 'Minimize window',
	'setting.system.shortcuts.item.window.scale': 'Zoom window',
	'setting.system.shortcuts.pressKey': 'Press keys to set a shortcut',
	'setting.system.shortcuts.registerFailed':
		'Failed to register global shortcut',
	'setting.system.shortcuts.separator': ': ',
	'setting.system.shortcuts.title': 'Keyboard shortcuts',
	'setting.system.startup.autoStart': 'Launch at startup',
	'setting.system.startup.autoStartOff': 'Do not launch at startup',
	'setting.system.startup.autoStartOn': 'Launch at startup',
	'setting.system.startup.autoStartOnlyDesktop':
		'Launch at startup is only available in the desktop app',
	'setting.system.startup.title': 'Startup',
	'setting.system.storage.changeDir': 'Change directory',
	'setting.system.storage.defaultPath': 'Default storage path',
	'setting.system.storage.selectDirOnlyDesktop':
		'Selecting a storage directory is only available in the desktop app',
	'setting.system.storage.title': 'File storage',
	'setting.theme.accent.canglang': 'Ochre',
	'setting.theme.accent.canglang.desc': 'Warm and solid, earthen flame',
	'setting.theme.accent.qiansui': 'Evergreen',
	'setting.theme.accent.qiansui.desc': 'Deep and still, forest moss',
	'setting.theme.accent.teal': 'Default',
	'setting.theme.accent.teal.desc': 'Classic teal, clear and crisp',
	'setting.theme.accent.tuoyan': 'Dai teal',
	'setting.theme.accent.tuoyan.desc': 'Quiet and composed, midnight lake',
	'setting.theme.accent.wuxin': 'Xiang yellow',
	'setting.theme.accent.wuxin.desc': 'Bright and clear, golden glow',
	'setting.theme.accent.xicao': 'Pine flower',
	'setting.theme.accent.xicao.desc': 'Soft and pale, morning mist',
	'setting.theme.accent.xueqing': 'Indigo',
	'setting.theme.accent.xueqing.desc': 'Steady and open, deep sea sky',
	'setting.theme.accent.yuebai': 'Lime',
	'setting.theme.accent.yuebai.desc': 'Fresh and vivid, spring buds',
	'setting.theme.accent.yushi': 'Apricot',
	'setting.theme.accent.yushi.desc': 'Warm and friendly, autumn light',
	'setting.theme.accent.zhizi': 'Peach pink',
	'setting.theme.accent.zhizi.desc': 'Bright and lively, full bloom',
	'setting.theme.accentTitle': 'Accent color',
	'setting.theme.color.beige': 'Beige',
	'setting.theme.color.black': 'Black',
	'setting.theme.color.blue': 'Blue',
	'setting.theme.color.bluePurple': 'Blue-purple',
	'setting.theme.color.cyanBlue': 'Cyan-blue',
	'setting.theme.color.green': 'Green',
	'setting.theme.color.orange': 'Orange',
	'setting.theme.color.purple': 'Purple',
	'setting.theme.color.red': 'Red',
	'setting.theme.color.white': 'White',
	'setting.theme.colorTitle': 'Color themes',
	'setting.theme.preview.accent.desc':
		'Hover, selected, links, buttons, and other interactive accents.',
	'setting.theme.preview.accent.title': 'Accent color',
	'setting.theme.preview.border.title': 'Border',
	'setting.theme.preview.cardBg.desc':
		'This preview container uses theme-card. Switch themes above to see changes.',
	'setting.theme.preview.cardBg.title': 'Card background',
	'setting.theme.preview.foreground.desc':
		'Primary foreground color for headings and emphasis.',
	'setting.theme.preview.foreground.title': 'Title / foreground text',
	'setting.theme.preview.mutedBg.desc':
		'Text on muted background still uses textcolor; hierarchy is created by the background.',
	'setting.theme.preview.mutedBg.title': 'Muted background',
	'setting.theme.preview.mutedText.desc':
		'Descriptions, timestamps, placeholders, and other secondary information.',
	'setting.theme.preview.mutedText.title': 'Secondary text',
	'setting.theme.preview.pageBg.title': 'Page background',
	'setting.theme.preview.ring.title': 'Focus ring',
	'setting.theme.preview.secondary.desc':
		'Used for sidebar items and secondary panels.',
	'setting.theme.preview.secondary.title': 'Secondary surface',
	'setting.theme.preview.selection.desc':
		'Selection background and foreground preview',
	'setting.theme.preview.selection.title': 'Text selection',
	'setting.theme.preview.text.desc':
		'Sample text for comparing themes. Backgrounds, card colors, and text colors change with the theme.',
	'setting.theme.preview.text.title': 'Body text',
	'setting.theme.preview.tip':
		'After selecting a color theme, the page background will follow the theme color.',
	'setting.theme.previewTitle': 'Theme preview',
};
