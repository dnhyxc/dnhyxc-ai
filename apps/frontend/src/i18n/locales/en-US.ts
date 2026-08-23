export const enUS = {
	'common.language': 'Language',
	'common.theme': 'Theme',
	'common.settings': 'Settings',
	'common.appTitle': 'Smart Chat',
	'common.loading': 'Loading...',
	'common.loadingEffort': 'Working hard to load...',
	'common.loadingMore': 'Loading more...',
	'common.noMore': 'No more',
	'common.loadFailed': 'Load failed',
	'common.deleteFailed': 'Delete failed',
	'common.tryLater': 'Please try again later.',
	'common.networkErrorTryAgain':
		'Network error. Please check your connection and try again.',
	'common.requestFailed': 'Request failed. Please try again later.',
	'common.delete': 'Delete',
	'common.cancel': 'Cancel',
	'common.confirm': 'Confirm',
	'common.copy': 'Copy',
	'common.download': 'Download',
	'common.downloading': 'Downloading...',
	'common.loaded': 'loaded {count} {type}',
	'common.type-1': 'of them',
	'common.type-2': 'items',
	'common.type-3': 'items',
	'common.publicBadge': 'Public',
	'common.makePrivate': 'Make private',

	'image.loadFailed': 'Image failed to load',

	// ImagePreview 组件文案
	'imagePreview.title': 'Image preview',
	'imagePreview.mermaidTitle': 'Mermaid preview',
	'imagePreview.zoomIn': 'Zoom in',
	'imagePreview.zoomOut': 'Zoom out',
	'imagePreview.rotate': 'Rotate',
	'imagePreview.reset': 'Reset',
	'imagePreview.prev': 'Previous',
	'imagePreview.next': 'Next',
	'imagePreview.close': 'Close',

	'upload.tooltip.default': 'Only PDF, Word, and Excel files are supported',
	'upload.uploading': 'Uploading...',
	'upload.button': 'Upload file',
	'upload.error.maxCount': 'You can upload up to {maxCount} files at a time',
	'upload.error.invalidType': 'Unsupported file type: {type}',
	'upload.error.maxSize': 'File size cannot exceed {maxSizeMb} MB',

	'dragUpload.tip.prefix': 'Drag an image here or',
	'dragUpload.tip.clickToSelect': 'click to select',
	'dragUpload.tip.info': 'Supports JPEG, PNG, GIF, SVG, WebP. Max 5MB.',
	'dragUpload.error.invalidType': 'Unsupported file type: {type}',
	'dragUpload.error.maxSize': 'File size cannot exceed {maxSizeMb} MB',

	// 导航栏文案
	'nav.home': 'Home',
	'nav.knowledge': 'Knowledge',
	'nav.ebook': 'Bookshelf',
	'nav.chat': 'Smart Chat',
	'nav.englishLearning': 'English',
	'nav.plugins': 'Plugins',
	'nav.remoteDemo': 'Plugin Demo',
	'nav.remoteCounter': 'Counter Plugin',
	'nav.pay': 'Membership',
	'nav.profile': 'Profile',
	'nav.switchAccount': 'Switch account',

	'profile.section.basic': 'Profile details',
	'profile.section.voice': 'Voice input',
	'profile.fields.roles': 'Roles',
	'profile.badge.member': 'Member',
	'profile.badge.nonMember': 'Free',
	'profile.membership.title': 'Unlock membership benefits',
	'profile.membership.desc':
		'Purchase or renew your membership for more quota and perks. Checkout runs in a secure payment window.',
	'profile.membership.benefitsTitle': 'Membership benefits',
	'profile.membership.benefit1':
		'Higher quota for chat, documents, and related features—fewer interruptions from limits.',
	'profile.membership.benefit2':
		'Pay through the embedded Stripe checkout—clear, traceable billing.',
	'profile.membership.benefit3':
		'Benefits evolve with the product; exact quota and terms are shown on the billing page.',
	'profile.actions.buyMembership': 'Buy membership',
	'profile.actions.renewMembership': 'Renew membership',
	'profile.membership.expiresAt': 'Valid until {date}',
	'profile.membership.nonMemberHint':
		"You aren't a member yet. Purchase membership to unlock premium benefits.",
	'profile.actions.editAccount': 'Edit account',
	'profile.actions.goPay': 'Go to billing',
	'profile.empty.title': 'No profile data yet',
	'profile.empty.hint': 'Please sign in again.',
	'profile.actions.goLogin': 'Sign in',
	'profile.voice.desc':
		'When enabled, desktop (Tauri) chat supports speech-to-text with live transcription into the input. When off, only text input and send are available.',
	'profile.voice.enableLabel': 'Enable speech-to-text',

	// 设置菜单文案
	'setting.menu.system': 'System',
	'setting.menu.theme': 'Theme',
	'setting.menu.language': 'Language',
	'setting.menu.about': 'About',
	'setting.menu.llm': 'Model configuration',
	'setting.menu.cloudTts': 'Voice settings',
	'setting.llm.title': 'LLM configuration',
	'setting.llm.desc':
		'Fill in API Key, Base URL, and model name, then click Save to enable custom LLM settings for chat, assistant, RAG, and English learning. Restore default turns off custom config and uses membership-based defaults.',
	'setting.llm.connectionTitle': 'Connection',
	'setting.llm.connectionDesc':
		'Enter the API Key, Base URL, and model name for your OpenAI-compatible endpoint, then save at the bottom.',
	'setting.llm.baseUrl': 'Base URL',
	'setting.llm.baseUrlPlaceholder': 'Enter base URL',
	'setting.llm.openPresets': 'Choose preset',
	'setting.llm.presetOrCustomHint':
		'Type directly in the field, or use the button on the right for presets',
	'setting.llm.baseUrlOption.siliconflow': 'SiliconFlow (api.siliconflow.cn)',
	'setting.llm.baseUrlOption.glm': 'Zhipu GLM (open.bigmodel.cn)',
	'setting.llm.baseUrlOption.deepseek': 'DeepSeek (api.deepseek.com)',
	'setting.llm.modelName': 'Model name',
	'setting.llm.modelNamePlaceholder': 'Enter model name',
	'setting.llm.modelOption.glmFlash': 'glm-4.7-flash',
	'setting.llm.modelOption.glm51': 'Pro/zai-org/GLM-5.1',
	'setting.llm.modelOption.deepseekChat': 'deepseek-chat',
	'setting.llm.apiKey': 'API Key',
	'setting.llm.apiKeyPlaceholder': 'Enter API Key',
	'setting.llm.apiSecretPlaceholder': 'Enter API Secret',
	'setting.llm.appIdPlaceholder': 'Enter APP ID',
	'setting.llm.showApiKey': 'Show API Key',
	'setting.llm.hideApiKey': 'Hide API Key',
	'setting.llm.apiKeyKeepPlaceholder': 'Leave blank to keep saved key',
	'setting.llm.apiKeyConfigured': 'Configured: {{mask}}',
	'setting.llm.save': 'Save model configuration',
	'setting.llm.clear': 'Restore default configuration',
	'setting.llm.saveSuccess': 'LLM settings saved',
	'setting.llm.clearSuccess': 'Reverted to environment variables',
	'setting.llm.activeHint': '{modelName} model configuration is in use',
	'setting.llm.unsavedHint': 'Unsaved changes—please save',
	'setting.llm.readyToSaveHint': 'Save to apply your custom model',
	'setting.llm.incompleteDraftHint':
		'Complete all three fields, then save to apply the model',
	'setting.llm.defaultHint': 'Default {modelName} model is in use',
	'setting.llm.incompleteHint':
		'Enabled but incomplete; still using environment variables',
	'setting.llm.vectorTitle': 'Vector model configuration',
	'setting.llm.vectorDesc':
		'Embedding and rerank models for Knowledge indexing and RAG. Provide full URLs for both embeddings and rerank endpoints.',
	'setting.llm.vectorEmbeddingUrl': 'Vector model URL',
	'setting.llm.vectorEmbeddingUrlPlaceholder': 'Full vector model endpoint URL',
	'setting.llm.vectorEmbeddingUrlOption.siliconflow':
		'SiliconFlow embeddings (api.siliconflow.cn/v1/embeddings)',
	'setting.llm.vectorRerankUrl': 'Rerank model URL',
	'setting.llm.vectorRerankUrlPlaceholder': 'Full rerank model endpoint URL',
	'setting.llm.vectorRerankUrlOption.siliconflow':
		'SiliconFlow rerank (api.siliconflow.cn/v1/rerank)',
	'setting.llm.vectorEmbeddingModel': 'Embedding model',
	'setting.llm.vectorEmbeddingModelPlaceholder': 'Embedding model name',
	'setting.llm.vectorModelOption.bgeLargeZh': 'BAAI/bge-large-zh-v1.5',
	'setting.llm.vectorModelOption.qwen3Emb': 'Qwen/Qwen3-Embedding-4B',
	'setting.llm.vectorRerankModel': 'Rerank model',
	'setting.llm.vectorRerankModelPlaceholder': 'Rerank model name',
	'setting.llm.vectorRerankOption.bgeReranker': 'BAAI/bge-reranker-v2-m3',
	'setting.llm.vectorRerankOption.qwen3Rerank': 'Qwen/Qwen3-Reranker-4B',
	'setting.llm.vectorCollectionName': 'Vector collection name',
	'setting.llm.vectorCollectionNamePlaceholder': 'Qdrant collection name',
	'setting.llm.vectorCollectionOption.default':
		'knowledge_chunks_v2 (default 1024-dim)',
	'setting.llm.vectorCollectionOption.qwen3':
		'knowledge_chunks_qwen3_2560 (2560-dim)',
	'setting.llm.vectorSearchProfilesTitle': 'Collections included in search',
	'setting.llm.vectorSearchProfilesDesc':
		'Each save records collections below; RAG always searches them plus the system default bge collection (knowledge_chunks_v2), even if not listed here.',
	'setting.llm.vectorApiKey': 'API Key',
	'setting.llm.vectorSave': 'Save vector configuration',
	'setting.llm.vectorClear': 'Restore vector defaults',
	'setting.llm.vectorSaveSuccess': 'Vector settings saved',
	'setting.llm.vectorClearSuccess': 'Vector settings reverted to defaults',
	'setting.llm.vectorActiveHint':
		'{embeddingModel} vector configuration is in use',
	'setting.llm.vectorUnsavedHint': 'Unsaved vector changes—please save',
	'setting.llm.vectorReadyToSaveHint':
		'Save to apply your vector configuration',
	'setting.llm.vectorIncompleteDraftHint':
		'Complete all vector fields before saving',
	'setting.llm.vectorDefaultHint':
		'Using default vector model {embeddingModel}',
	'setting.llm.vectorBgeOnlyLabel': 'BGE vector collection only',
	'setting.llm.vectorBgeOnlyDesc':
		'When enabled, indexing, RAG retrieval, and rerank use only BAAI/bge-large-zh-v1.5, BAAI/bge-reranker-v2-m3, and knowledge_chunks_v2—no other collections are queried.',
	'setting.llm.vectorBgeOnlyActiveHint':
		'BGE-only vector mode active (knowledge_chunks_v2)',
	'setting.cloudTts.title': 'Cloud voice settings',
	'setting.cloudTts.desc':
		'When MiniMax cloud is selected above, fill in API Key and model name to use custom settings; leave blank or click "Reset to defaults" to use default configuration.',
	'setting.cloudTts.playbackSourceTitle': 'Playback source',
	'setting.cloudTts.playbackSourceHelp':
		'Active members choose one: local Web Speech, Edge cloud, MiniMax cloud, or iFlytek online TTS.',
	'setting.cloudTts.playbackSourceHelpFree':
		'Choose one: local Web Speech or Edge cloud (free).',
	'setting.cloudTts.playbackSource.local': 'Local voice',
	'setting.cloudTts.playbackSource.cloud': 'MiniMax cloud',
	'setting.cloudTts.playbackSource.xfyun': 'iFlytek cloud',
	'setting.cloudTts.playbackSource.edge': 'Edge cloud',
	'setting.cloudTts.playbackSourceHelp.local':
		'Browser Web Speech; voice from the local section below.',
	'setting.cloudTts.playbackSourceHelp.cloud':
		'MiniMax streaming synthesis; parameters in the MiniMax section below.',
	'setting.cloudTts.playbackSourceHelp.xfyun':
		'iFlytek online synthesis; good for Chinese narration; see the iFlytek section below.',
	'setting.cloudTts.playbackSourceHelp.edge':
		'Microsoft Edge online TTS; see Edge section below.',
	'setting.cloudTts.xfyunTitle': 'xfyun voice settings',
	'setting.cloudTts.xfyunCredentialsHint':
		'Applies when iFlytek cloud is selected above; Fill APP ID, API Key, and API Secret to use your own iFlytek app; leave blank or click "Reset to defaults" to use server default configuration.',
	'setting.cloudTts.xfyunAppId': 'APP ID',
	'setting.cloudTts.xfyunApiKey': 'API Key',
	'setting.cloudTts.xfyunApiSecret': 'API Secret',
	'setting.cloudTts.xfyunVoice': 'Voice',
	'setting.cloudTts.xfyunSpeed': 'Speed',
	'setting.cloudTts.xfyunVolume': 'Volume',
	'setting.cloudTts.xfyunPitch': 'Pitch',
	'setting.cloudTts.xfyunPreview': 'iFlytek preview',
	'setting.cloudTts.edgeTitle': 'Edge voice settings',
	'setting.cloudTts.edgeHint':
		'Applies when Edge cloud is selected above; Microsoft Edge online TTS.',
	'setting.cloudTts.edgeVoice': 'Voice',
	'setting.cloudTts.edgePreview': 'Edge preview',
	'setting.cloudTts.paramsTitle': 'Playback parameters',
	'setting.cloudTts.paramsDesc':
		'Voice, speed, audio format, and related options.',
	'setting.cloudTts.minimaxCredentialsHint':
		'Leave API Key empty to use the server environment variable; model name falls back to server config when empty.',
	'setting.cloudTts.minimaxApiKey': 'API Key',
	'setting.cloudTts.paramsHelpAria': 'Playback parameter field help',
	'setting.cloudTts.paramsHelpTitle': 'Field reference',
	'setting.cloudTts.fieldHelp.model':
		'Cloud synthesis model, e.g. speech-2.8-turbo (default, faster) or hd (higher quality).',
	'setting.cloudTts.fieldHelp.voiceId':
		'Voice used for playback; choose from the preset list.',
	'setting.cloudTts.fieldHelp.speed':
		'Speech rate from 0.5 to 2; 1 is normal speed.',
	'setting.cloudTts.fieldHelp.vol':
		'Volume from 0.01 to 10; default 5—louder values increase output (1 is standard volume).',
	'setting.cloudTts.fieldHelp.pitch':
		'Pitch from -12 to 12; 0 is neutral—positive is higher, negative is lower.',
	'setting.cloudTts.fieldHelp.emotionIntro':
		'Optional emotional style; choose none to omit and use the voice default.',
	'setting.cloudTts.emotion.happy': 'Happy',
	'setting.cloudTts.emotion.sad': 'Sad',
	'setting.cloudTts.emotion.angry': 'Angry',
	'setting.cloudTts.emotion.fearful': 'Fearful',
	'setting.cloudTts.emotion.disgusted': 'Disgusted',
	'setting.cloudTts.emotion.surprised': 'Surprised',
	'setting.cloudTts.emotion.calm': 'Neutral',
	'setting.cloudTts.emotion.fluent': 'Lively',
	'setting.cloudTts.fieldHelp.format':
		'Output format; mp3 is universal—pcm/wav if your player or pipeline needs them.',
	'setting.cloudTts.fieldHelp.languageBoost':
		'Tells the engine which language to optimize pronunciation for, reducing misread language or odd accent. Choose English or Chinese when the text is mostly one language; use Auto when mixed or unsure.',
	'setting.cloudTts.fieldHelp.sampleRate':
		'Sample rate in Hz; default 32000. Higher can mean more detail and larger files.',
	'setting.cloudTts.fieldHelp.bitrate':
		'Bitrate affects compressed quality and file size; default 128000.',
	'setting.cloudTts.fieldHelp.channel':
		'1 = mono (recommended for narration), 2 = stereo.',
	'setting.cloudTts.enabledLabel': 'Use custom playback parameters',
	'setting.cloudTts.enabledHelp':
		'When on, cloud playback uses the parameters below; when off, server defaults apply.',
	'setting.cloudTts.playbackLabel': 'Use cloud voice for playback',
	'setting.cloudTts.playbackHelp':
		'Mutually exclusive with “Use local voice for playback” above; the parameter form applies when this is on.',
	'setting.cloudTts.openPresets': 'Choose preset',
	'setting.cloudTts.model': 'Model',
	'setting.cloudTts.modelPlaceholder': 'Enter model name',
	'setting.cloudTts.modelOption.speech28Hd': 'speech-2.8-hd (higher quality)',
	'setting.cloudTts.modelOption.speech28Turbo': 'speech-2.8-turbo (default)',
	'setting.cloudTts.voiceId': 'Voice category',
	'setting.cloudTts.voiceGroup.female': 'Female',
	'setting.cloudTts.voiceGroup.male': 'Male',
	'setting.cloudTts.speed': 'Speed',
	'setting.cloudTts.vol': 'Volume',
	'setting.cloudTts.pitch': 'Pitch',
	'setting.cloudTts.emotion': 'Emotion',
	'setting.cloudTts.emotionNone': 'None (default)',
	'setting.cloudTts.format': 'Audio format',
	'setting.cloudTts.languageBoost': 'Language boost',
	'setting.cloudTts.languageBoostOption.auto': 'Auto',
	'setting.cloudTts.languageBoostOption.English': 'English',
	'setting.cloudTts.languageBoostOption.Chinese': 'Chinese',
	'setting.cloudTts.sampleRate': 'Sample rate',
	'setting.cloudTts.bitrate': 'Bitrate',
	'setting.cloudTts.channel': 'Channels',
	'setting.cloudTts.advancedHint':
		'Advanced audio parameters; defaults are usually fine.',
	'setting.cloudTts.reset': 'Reset to defaults',
	'setting.cloudTts.decreaseValue': 'Decrease {label}',
	'setting.cloudTts.increaseValue': 'Increase {label}',
	'setting.cloudTts.preview': 'Cloud preview',
	'setting.cloudTts.previewText':
		'This is a preview of the cloud reading effect with the parameters set above.',
	'setting.theme.colorTitle': 'Color themes',
	'setting.theme.color.white': 'White',
	'setting.theme.color.black': 'Black',
	'setting.theme.color.green': 'Green',
	'setting.theme.color.purple': 'Purple',
	'setting.theme.color.bluePurple': 'Blue-purple',
	'setting.theme.color.blue': 'Blue',
	'setting.theme.color.cyanBlue': 'Cyan-blue',
	'setting.theme.color.orange': 'Orange',
	'setting.theme.color.red': 'Red',
	'setting.theme.color.beige': 'Beige',
	'setting.theme.accentTitle': 'Accent color',
	'setting.theme.accent.teal': 'Default',
	'setting.theme.accent.teal.desc': 'Classic teal, clear and crisp',
	'setting.theme.accent.yuebai': 'Lime',
	'setting.theme.accent.yuebai.desc': 'Fresh and vivid, spring buds',
	'setting.theme.accent.zhizi': 'Peach pink',
	'setting.theme.accent.zhizi.desc': 'Bright and lively, full bloom',
	'setting.theme.accent.xueqing': 'Indigo',
	'setting.theme.accent.xueqing.desc': 'Steady and open, deep sea sky',
	'setting.theme.accent.canglang': 'Ochre',
	'setting.theme.accent.canglang.desc': 'Warm and solid, earthen flame',
	'setting.theme.accent.wuxin': 'Xiang yellow',
	'setting.theme.accent.wuxin.desc': 'Bright and clear, golden glow',
	'setting.theme.accent.yushi': 'Apricot',
	'setting.theme.accent.yushi.desc': 'Warm and friendly, autumn light',
	'setting.theme.accent.tuoyan': 'Dai teal',
	'setting.theme.accent.tuoyan.desc': 'Quiet and composed, midnight lake',
	'setting.theme.accent.xicao': 'Pine flower',
	'setting.theme.accent.xicao.desc': 'Soft and pale, morning mist',
	'setting.theme.accent.qiansui': 'Evergreen',
	'setting.theme.accent.qiansui.desc': 'Deep and still, forest moss',
	'setting.theme.previewTitle': 'Theme preview',
	'setting.theme.preview.cardBg.title': 'Card background',
	'setting.theme.preview.cardBg.desc':
		'This preview container uses theme-card. Switch themes above to see changes.',
	'setting.theme.preview.tip':
		'After selecting a color theme, the page background will follow the theme color.',
	'setting.theme.preview.pageBg.title': 'Page background',
	'setting.theme.preview.foreground.title': 'Title / foreground text',
	'setting.theme.preview.foreground.desc':
		'Primary foreground color for headings and emphasis.',
	'setting.theme.preview.text.title': 'Body text',
	'setting.theme.preview.text.desc':
		'Sample text for comparing themes. Backgrounds, card colors, and text colors change with the theme.',
	'setting.theme.preview.mutedText.title': 'Secondary text',
	'setting.theme.preview.mutedText.desc':
		'Descriptions, timestamps, placeholders, and other secondary information.',
	'setting.theme.preview.accent.title': 'Accent color',
	'setting.theme.preview.accent.desc':
		'Hover, selected, links, buttons, and other interactive accents.',
	'setting.theme.preview.mutedBg.title': 'Muted background',
	'setting.theme.preview.mutedBg.desc':
		'Text on muted background still uses textcolor; hierarchy is created by the background.',
	'setting.theme.preview.secondary.title': 'Secondary surface',
	'setting.theme.preview.secondary.desc':
		'Used for sidebar items and secondary panels.',
	'setting.theme.preview.selection.title': 'Text selection',
	'setting.theme.preview.selection.desc':
		'Selection background and foreground preview',
	'setting.theme.preview.border.title': 'Border',
	'setting.theme.preview.ring.title': 'Focus ring',

	// System settings 文案
	'setting.system.storage.title': 'File storage',
	'setting.system.storage.defaultPath': 'Default storage path',
	'setting.system.storage.changeDir': 'Change directory',
	'setting.system.storage.selectDirOnlyDesktop':
		'Selecting a storage directory is only available in the desktop app',

	'setting.system.startup.title': 'Startup',
	'setting.system.startup.autoStart': 'Launch at startup',
	'setting.system.startup.autoStartOff': 'Do not launch at startup',
	'setting.system.startup.autoStartOn': 'Launch at startup',
	'setting.system.startup.autoStartOnlyDesktop':
		'Launch at startup is only available in the desktop app',

	'setting.system.close.title': 'Close behavior',
	'setting.system.close.closeApp': 'When closing the app',
	'setting.system.close.minimizeToTray': 'Minimize to tray and keep running',
	'setting.system.close.quit': 'Quit the app',

	'setting.system.localTts.title': 'Local voice settings',
	'setting.system.localTts.desc':
		'English learning uses local browser speech. Pick a voice from female/male groups and preview. Preferences are saved on this device for the signed-in account.',
	'setting.system.localTts.enabledLabel': 'Use local voice for playback',
	'setting.system.localTts.enabledHelp':
		'When on, speaker buttons in English learning use the local voice above. Mutually exclusive with Cloud voice settings below. Non-members always use local playback.',
	'setting.system.localTts.voiceLabel': 'Voice',
	'setting.system.localTts.autoOption': 'Default (Karen)',
	'setting.system.localTts.groupFemale': 'Female',
	'setting.system.localTts.groupMale': 'Male',
	'setting.system.localTts.genderTag.female': 'Female',
	'setting.system.localTts.genderTag.male': 'Male',
	'setting.system.localTts.preview': 'Preview',
	'setting.system.localTts.previewText':
		'This is a preview of the cloud reading effect with the parameters set above.',
	'setting.system.localTts.unsupported':
		'Local speech synthesis is not available in this environment.',
	'setting.system.localTts.noVoices':
		'No English voices found. Install voices in system accessibility / speech settings, then retry.',

	'setting.system.shortcuts.title': 'Keyboard shortcuts',
	'setting.system.shortcuts.desc':
		'App visibility/reload (including window actions) sync to the menu bar; knowledge and other shortcuts only work in their windows.',
	'setting.system.shortcuts.group.other': 'Other',
	'setting.system.shortcuts.group.knowledge': 'Knowledge',
	'setting.system.shortcuts.group.appVisibility': 'App visibility / refresh',
	'setting.system.shortcuts.separator': ': ',
	'setting.system.shortcuts.pressKey': 'Press keys to set a shortcut',
	'setting.system.shortcuts.conflictTitle': 'Shortcut conflict',
	'setting.system.shortcuts.conflictMessage':
		'This shortcut conflicts with “{label}”. Please use another combination.',
	'setting.system.shortcuts.globalOnlyDesktop':
		'Global shortcuts are only available in the desktop app',
	'setting.system.shortcuts.registerFailed':
		'Failed to register global shortcut',

	'setting.system.shortcuts.item.hide': 'Hide app',
	'setting.system.shortcuts.item.hideOrShowApp': 'Toggle app visibility',
	'setting.system.shortcuts.item.reload': 'Reload app',
	'setting.system.shortcuts.item.newWorkflow': 'Create workflow',
	'setting.system.shortcuts.item.openSubwindow': 'Open subwindow',
	'setting.system.shortcuts.item.window.minimize': 'Minimize window',
	'setting.system.shortcuts.item.window.close': 'Close window',
	'setting.system.shortcuts.item.window.scale': 'Zoom window',
	'setting.system.shortcuts.item.window.fill': 'Fill window',
	'setting.system.shortcuts.item.window.center': 'Center window',
	'setting.system.shortcuts.item.window.fullscreen': 'Full screen',
	'setting.system.shortcuts.item.file.about': 'About',
	'setting.system.shortcuts.item.file.logout': 'Log out',
	'setting.system.shortcuts.item.file.quit': 'Quit',
	'setting.system.shortcuts.item.knowledge.save': 'Knowledge: Save',
	'setting.system.shortcuts.item.knowledge.import': 'Knowledge: Import file',
	'setting.system.shortcuts.item.knowledge.clearDraft':
		'Knowledge: Clear draft',
	'setting.system.shortcuts.item.knowledge.share': 'Knowledge: Share article',
	'setting.system.shortcuts.item.knowledge.openList': 'Knowledge: Open list',
	'setting.system.shortcuts.item.knowledge.toggleActionBar':
		'Knowledge: Toggle action bar',
	'setting.system.shortcuts.item.knowledge.openTrash': 'Knowledge: Open trash',
	'setting.system.shortcuts.item.knowledge.sendSelectionToAssistant':
		'Knowledge: Send selection to assistant input',
	'setting.system.shortcuts.item.knowledge.bar.editSource':
		'Knowledge: Action bar: Edit source',
	'setting.system.shortcuts.item.knowledge.bar.diff':
		'Knowledge: Action bar: Split diff (Diff)',
	'setting.system.shortcuts.item.knowledge.bar.previewRender':
		'Knowledge: Action bar: Preview render',
	'setting.system.shortcuts.item.knowledge.bar.toggleAssistant':
		'Knowledge: Action bar: Toggle AI assistant',
	'setting.system.shortcuts.item.knowledge.bar.splitPreview':
		'Knowledge: Action bar: Split preview',
	'setting.system.shortcuts.item.knowledge.bar.followBidirectional':
		'Knowledge: Action bar: Bidirectional follow',
	'setting.system.shortcuts.item.knowledge.bar.followPreviewFollowsEditor':
		'Knowledge: Action bar: Preview follows editor',
	'setting.system.shortcuts.item.knowledge.bar.followEditorFollowsPreview':
		'Knowledge: Action bar: Editor follows preview',
	'setting.system.shortcuts.item.knowledge.bar.toggleOverrideSave':
		'Knowledge: Action bar: Toggle override save',
	'setting.system.shortcuts.item.knowledge.bar.toggleAutoSave':
		'Knowledge: Action bar: Toggle auto save',
	'setting.system.shortcuts.item.knowledge.bar.resetPosition':
		'Knowledge: Action bar: Reset position',

	'setting.about.toast.latestVersion': "You're on the latest version",
	'setting.about.toast.fetchVersionFailed': 'Failed to fetch version info',
	'setting.about.toast.relaunchFailed': 'Relaunch failed',
	'setting.about.toast.cacheCleared': 'Cache cleared',
	'setting.about.latestVersion': 'Latest version',
	'setting.about.releaseDate': 'Release date',
	'setting.about.checkUpdate': 'Check for updates',
	'setting.about.updateAndRelaunch': 'Update and relaunch',
	'setting.about.viewReleaseNotes': 'View release notes',
	'setting.about.download.downloading': 'Downloading',
	'setting.about.download.done': 'Download complete',
	'setting.about.update.title': 'Software update',
	'setting.about.update.notifyMe': 'Notify me when a new version is available',
	'setting.about.cache.title': 'App cache',
	'setting.about.cache.size': 'Current cache size ',
	'setting.about.cache.clear': 'Clear cache',
	'setting.about.relaunchDialog.title': 'Relaunch the app now?',
	'setting.about.relaunchDialog.desc':
		'The app is about to relaunch to finish updating. To keep your data safe, please save any unsaved work before relaunching. Unsaved data cannot be recovered after relaunch. We recommend confirming that important data has been saved before clicking "Relaunch now".',
	'setting.about.relaunchDialog.later': 'Relaunch later',
	'setting.about.relaunchDialog.now': 'Relaunch now',

	'router.window.aboutTitle': 'About dnhyxc-ai',

	// 语言设置文案
	'setting.language.title': 'Language',
	'setting.language.zh': '中文（简体）',
	'setting.language.en': 'English',
	'setting.language.current': 'Current: {lang}',

	// 头部切换语言文案
	'header.toggleLanguage': 'Toggle language',
	'header.breadcrumbNav': 'Breadcrumb',

	// Monaco 编辑器文案
	'monaco.placeholder': '# Start writing…',
	'monaco.topBar.bottomBar': 'Bottom bar',
	'monaco.topBar.bottomBar.expand': 'Expand Markdown bottom bar',
	'monaco.topBar.bottomBar.collapse': 'Collapse Markdown bottom bar',
	'monaco.loading.editor': 'Loading editor…',
	'monaco.loading.diffEditor': 'Loading diff editor…',
	'monaco.autoSaveInterval.seconds': '{n} sec',
	'monaco.autoSaveInterval.minutes': '{m} min',
	'monaco.bottomBar.aria.toolbar': 'Markdown bottom bar',
	'monaco.bottomBar.aria.view': 'Markdown view',
	'monaco.bottomBar.tip.drag': 'Drag to reposition the bottom bar',
	'monaco.bottomBar.aria.drag': 'Drag bottom bar position',
	'monaco.bottomBar.tip.edit': 'Edit source',
	'monaco.bottomBar.aria.edit': 'Edit source',
	'monaco.bottomBar.tip.diff.open':
		'Split diff: edit left, read-only diff on right',
	'monaco.bottomBar.tip.diff.close':
		'Close split diff: back to single-column editing',
	'monaco.bottomBar.aria.diff': 'Toggle split diff (Markdown)',
	'monaco.bottomBar.tip.preview': 'Preview',
	'monaco.bottomBar.aria.preview': 'Preview',
	'monaco.bottomBar.tip.assistant.open': 'Open AI assistant',
	'monaco.bottomBar.tip.assistant.close': 'Close AI assistant',
	'monaco.bottomBar.aria.assistant': 'Toggle AI assistant panel',
	'monaco.bottomBar.tip.split': 'Split: editor left, preview right',
	'monaco.bottomBar.aria.split': 'Split: editor left, preview right',
	'monaco.bottomBar.tip.follow.bidirectional':
		'Bidirectional: sync scrolling between editor and preview',
	'monaco.bottomBar.aria.follow.bidirectional':
		'Bidirectional scroll sync (editor ↔ preview)',
	'monaco.bottomBar.tip.follow.previewFollowsEditor':
		'Preview follows editor: scrolling the editor scrolls the preview',
	'monaco.bottomBar.aria.follow.previewFollowsEditor':
		'Preview follows editor scrolling',
	'monaco.bottomBar.tip.follow.editorFollowsPreview':
		'Editor follows preview: scrolling the preview scrolls the editor',
	'monaco.bottomBar.aria.follow.editorFollowsPreview':
		'Editor follows preview scrolling',
	'monaco.bottomBar.tip.overwrite.enabled':
		'Overwrite save enabled: same-name files will be overwritten',
	'monaco.bottomBar.tip.overwrite.disabled':
		'Enable overwrite save: overwrite same-name files without confirmation',
	'monaco.bottomBar.aria.overwrite.on': 'Enable overwrite save',
	'monaco.bottomBar.aria.overwrite.off': 'Disable overwrite save',
	'monaco.bottomBar.tip.autosave.enabled':
		'Auto-save enabled: save when modified at the selected interval',
	'monaco.bottomBar.tip.autosave.disabled':
		'Enable auto-save: save at intervals (may skip silently when needed)',
	'monaco.bottomBar.aria.autosave.on': 'Enable auto-save',
	'monaco.bottomBar.aria.autosave.off': 'Disable auto-save',
	'monaco.bottomBar.label.autosaveInterval': 'Auto-save interval',
	'monaco.bottomBar.aria.autosaveInterval': 'Auto-save interval',
	'monaco.bottomBar.tip.reset': 'Reset bottom bar position',
	'monaco.bottomBar.aria.reset': 'Reset bottom bar position',

	// Markdown 预览文案
	'markdown.preview.empty': 'Nothing to preview',
	'markdown.preview.loading': 'Loading preview…',
	'markdown.preview.scroll.toBottom': 'Scroll to bottom',
	'markdown.preview.scroll.toTop': 'Scroll to top',

	// 关于文案
	'about.appVersion': 'dnhyxc-ai version {version}',
	'about.copyright': 'Copyright © dnhyxc',
	'about.copyrightYears': 'Copyright © 2025 - 2026 Dnhyxc',
	'about.rightsReserved': 'All Rights Reserved',
	'about.links.policy': 'User service policy',
	'about.links.terms': 'Terms of service',
	'about.links.updateInfo': 'Release notes',

	'legal.backHome': 'Back to home',
	'legal.servicePolicy.title': 'User service policy',
	'legal.userAgreement.title': 'User service agreement',

	// 404 页面文案
	'notFound.title': '404 Not Found',
	'notFound.backHome': 'Back to home',

	// 账号文案
	'account.fields.nickname': 'Nickname',
	'account.fields.gender': 'Gender',
	'account.fields.email': 'Email',
	'account.fields.address': 'Address',

	// 账号输入框占位符文案
	'account.placeholders.nickname': 'Enter nickname',
	'account.placeholders.email': 'Enter email',
	'account.placeholders.address': 'Enter address',
	'account.placeholders.oldVerifyCode': 'Enter code for old email',
	'account.placeholders.newEmail': 'Enter new email',
	'account.placeholders.newVerifyCode': 'Enter code for new email',

	// 账号性别文案
	'account.gender.male': 'Male',
	'account.gender.female': 'Female',
	'account.gender.secret': 'Prefer not to say',

	// 账号头像更换文案
	'account.avatar.change': 'Change',

	// 账号邮箱编辑模态框文案
	'account.modal.editEmail': 'Edit email',

	// 账号验证码获取文案
	'account.actions.getVerifyCode': 'Get code',

	// 账号更新成功提示文案
	'account.toast.updateSuccess': 'Updated successfully.',
	'account.toast.updateFailed': 'Update failed.',
	'account.toast.verifyCodeSent': 'Verification code sent.',
	'account.toast.verifyCodeKeyMissing':
		'Verification code key cannot be empty.',
	'account.toast.emailUpdated': 'Email updated successfully.',

	// 账号邮箱重置文案
	'account.resetEmail.oldEmail': 'Old email',
	'account.resetEmail.oldVerifyCode': 'Old email code',
	'account.resetEmail.newEmail': 'New email',
	'account.resetEmail.newVerifyCode': 'New email code',

	// 账号验证码验证文案
	'account.validation.emailInvalid': 'Please enter a valid email address.',
	'account.validation.verifyCode6Digits': 'Verification code must be 6 digits.',

	'account.wechat.title': 'WeChat Mini Program',
	'account.wechat.hint':
		'Generate a 6-digit link code, then enter it on the "Bind Account" page in the reading mini program to merge with this web account.',
	'account.wechat.createCode': 'Generate link code',
	'account.wechat.refreshCode': 'Refresh link code',
	'account.wechat.codeLabel':
		'Enter in the mini program within {seconds} seconds',
	'account.wechat.codeCreated': 'Link code generated',
	'account.wechat.codeCopied': 'Link code copied',
	'account.wechat.codeCopyFailed': 'Copy failed, please try again',
	'account.wechat.codeFailed': 'Failed to generate link code',
	'account.wechat.bound': 'Linked to WeChat {id}',
	'account.wechat.unbind': 'Unlink',
	'account.wechat.unbindSuccess': 'WeChat unlinked',
	'account.wechat.unbindFailed': 'Failed to unlink',

	// 聊天会话文案
	'chat.newSession': 'New chat',
	'chat.sessionList.title': 'History',
	'chat.sessionList.empty': 'No conversations yet',
	'chat.sessionList.confirmDelete.title': 'Confirm delete',
	'chat.sessionList.confirmDelete.desc':
		'Are you sure you want to delete this conversation? This action cannot be undone.',
	'chat.sessionList.toast.titleUpdated': 'Chat title updated.',
	'chat.share.selectAll': 'Select all',
	'chat.share.selectedPairs': 'Selected {count} pairs',
	'chat.share.createLink': 'Create share link',
	'chat.newSession.welcomeTitle': 'Welcome to dnhyxc-ai Chat',
	'chat.newSession.welcomeHint': 'How can I help you?',

	// 聊天输入框文案
	'chat.entry.placeholder': 'Type your question',
	'chat.entry.attachments.textOnlyHint':
		'Only text in attachments will be recognized',
	'chat.entry.newChat': 'New chat',
	'chat.entry.upload.button': 'Upload attachments',
	'chat.entry.upload.maxFiles': 'Up to 5 files are supported',
	'chat.entry.upload.tooltip.supportedTypes':
		'Supported formats: PDF, DOCX, XLSX, PNG, JPG, JPEG, WEBP.',
	'chat.entry.upload.tooltip.maxFilesAndSize':
		'Up to 5 files at once, max 20 MB per file.',
	'chat.entry.webSearch': 'Web search',
	'chat.entry.send': 'Send',
	'chat.entry.sendDisabledHint':
		'Please enter a message first. On desktop, hover the send button to open the menu and choose voice input.',
	'chat.entry.sendDisabledHintWeb': 'Please enter a message first.',
	'chat.entry.inputMode.label': 'Input mode',
	'chat.entry.inputMode.text': 'Text input',
	'chat.entry.inputMode.voice': 'Voice input',
	'chat.entry.voice.noRecorder':
		'Recording is not supported here or the recorder could not be created.',
	'chat.entry.voice.micDenied': 'Microphone access was denied',
	'chat.entry.voice.liveListening':
		'Listening… transcribed text will appear here (about once per second).',
	'chat.entry.voice.stop': 'Stop recording and transcribe',
	'chat.entry.voice.transcribing': 'Transcribing…',
	'chat.entry.voice.start': 'Start recording',

	// 聊天机器人文案
	'chat.bot.toast.noContent.title': 'No content',
	'chat.bot.toast.noContent.desc':
		'This reply is empty and cannot be saved to the knowledge base.',

	// 聊天消息操作文案
	'chat.messageActions.saveToKnowledge': 'Save to knowledge',
	'chat.messageActions.shareAnswer': 'Share this answer',

	// 聊天助手文案
	'chat.assistant.thinking': 'Thinking…',
	'chat.assistant.readWebPages': 'Read {n} web pages',
	'chat.assistant.thinkProcess': 'Thought process',
	'chat.assistant.generating': 'Generating…',
	'chat.assistant.aiDisclaimer':
		'This answer is generated by AI and is for reference only. Please verify carefully.',
	'chat.assistant.webPagesCount': '{n} web pages',
	'chat.assistant.continueGenerate': 'Continue',
	'chat.assistant.maxTokensExceededPrefix': 'Maximum output length exceeded, ',
	'chat.assistant.clickContinueAnswer': 'click to continue',

	// 聊天控制器文案
	'chat.controls.backToStreamingBranch': 'Back to streaming branch',
	'chat.controls.backToLatestBranch': 'Back to latest branch',
	'chat.controls.scroll.toTop': 'Scroll to top',
	'chat.controls.scroll.toBottom': 'Scroll to bottom',

	// 聊天锚点导航文案
	'chat.anchorNav.prev': 'Previous',
	'chat.anchorNav.next': 'Next',
	'chat.anchorNav.item': 'Chat {index}: {content}',

	// 聊天代码工具栏文案
	'chat.codeToolbar.aria': 'Code block toolbar',
	'chat.codeToolbar.copy': 'Copy',
	'chat.codeToolbar.copied': 'Copied',
	'chat.codeToolbar.download': 'Download',

	// 聊天文本区域文案
	'chat.textArea.placeholder': 'Type your question',
	'chat.textArea.send': 'Send',

	// 聊天搜索有机文案
	'chat.searchOrganics.title': 'Web search results',

	// Mermaid 工具栏文案
	'mermaid.toolbar.code': 'Code',
	'mermaid.toolbar.diagram': 'Diagram',
	'mermaid.toolbar.copy': 'Copy',
	'mermaid.toolbar.copied': 'Copied',
	'mermaid.toolbar.preview': 'Preview',
	'mermaid.toolbar.download': 'Download',

	// 认证文案
	'auth.logout': 'Log out',
	'auth.loginRequired': 'Please sign in first.',
	'auth.login.tab.username': 'Password login',
	'auth.login.tab.email': 'Email login',
	'auth.login.go': 'Already have an account? Sign in',
	'auth.register.go': "Don't have an account? Sign up",
	'auth.register.title': 'Sign up',
	'auth.resetPassword.title': 'Reset password',
	'auth.forgotPassword': 'Forgot password',

	// 认证用户名文案
	'auth.username': 'Username',
	'auth.password': 'Password',
	'auth.captcha': 'Captcha',
	'auth.username.placeholder': 'Enter username',
	'auth.password.placeholder': 'Enter password',
	'auth.showPassword': 'Show password',
	'auth.hidePassword': 'Hide password',
	'auth.captcha.placeholder': 'Enter captcha',
	'auth.login.submit': 'Sign in',
	'auth.captcha.fetchFailed': 'Failed to fetch captcha.',

	// 认证用户名验证文案
	'auth.validation.usernameMin': 'Username must be at least 2 characters.',
	'auth.validation.passwordMin': 'Password must be at least 8 characters.',
	'auth.validation.passwordComplex':
		'Password must include letters, numbers, and special characters.',
	'auth.validation.captchaMin': 'Captcha must be at least 4 characters.',
	'auth.validation.emailInvalid': 'Please enter a valid email address.',
	'auth.validation.verifyCodeMin':
		'Verification code must be at least 6 digits.',
	'auth.validation.passwordMismatch': 'Passwords do not match.',

	// 认证邮箱文案
	'auth.email': 'Email',
	'auth.verifyCode': 'Verification code',
	'auth.confirmPassword': 'Confirm password',
	'auth.email.placeholder': 'Enter email',
	'auth.verifyCode.placeholder.email': 'Enter the code sent to your email',
	'auth.confirmPassword.placeholder': 'Enter password again',

	// 认证验证码文案
	'auth.verifyCode.send': 'Get code',
	'auth.verifyCode.sentSuccess': 'Code sent.',
	'auth.username.requiredFirst': 'Please enter username first.',

	// 认证注册文案
	'auth.register.submit': 'Sign up',
	'auth.resetPassword.success': 'Password reset successfully.',
	'auth.resetPassword.submit': 'Reset',
	'auth.login.back': 'Back to sign in',

	// 首页文案
	'home.hero.welcome': 'Welcome',
	'home.hero.product': 'Smart Workspace',
	'home.hero.subtitle':
		'One desktop app for AI chat, knowledge notes, bookshelf, English learning, and plugins. Stream answers into notes, read and practice side by side—ask, save, and learn in one place.',
	'home.hero.quickStart': 'Get started',
	'home.hero.learnMore': 'Learn more',
	'home.hero.downloadDesktop': 'Download desktop app',
	'home.hero.knowledge.title': 'Knowledge',
	'home.hero.knowledge.subtitle': 'Markdown Notes',
	'home.hero.knowledge.desc':
		'WYSIWYG Markdown with dual-pane preview, local import/export, auto-save drafts, and trash recovery. Organize by category and tags, search instantly, and turn ideas into reusable knowledge.',
	'home.hero.ebook.title': 'Bookshelf',
	'home.hero.ebook.subtitle': 'E-book Reader',
	'home.hero.ebook.desc':
		'Import EPUBs with TOC jump, full-text search, reading progress, and bookmarks. Adjust font and theme, resume anytime, and keep a searchable personal library on your digital shelf.',
	'home.hero.english.title': 'English Learning',
	'home.hero.english.subtitle': 'Vocabulary & Quotes',
	'home.hero.english.desc':
		'Daily words and classic sentences, plus a mistake book and favorites. Spaced-repetition reviews keep progress clear—from practice to mastery in one learning loop.',
	'home.hero.plugins.title': 'Plugins',
	'home.hero.plugins.subtitle': 'Extensible',
	'home.hero.plugins.desc':
		'Install community plugins or build your own with the developer guide. Toggle on demand with permission control, and wire chat, knowledge, and tools into your workflow.',
	'home.stage.users': 'Curated modules',
	'home.stage.services':
		'Chat, notes, reading, and learning—core features one screen away.',
	'home.stage.servicesLink': 'Highlights',
	'home.stage.headline': 'Ask · Note · Learn',
	'home.stage.status': 'Desktop AI workspace',
	'home.stage.stat.modules': 'Modules',
	'home.stage.stat.entries': 'Shortcuts',
	'home.stage.stat.local': 'On-device first',
	'home.stage.stat.localValue': '100%',
	'home.stage.metricLabel': 'Capability map',
	'home.stage.metricHint': 'Core workspace scenarios',
	'home.stage.statsLink': 'Learn more',
	'home.features.enter': 'Enter',
	'home.sections.showcase': 'Highlights',
	'home.sections.showcaseStatus': '4 core features',
	'home.sections.steps': 'Quick start',
	'home.sections.stepsStatus': '4 quick steps',
	'home.sections.quicklinks': 'Quick links',
	'home.sections.quicklinksStatus': 'Shortcut access',
	'home.features.chat.title': 'Chat',
	'home.features.chat.subtitle': 'Natural language',
	'home.features.chat.desc':
		'Chat naturally with AI for answers, ideas, and learning support.',
	'home.features.coding.title': 'Code assistant',
	'home.features.coding.subtitle': 'Developer support',
	'home.features.coding.desc':
		'Generate, debug, and optimize code—boost productivity across languages.',
	'home.features.document.title': 'Document tools',
	'home.features.document.subtitle': 'Smart analysis',
	'home.features.document.desc':
		'Parse, summarize, and extract from images, PDFs, Word, Excel, and more.',
	'home.showcase.plugin.title': 'Plugin System',
	'home.showcase.plugin.desc': 'Extensible architecture',
	'home.showcase.fast.title': 'Fast',
	'home.showcase.fast.desc': 'Millisecond-level response',
	'home.showcase.privacy.title': 'Privacy',
	'home.showcase.privacy.desc': 'Local-first processing',
	'home.showcase.i18n.title': 'Multilingual',
	'home.showcase.i18n.desc': 'Chinese and English support',
	'home.showcase.lightweight.title': 'Lightweight',
	'home.showcase.lightweight.desc': 'Low resource usage',
	'home.steps.install.title': 'Install',
	'home.steps.install.desc': 'Download and install the desktop app',
	'home.steps.register.title': 'Sign up',
	'home.steps.register.desc': 'Create your own personal account',
	'home.steps.start.title': 'Start',
	'home.steps.start.desc': 'Enjoy the smart assistant experience',
	'home.steps.pluginDev.title': 'Plugin development',
	'home.steps.pluginDev.guide': 'Development guide',
	'home.steps.pluginDev.desc': 'Build custom plugins for the platform',
	'home.quicklinks.dnhyxc-ai.title': 'dnhyxc-ai',
	'home.quicklinks.dnhyxc-ai.desc': 'dnhyxc-ai web',
	'home.quicklinks.dnhyxc-ai-admin.title': 'dnhyxc-ai-admin',
	'home.quicklinks.dnhyxc-ai-admin.desc': 'dnhyxc-ai Backend Management System',
	'home.quicklinks.blog.title': 'My blog',
	'home.quicklinks.blog.desc': 'My blog website',
	'home.quicklinks.github.title': 'GitHub',
	'home.quicklinks.github.desc': 'My GitHub repository',

	// 知识库文案
	'knowledge.common.untitled': 'Untitled',
	'knowledge.toolbar.save': 'Save',
	'knowledge.toolbar.import': 'Import',
	'knowledge.import.success': 'Imported into editor',
	'knowledge.import.empty': 'File is empty',
	'knowledge.import.failed': 'Import failed',
	'knowledge.import.tooLarge': 'File is too large (max 5MB)',
	'knowledge.import.notMd': 'Only .md files can be imported',
	'knowledge.toolbar.clear': 'Clear',
	'knowledge.toolbar.share': 'Share',
	'knowledge.toolbar.library': 'Library',
	'knowledge.toolbar.trash': 'Trash',
	'knowledge.shortcuts.save': 'Meta + S / Control + S',
	'knowledge.shortcuts.import': 'Meta + I',
	'knowledge.shortcuts.clear': 'Meta + Shift + D',
	'knowledge.shortcuts.share': 'Meta + Shift + O',
	'knowledge.shortcuts.openLibrary': 'Meta + Shift + L',
	'knowledge.shortcuts.openTrash': 'Meta + Shift + T',

	'knowledge.list.openInEditor': 'Open in Cursor or Trae',
	'knowledge.list.deleteLocalMdAria': 'Delete local Markdown file',
	'knowledge.list.deleteFromLibraryAria': 'Delete from knowledge library',
	'knowledge.list.publicConfirmTitle': 'Make this knowledge document public?',
	'knowledge.list.publicConfirmDesc':
		'Once public, all signed-in users can find and open it in the list',
	'knowledge.list.privateConfirmTitle': 'Make this document private?',
	'knowledge.list.privateConfirmDesc':
		'Only you will be able to view this document',
	'knowledge.list.madePublic': 'Document is now public',
	'knowledge.list.madePrivate': 'Document is now private',
	'knowledge.list.updatedAt': 'Updated {time}',
	'knowledge.list.localLoadFailed': 'Failed to load local list',
	'knowledge.list.readFailed': 'Read failed',
	'knowledge.list.cloudOpenLoginTip':
		'Sign in to open items from the cloud library',
	'knowledge.list.detailMissing': 'Unable to fetch item details',
	'knowledge.list.cloudDeleteLoginTip':
		'You must be signed in to delete cloud library records',
	'knowledge.list.fileDeleted': 'File deleted',
	'knowledge.list.localFileDeleted': 'Local file deleted',
	'knowledge.list.deletedBoth': 'Deleted both',
	'knowledge.list.localFileDeleteFailed': 'Failed to delete local file',
	'knowledge.list.dirNotSelected': 'No directory selected',
	'knowledge.list.openedInExternalEditor': 'Opened in external editor',
	'knowledge.list.openedWithEditor': 'Opened with {editor}',
	'knowledge.list.openFailed': 'Open failed',
	'knowledge.list.deleteRecordTitle': 'Delete knowledge record?',
	'knowledge.list.deleteRecordDesc.tauri':
		'No matching local file was found. Delete this item from the database only?',
	'knowledge.list.deleteRecordDesc.web': 'Delete this item from the database?',
	'knowledge.list.fileNameLabel': 'File name: “{name}”',
	'knowledge.list.deleteFileTitle': 'Delete file?',
	'knowledge.list.deleteFileDesc.localOnly':
		'This will delete the file from disk only and will not affect cloud data.',
	'knowledge.list.deleteFileDesc.linked':
		'This item is linked to a cloud record and a local Markdown file. You can delete local only, online only, or delete both.',
	'knowledge.list.deleteBoth': 'Delete both',
	'knowledge.list.deleteLocal': 'Delete local',
	'knowledge.list.deleteOnline': 'Delete online',
	'knowledge.list.dataSource': 'Data source',
	'knowledge.list.source.db': 'Database',
	'knowledge.list.source.local': 'Local folder',
	'knowledge.list.pickFolder': 'Choose folder',
	'knowledge.list.localOnlyInDesktop':
		'Local folder listing is available on desktop (Tauri) only.',
	'knowledge.list.cloudDisabledWhenLoggedOut':
		'Signed out: local folder only (no cloud requests).',
	'knowledge.list.localOpsOnly':
		'Operations in this mode are local-folder only.',
	'knowledge.list.localAndDbSync':
		'Operations can sync between local and database.',
	'knowledge.list.empty.local': 'No .md files in this folder',
	'knowledge.list.empty.cloud': 'No knowledge items yet',
	'knowledge.list.searchPlaceholder': 'Search by document title',
	'knowledge.list.empty.search': 'No matching documents',
	'knowledge.list.category.manage': 'Manage categories',
	'knowledge.list.category.add': 'Add category',
	'knowledge.list.category.rename': 'Rename',
	'knowledge.list.category.delete': 'Delete category',
	'knowledge.list.category.deleteConfirm':
		'Documents in this category will move to Uncategorized.',
	'knowledge.list.category.move': 'Move to category',
	'knowledge.list.category.all': 'All',
	'knowledge.list.category.uncategorized': 'Uncategorized',
	'knowledge.list.category.empty': 'No documents in this category.',
	'knowledge.list.category.duplicateName': 'Category name already exists',

	'knowledge.assistant.prompts.polish.title': 'Polish document',
	'knowledge.assistant.prompts.polish.desc': 'Refine wording and improve tone',
	'knowledge.assistant.prompts.summarize.title': 'Summarize document',
	'knowledge.assistant.prompts.summarize.desc': 'Extract key points quickly',
	'knowledge.assistant.prompts.outline.title': 'Generate table of contents',
	'knowledge.assistant.prompts.outline.desc':
		'Build a navigable TOC from headings',
	'knowledge.assistant.prompts.expand.title': 'Expand document',
	'knowledge.assistant.prompts.expand.desc': 'Add detail and depth',
	'knowledge.assistant.modes.ai': 'AI Chat',
	'knowledge.assistant.modes.rag': 'RAG Chat',
	'knowledge.assistant.loadingConversation': 'Loading conversation…',
	'knowledge.assistant.ragIntro':
		'Ask questions based on the knowledge you have saved. The system will strictly search and reason only within your private data—no public internet content.',
	'knowledge.assistant.aiIntro':
		"Hi, I'm your knowledge assistant. From daily lookup and process guidance to tricky problem-solving, I'll provide fast and accurate support—saving you time and boosting productivity.",
	'knowledge.assistant.newConversation': 'New chat',
	'knowledge.assistant.scrollToBottom': 'Scroll to bottom',
	'knowledge.assistant.scrollToTop': 'Scroll to top',
	'knowledge.assistant.sessionSaving':
		'Saving conversation. Please create a new one later.',
	'knowledge.assistant.sessionSavingViewHistory':
		'Saving conversation. Please view history later.',
	'knowledge.assistant.deleteConversationTitle': 'Delete conversation?',
	'knowledge.assistant.deleteConversationDesc':
		'Are you sure you want to delete this conversation? This action cannot be undone.',
	'knowledge.assistant.conversationNameLabel': 'Conversation: “{name}”',
	'knowledge.assistant.conversationFallback': 'Chat {id}',
	'knowledge.assistant.history': 'History',
	'knowledge.assistant.historyEmpty': 'No conversations yet',
	'knowledge.assistant.noBodyToWrite': 'No body content to write.',
	'knowledge.assistant.appendedToCurrentDoc': 'Appended to current document.',
	'knowledge.assistant.tocAlreadyAtTop':
		'A table of contents is already at the top; nothing was inserted.',
	'knowledge.assistant.tocPrependedToDoc':
		'Generated table of contents inserted at the top of the document.',
	'knowledge.assistant.loginToUse': 'Please sign in to use the assistant.',
	'knowledge.assistant.enterBodyFirst':
		'Please enter document content in the editor first.',
	'knowledge.assistant.waitForCurrentReply':
		'Please wait for the current reply to finish.',
	'knowledge.assistant.placeholder.rag': 'Ask your knowledge base',
	'knowledge.assistant.placeholder.ai': 'Type your question',
	'knowledge.assistant.placeholder.aiNeedsBody':
		'Please enter document content in the editor before asking.',

	'knowledge.assistant.share.selectAll': 'Select all',
	'knowledge.assistant.share.createLink': 'Create share link',

	'knowledge.trash.title': 'Trash',
	'knowledge.trash.checkbox.select': 'Select',
	'knowledge.trash.checkbox.unselect': 'Unselect',
	'knowledge.trash.deleteForever': 'Delete permanently from trash',
	'knowledge.trash.deletedAt': 'Deleted {time}',
	'knowledge.trash.deleted': 'Deleted from trash',
	'knowledge.trash.detailMissing': 'Unable to fetch trash item details',
	'knowledge.trash.selectedCount': 'Selected {count}',
	'knowledge.trash.batchDeleteFailed': 'Batch delete failed',
	'knowledge.trash.batchDeleteDone': 'Batch delete completed',
	'knowledge.trash.batchDeleteDoneMessage': 'Deleted {count}',
	'knowledge.trash.confirm.batchTitle': 'Delete trash items?',
	'knowledge.trash.confirm.singleTitle': 'Delete trash item?',
	'knowledge.trash.confirm.desc':
		'This will permanently delete the item from trash and cannot be undone.',
	'knowledge.trash.confirm.count': 'Count: {count}',
	'knowledge.trash.confirm.fileName': 'File name: “{name}”',
	'knowledge.trash.selectAll': 'Select all',
	'knowledge.trash.selectedRatio': 'Selected {selected} / {total}',
	'knowledge.trash.batchDelete': 'Batch delete',
	'knowledge.trash.loadingDetail': 'Loading…',
	'knowledge.trash.empty': 'Trash is empty',
	'knowledge.trash.searchPlaceholder': 'Search by document name',
	'knowledge.trash.empty.search': 'No matching documents',

	// 分享文案
	'share.header.chatTitle': 'Shared conversation',
	'share.header.knowledgeTitle': 'Shared article',
	'share.header.chatDisclaimer':
		'This shared content is generated by AI. Please verify carefully.',
	'share.header.knowledgeDisclaimer':
		'This article is shared content. Please verify carefully.',
	'share.knowledge.updatedAt': 'Updated {time}',
	'share.scroll.toTop': 'Back to top',
	'share.scroll.toBottom': 'Scroll to bottom',
	'share.scroll.ariaToTop': 'Scroll to top',
	'share.scroll.ariaToBottom': 'Scroll to bottom',

	'share.modal.title.session': 'Create share link',
	'share.modal.title.knowledge': 'Create article share link',
	'share.modal.disclaimer':
		'Share links are public. Anyone who gets the link can view it. Please review the content carefully before sharing and make sure it contains no sensitive or private data.',
	'share.modal.copied': 'Copied',
	'share.modal.copy': 'Copy',
	'share.modal.createAndCopy': 'Create & copy link',

	// 知识库保存文案
	'knowledge.save.fileSaved': 'File saved',
	'knowledge.save.savedToPath': 'Saved to: {path}',
	'knowledge.save.savedToDefaultDir': 'Saved to default directory',
	'knowledge.save.failed': 'Save failed',
	'knowledge.save.updateFailedTryLater':
		'Failed to update knowledge. Please try again later.',
	'knowledge.save.createFailedTryLater':
		'Failed to create knowledge. Please try again later.',
	'knowledge.save.loginTip':
		'Sign in to save to the cloud knowledge base, or use the desktop app to save to a local folder.',
	'knowledge.save.noChangesTitle': 'No changes',
	'knowledge.save.noChangesMessage':
		'Title and content are unchanged. Save was skipped.',

	// 知识库验证文案
	'knowledge.validation.titleRequired':
		'Please enter a file name (title) first.',
	'knowledge.validation.contentRequired': 'Please enter content first.',

	// 知识库分享文案
	'knowledge.share.saveBeforeShare':
		'Please save to knowledge base before sharing.',

	// 知识库覆盖文案
	'knowledge.overwrite.title': 'Overwrite existing file?',
	'knowledge.overwrite.desc':
		'A file with the same name “{name}” already exists in the current directory. Overwrite it? This action cannot be undone.',
	'knowledge.overwrite.saveAsTip':
		'You can also choose “Save as” to create a new file.',
	'knowledge.overwrite.confirm': 'Overwrite & save',
	'knowledge.overwrite.cancel': 'Cancel save',
	'knowledge.overwrite.saveAs': 'Save as',

	'knowledge.title.unsavedChanges': 'Unsaved changes',
	'knowledge.title.document': 'Knowledge document',
	'knowledge.title.placeholder': 'Enter file name (title)…',
	'knowledge.title.aria': 'Knowledge title',

	// 路由文案
	'route.chat.title': 'Smart Chat',
	'route.englishLearning.title': 'English learning',
	'route.englishLearning.import.title': 'Import study data',
	'route.englishLearning.library.title': 'Library',
	'route.englishLearning.toLibrary': 'Go to library',
	'route.englishLearning.favorites.title': 'My favorites',
	'route.englishLearning.notes.title': 'Study notes',
	'route.englishLearning.mistakes.title': 'Mistake book',
	'route.englishLearning.daily.title': 'Daily words',
	'route.englishLearning.review.title': "Today's review",
	'route.englishLearning.stream.title': 'Fetch results',
	'route.englishLearning.morphology.title': 'Roots & affixes',
	'route.englishLearning.grammar.title': 'English grammar',
	'route.englishLearning.practice.title': 'Practice dictation & spelling',
	'route.englishLearning.practice.classicTitle':
		'Sentence dictation & spelling',

	'englishLearning.practice.entry': 'Practice',
	'englishLearning.practice.setupTitle': 'Word practice',
	'englishLearning.practice.classicSetupTitle': 'Sentence practice',
	'englishLearning.practice.classicDictationHint':
		'Listen and type the full sentence below',
	'englishLearning.practice.classicSpellingPrompt':
		'Read the Chinese meaning and type the full English sentence',
	'englishLearning.practice.classicInputPlaceholder':
		'Type the English sentence',
	'englishLearning.practice.sourceClassicFavorites': 'Classic quote favorites',
	'englishLearning.practice.sourceClassicMistakes': 'Sentence mistake book',
	'englishLearning.practice.sourceClassicLibrary': 'Current quote library',
	'englishLearning.practice.sourceClassicPack': 'This quote pack',
	'englishLearning.practice.sourceClassicLive': 'Current quote pack (live)',
	'englishLearning.practice.modeLabel': 'Mode',
	'englishLearning.practice.modeDictation': 'Dictation',
	'englishLearning.practice.modeDictationVocab': 'Word dictation',
	'englishLearning.practice.modeDictationClassic': 'Sentence dictation',
	'englishLearning.practice.modeSpelling': 'Spelling',
	'englishLearning.practice.modeSpellingVocab': 'Word spelling',
	'englishLearning.practice.modeSpellingClassic': 'Sentence spelling',
	'englishLearning.practice.shortcuts.triggerAria':
		'View practice keyboard shortcuts',
	'englishLearning.practice.shortcuts.title': 'Keyboard shortcuts',
	'englishLearning.practice.shortcuts.sectionPrompt': 'While answering',
	'englishLearning.practice.shortcuts.sectionSoftWrong': 'First mistake',
	'englishLearning.practice.shortcuts.sectionRevealed': 'After reveal',
	'englishLearning.practice.shortcuts.check': 'Check answer',
	'englishLearning.practice.shortcuts.play': 'Play / stop',
	'englishLearning.practice.shortcuts.showAnswer': 'Show answer',
	'englishLearning.practice.shortcuts.previous': 'Previous question',
	'englishLearning.practice.shortcuts.retry': 'Try again',
	'englishLearning.practice.shortcuts.next': 'Next question',
	'englishLearning.practice.shortcuts.footnote':
		'After first mistake or reveal: arrow keys are ignored while focus is in the input; ↑ previous only when not on the first question. Shift + Space plays or stops anytime while answering.',
	'englishLearning.practice.shortcuts.keyEnter': 'Enter key',
	'englishLearning.practice.shortcuts.keyShiftSpace': 'Shift + Space',
	'englishLearning.practice.shortcuts.keySpace': 'Space',
	'englishLearning.practice.shortcuts.keyLeft': 'Left arrow key',
	'englishLearning.practice.shortcuts.keyRight': 'Right arrow key',
	'englishLearning.practice.shortcuts.keyUp': 'Up arrow key',
	'englishLearning.practice.shortcuts.keyDown': 'Down arrow key',
	'englishLearning.practice.sourceLabel': 'Word list',
	'englishLearning.practice.sourceResolving': 'Loading…',
	'englishLearning.practice.sourceFavorites': 'Favorites',
	'englishLearning.practice.sourceLibrary': 'This library',
	'englishLearning.practice.sourcePack': 'This pack',
	'englishLearning.practice.sourceLive': 'Current pack (live)',
	'englishLearning.practice.sourceFixed': 'List: {label}',
	'englishLearning.practice.countLabel': 'Number of words',
	'englishLearning.practice.orderLabel': 'Order',
	'englishLearning.practice.orderRandom': 'Random',
	'englishLearning.practice.orderSequential': 'In order',
	'englishLearning.practice.start': 'Start',
	'englishLearning.practice.loadingWords': 'Loading words…',
	'englishLearning.practice.emptyPool':
		'Select a library/favorites/history record first.',
	'englishLearning.practice.emptyTitle': 'No words available',
	'englishLearning.practice.loadFailed': 'Failed to load words',
	'englishLearning.practice.progress': '{current} / {total}',
	'englishLearning.practice.exit': 'Exit practice',
	'englishLearning.practice.dictationHint':
		'Listen and type the word in English',
	'englishLearning.practice.dictationStepListen': 'Listen',
	'englishLearning.practice.dictationStepSpell': 'Type',
	'englishLearning.practice.playAgain': 'Play again',
	'englishLearning.practice.spellingPrompt':
		'Read the Chinese meaning, then type the English spelling below',
	'englishLearning.practice.inputLabel': 'Your spelling',
	'englishLearning.practice.inputPlaceholder': 'Type the English word',
	'englishLearning.practice.check': 'Check',
	'englishLearning.practice.tryAgain': 'Try again',
	'englishLearning.practice.showAnswer': 'Show answer',
	'englishLearning.practice.softWrongHint':
		'You can try again or view the correct answer before continuing.',
	'englishLearning.practice.previous': 'Previous',
	'englishLearning.practice.next': 'Next',
	'englishLearning.practice.viewResults': 'View practice results',
	'englishLearning.practice.incorrect': 'Spelling error',
	'englishLearning.practice.hintShow': 'Expand hint',
	'englishLearning.practice.hintHide': 'Hide hint',
	'englishLearning.practice.hintUnavailable': 'No extra hints for this word',
	'englishLearning.practice.hintLabelIpa': 'IPA',
	'englishLearning.practice.hintLabelSegmentation': 'Syllables',
	'englishLearning.practice.hintLabelTranslation': 'Meaning (ZH)',
	'englishLearning.practice.hintLabelSource': 'Source',
	'englishLearning.practice.hintLabelNote': 'Note',
	'englishLearning.practice.hintLabelExample': 'Example',
	'englishLearning.practice.yourAnswer': 'Your answer: {answer}',
	'englishLearning.practice.yourAnswerLabel': 'Your answer',
	'englishLearning.practice.correctAnswer': 'Correct answer',
	'englishLearning.practice.summaryTitle': 'Practice report',
	'englishLearning.practice.summaryScore': '{correct} / {total} correct',
	'englishLearning.practice.summaryAccuracy': 'Accuracy',
	'englishLearning.practice.summaryStatCorrect': 'Correct',
	'englishLearning.practice.summaryStatWrong': 'Wrong',
	'englishLearning.practice.summaryStatTotal': 'This round',
	'englishLearning.practice.summaryStatPracticed': 'Practiced',
	'englishLearning.practice.wrongListTitle': 'Mistakes',
	'englishLearning.practice.roundWordListTitle': 'Answer breakdown',
	'englishLearning.practice.roundWordListWrongCount': 'Wrong {count}',
	'englishLearning.practice.roundWordListCorrectCount': 'Correct {count}',
	'englishLearning.practice.retryWrong': 'Retry mistakes',
	'englishLearning.practice.practiceAgain': 'New session',
	'englishLearning.practice.continuePractice': 'Continue practice',
	'englishLearning.practice.continueEmpty': 'No more new words to practice',
	'englishLearning.practice.back': 'Back',
	'englishLearning.practice.saveMistakes': 'Save to mistake book',
	'englishLearning.practice.saveMistakesSuccessTitle':
		'Save mistake book successfully',
	'englishLearning.practice.saveMistakesSuccess':
		'Added {added}, updated spelling {updated}, unchanged {skipped}',
	'englishLearning.practice.saveMistakesAllSkipped':
		'All wrong items are already in the mistake book with the same spelling',
	'englishLearning.practice.saveMistakesFailed': 'Failed to save mistake book',
	'englishLearning.practice.sourceMistakes': 'Mistake book',
	'englishLearning.practice.sourceDailyMemorize': 'Word log',
	'englishLearning.practice.sourceReview': "Today's review (vocabulary)",
	'englishLearning.practice.sourceClassicReview': "Today's review (sentences)",
	'englishLearning.practice.continueReview': 'Continue review',
	'englishLearning.practice.continueReviewEmpty':
		'No more items due for review today',
	'englishLearning.practice.reviewRecordFailed':
		'Failed to save review progress. Try again later.',

	'englishLearning.daily.loading': 'Preparing today’s cards…',
	'englishLearning.daily.sidebarDesc': 'Listen & pick — about {count} words',
	'englishLearning.daily.sidebarDescSplit':
		'Review {dueCount} · Library {libraryCount}',
	'englishLearning.daily.sidebarDescLibrary':
		'{poolCount} unlearned in library · {sessionCount} per round',
	'englishLearning.daily.sidebarDescLibraryEmpty':
		'No new words in your libraries',
	'englishLearning.daily.wordsPerRoundTrigger': 'Words per round',
	'englishLearning.daily.wordsPerRoundTitle': 'Words per round',
	'englishLearning.daily.wordsPerRoundDesc':
		'Same options as word practice. Applies on your next session.',
	'englishLearning.daily.resetLibrary': 'Reset',
	'englishLearning.daily.resetting': 'Resetting…',
	'englishLearning.daily.resetConfirmTitle': 'Reset library memorization?',
	'englishLearning.daily.resetConfirmDesc':
		'This clears {count} word log entries and removes those words from your mistake book and review schedule, so they can be picked from the library again.',
	'englishLearning.daily.resetConfirmAction': 'Reset',
	'englishLearning.daily.resetSuccess': 'Reset {count} word log entries',
	'englishLearning.daily.resetSuccessGuest':
		'Local memorization progress reset',
	'englishLearning.daily.resetFailed': 'Reset failed. Try again later.',
	'englishLearning.daily.memorizedLink': 'Word log',
	'englishLearning.daily.recordsTitle': 'Word log',
	'englishLearning.daily.recordsLoading': 'Loading word log…',
	'englishLearning.daily.recordsEmpty':
		'No words from library random practice yet',
	'englishLearning.daily.recordsLoadFailed': 'Failed to load word log',
	'englishLearning.daily.sectionLabel': "Today's cards",
	'englishLearning.daily.startShort': 'Start {count} words',
	'englishLearning.daily.introTitle': 'A few minutes a day, words stick',
	'englishLearning.daily.introDesc':
		'About {count} words today — listen, read the meaning, pick one answer.',
	'englishLearning.daily.introDescSplit':
		'Review {dueCount} due · Library random {libraryCount}',
	'englishLearning.daily.introHint':
		'Recognition only — no spelling. Use Today’s review for dictation later.',
	'englishLearning.daily.sessionTitle': 'Daily words',
	'englishLearning.daily.sessionTitleReview': 'Due review',
	'englishLearning.daily.sessionTitleLibrary': 'Read & memorize',
	'englishLearning.daily.studyLabel': 'Listen & read',
	'englishLearning.daily.quizLabel': 'Pick the meaning',
	'englishLearning.daily.quizHint': 'Which is the correct meaning in Chinese?',
	'englishLearning.daily.hintLabelWord': 'Word',
	'englishLearning.daily.start': 'Start {count} words',
	'englishLearning.daily.startReview': 'Review due ({count})',
	'englishLearning.daily.startLibrary': 'Start memorizing',
	'englishLearning.daily.guestHint':
		'Built-in high-frequency words when signed out; sign in to sync favorites and review.',
	'englishLearning.daily.startQuiz': 'Quiz me',
	'englishLearning.daily.quizPrompt': 'What does “{word}” mean?',
	'englishLearning.daily.feedbackCorrect': 'Nice — got it!',
	'englishLearning.daily.feedbackWrong': 'No worries — you’ll see it again',
	'englishLearning.daily.nextWord': 'Next word',
	'englishLearning.daily.finish': 'Done for today',
	'englishLearning.daily.doneTitle': 'That’s enough for today',
	'englishLearning.daily.doneDesc':
		'When due, practice dictation under Today’s review — we handle the schedule.',
	'englishLearning.daily.backHome': 'Back to English',

	'englishLearning.review.homeDesc': '{count} due for review today',
	'englishLearning.review.loadingDue': 'Loading due count…',
	'englishLearning.review.vocabNav': 'Vocabulary ({count})',
	'englishLearning.review.classicNav': 'Sentences ({count})',

	'englishLearning.mistakes.desc':
		'Words you misspelled in practice — review with dictation or spelling',
	'englishLearning.mistakes.homeDesc':
		'View vocabulary and sentence mistake book',
	'englishLearning.mistakes.vocabNav': 'Vocabulary mistakes',
	'englishLearning.mistakes.classicNav': 'Sentence mistakes',
	'englishLearning.mistakes.classicEmpty':
		'No sentence mistakes yet. Add them from the practice summary after a session.',
	'englishLearning.mistakes.classicListLoadFailed':
		'Failed to load sentence mistakes',
	'englishLearning.mistakes.classicRemoveConfirmDesc':
		'Remove "{english}" from the mistake book?',
	'englishLearning.mistakes.empty':
		'No mistakes yet. Add wrong words from the practice summary.',
	'englishLearning.mistakes.listLoadFailed': 'Failed to load mistake book',
	'englishLearning.mistakes.lastInput': 'Your spelling: {answer}',
	'englishLearning.mistakes.removeAction': 'Remove from mistake book',
	'englishLearning.mistakes.removeConfirmTitle': 'Remove from mistake book',
	'englishLearning.mistakes.removeConfirmDesc':
		'Remove “{word}” from your mistake book?',
	'englishLearning.mistakes.removeSuccess': 'Removed from mistake book',
	'englishLearning.mistakes.selectAllLoaded': 'Select all',
	'englishLearning.mistakes.selectedCount': '{count} selected',
	'englishLearning.mistakes.removeSelected': 'Remove selected',
	'englishLearning.mistakes.removing': 'Removing...',
	'englishLearning.mistakes.removeBatchSuccess': 'Removed selected mistakes',
	'englishLearning.mistakes.removeFail': 'Remove failed. Please try again.',
	'englishLearning.mistakes.removeBatchConfirmTitle':
		'Remove selected mistakes?',
	'englishLearning.mistakes.removeBatchConfirmDesc':
		'This will remove {count} selected mistake(s). This cannot be undone.',
	'englishLearning.mistakes.removeConfirmAction': 'Remove',
	'englishLearning.mistakes.removeNoneHint': 'Select items to remove first',
	'englishLearning.mistakes.toggleRow': 'Select row',

	'englishLearning.source.morphologyLink': 'Roots & affixes',
	'englishLearning.source.grammarLink': 'Grammar guide',
	'englishLearning.reference.morphology.pageTitle': 'Roots & affixes reference',
	'englishLearning.reference.morphology.tabPrefixes': 'Prefixes',
	'englishLearning.reference.morphology.tabSuffixes': 'Suffixes',
	'englishLearning.reference.morphology.tabRoots': 'Roots',
	'englishLearning.reference.grammar.empty': 'No grammar section selected',

	'englishLearning.stream.back': 'Back to English learning',
	'englishLearning.stream.kindTabsAria': 'Fetch result type',
	'englishLearning.stream.vocab.nav': 'Words',
	'englishLearning.stream.classic.nav': 'Quotes',
	'englishLearning.stream.vocab.pageTitle': 'Word fetch results',
	'englishLearning.stream.classic.pageTitle': 'Quote fetch results',
	'englishLearning.stream.topicLabel': 'Topic',
	'englishLearning.stream.openLivePage': 'Open live list',
	'englishLearning.stream.liveSummaryCount':
		'{count} item(s) fetched—view live on the results page',
	'englishLearning.stream.liveSummaryProgress':
		'Fetching {collected} / {target}—view live on the results page',
	'englishLearning.stream.vocab.empty':
		'No words yet. Start a fetch on the English learning page, or load from history.',
	'englishLearning.stream.classic.empty':
		'No quotes yet. Start a fetch on the English learning page, or load from history.',

	'englishLearning.intentSection': 'Select intent',
	'englishLearning.import.titleVocab': 'Import vocabulary (JSON)',
	'englishLearning.import.titleClassic': 'Import classic quotes (JSON)',
	'englishLearning.import.back': 'Back to English learning',
	'englishLearning.import.selectFile': 'Choose JSON file',
	'englishLearning.import.hintVocab':
		'Supports a top-level array, or an object containing an items array. Each entry must have word and ipa; pos, segmentation (syllables), translationZh, and example are optional. Example data:',
	'englishLearning.import.hintClassic':
		'Supports a top-level array, or an object containing an items array. Each entry must include english and translationZh; source and noteZh are optional. Example data:',
	'englishLearning.import.preview': 'JSON preview',
	'englishLearning.import.parseError': 'Invalid JSON',
	'englishLearning.import.readError': 'Failed to read file',
	'englishLearning.import.validateError': 'Validation failed:',
	'englishLearning.import.err.expect-array':
		'Expected an array or { "items": [...] }',
	'englishLearning.import.err.no-vocab':
		'No valid words (each item needs non-empty word and ipa)',
	'englishLearning.import.err.no-classic':
		'No valid quotes (each item needs non-empty english and translationZh)',
	'englishLearning.import.parsedCount': '{count} item(s) parsed',
	'englishLearning.import.apply': 'Import into left list',
	'englishLearning.import.applySuccess': 'Loaded into the left list',
	'englishLearning.import.dropReject': 'Please drop or pick a .json file',
	'englishLearning.import.titlePlaceholder': 'Enter title',
	'englishLearning.import.saveToVocab': 'Save to vocabulary',
	'englishLearning.import.saveToClassic': 'Save to classic quotes',
	'englishLearning.import.titleRequired': 'Please enter a title',
	'englishLearning.import.needParsed':
		'Upload and parse a valid JSON file before saving',
	'englishLearning.import.reupload': 'Re-upload',
	'englishLearning.import.saveVocabSuccess':
		'Saved {count} word(s) to your vocabulary library',
	'englishLearning.import.saveVocabLoading': 'Saving...',
	'englishLearning.import.saveClassicSuccess':
		'Saved {count} quote(s) to your quotes library',
	'englishLearning.import.saveClassicLoading': 'Saving...',
	'englishLearning.import.dataExample': 'Expand import word json example',
	'englishLearning.import.dataExampleClassic':
		'Expand import classic quotes json example',
	'englishLearning.import.dataExampleCollapse':
		'Collapse import word json example',
	'englishLearning.import.dataExampleClassicCollapse':
		'Collapse import classic quotes json example',
	'englishLearning.import.formatGuide': 'Format example',
	'englishLearning.import.topHintVocab':
		'Drag or click to upload .json vocabulary file',
	'englishLearning.import.topHintClassic':
		'Drag or click to upload .json classic quotes file',

	'englishLearning.library.favorites': 'Favorites',
	'englishLearning.library.vocab.title': 'Vocabulary library',
	'englishLearning.library.vocab.descShort': 'Import words, view word library',
	'englishLearning.library.vocab.bank': 'Vocabulary library',
	'englishLearning.library.classic.title': 'Quotes library',
	'englishLearning.library.classic.descShort': 'Import quotes, view corpus',
	'englishLearning.library.classic.bank': 'Corpus',
	'englishLearning.library.listHint': 'Select a pack on the left to view words',
	'englishLearning.library.listLoading': 'Loading libraries…',
	'englishLearning.library.listEmpty': 'No vocabulary libraries yet',
	'englishLearning.library.listEmptyClassic': 'No quotes libraries yet',
	'englishLearning.library.deleteAction': 'Delete library',
	'englishLearning.library.deleteActionClassic': 'Delete quotes library',
	'englishLearning.library.deleteConfirmTitle': 'Delete this library?',
	'englishLearning.library.deleteConfirmTitleClassic':
		'Delete this quotes library?',
	'englishLearning.library.deleteConfirmDesc':
		'This will permanently delete "{title}" and all {count} word(s) in it.',
	'englishLearning.library.deleteConfirmDescClassic':
		'This will permanently delete "{title}" and all {count} quote(s) in it.',
	'englishLearning.library.deleteConfirmAction': 'Delete',
	'englishLearning.library.deleting': 'Deleting…',
	'englishLearning.library.deleteSuccess': 'Library deleted',
	'englishLearning.library.deleteSuccessClassic': 'Quotes library deleted',
	'englishLearning.library.editAction': 'Edit library',
	'englishLearning.library.editActionClassic': 'Edit quotes library',
	'englishLearning.library.publicBadge': 'Public',
	'englishLearning.library.visibilityDialogTitle': 'Edit vocabulary library',
	'englishLearning.library.visibilityDialogTitleClassic': 'Edit quotes library',
	'englishLearning.library.visibilityLibrarySummary':
		'"{title}" — {count} words. ',
	'englishLearning.library.visibilityLibrarySummaryClassic':
		'"{title}" — {count} quotes. ',
	'englishLearning.library.editTitleLabel': 'Library name',
	'englishLearning.library.editTitlePlaceholder': 'Enter library name',
	'englishLearning.library.editTitleRequired': 'Name is required',
	'englishLearning.library.editTitleReadonlyHint':
		'Only the owner can rename this library',
	'englishLearning.library.editSaveSuccess': 'Library title updated',
	'englishLearning.library.visibilityPublicLabel': 'Make public library',
	'englishLearning.library.visibilityPublicHelp':
		'When on, every signed-in user can see and use it in Library. When off, only the owner can access it.',
	'englishLearning.library.visibilitySaveAction': 'Save',
	'englishLearning.library.visibilitySaving': 'Saving…',
	'englishLearning.library.visibilitySaveSuccess': 'Library visibility updated',
	'englishLearning.library.goImport': 'Go to import',
	'englishLearning.library.selectLibrary':
		'Select a vocabulary library on the left',
	'englishLearning.library.selectLibraryClassic':
		'Select a quotes library on the left',
	'englishLearning.library.wordsHeading': '{count} words',
	'englishLearning.library.quotesHeading': '{count} quotes',
	'englishLearning.library.listCount': '{count} {type}',
	'englishLearning.library.wordsLoading': 'Loading words…',
	'englishLearning.library.wordsLoadFailed':
		'Failed to load items. Please try again later.',
	'englishLearning.library.wordsLoadMoreFailed':
		'Failed to load more. Scroll again or try later.',
	'englishLearning.resume.settingsAria': 'Reading progress settings',
	'englishLearning.resume.settingsLabel': 'Settings',
	'englishLearning.resume.clearAction': 'Clear reading progress',
	'englishLearning.resume.disableAction': 'Disable reading progress',
	'englishLearning.resume.enableAction': 'Enable reading progress',
	'englishLearning.resume.clearConfirmTitle': 'Clear reading progress?',
	'englishLearning.resume.clearConfirmDesc':
		'Saved reading positions will be removed and lists will reload from the start.',
	'englishLearning.resume.clearConfirmAction': 'Clear',
	'englishLearning.resume.clearSuccess': 'Reading progress cleared',
	'englishLearning.resume.clearFailed': 'Failed to clear reading progress',
	'englishLearning.resume.disabledToast': 'Reading progress tracking disabled',
	'englishLearning.resume.enabledToast': 'Reading progress tracking enabled',
	'englishLearning.resume.loginRequired':
		'Please sign in to change reading progress settings',
	'englishLearning.resume.toggleFailed':
		'Failed to update reading progress settings',
	'englishLearning.library.quotesLoading': 'Loading quotes…',
	'englishLearning.favorites.bank': 'Favorites',
	'englishLearning.favorites.sidebarTitle': 'Categories',
	'englishLearning.favorites.listHint': 'Pick a category to view saved items',
	'englishLearning.favorites.vocab.nav': 'Vocabulary',
	'englishLearning.favorites.classic.nav': 'Quotes',
	'englishLearning.favorites.desc': 'View your saved word and quote packs',
	'englishLearning.notes.desc': 'Capture learning notes via MF plugin demo',
	'englishLearning.notes.nav': 'Open study notes',
	'englishLearning.favorites.toFavorites': 'Go to my favorites',
	'englishLearning.favorites.listLoadFailed':
		'Failed to load favorites. Please try again.',
	'englishLearning.favorites.listLoadMoreFailed':
		'Failed to load more. Scroll down to retry.',

	'englishLearning.toolbarSubtitle':
		'Tools & vocabulary on the left, chat on the right',
	'englishLearning.toolbarSubtitleShort':
		'Use quick intents or chat on the right',
	'englishLearning.quickIntents': 'Quick intents',
	'englishLearning.quickIntentsCollapse': 'Collapse quick intents',
	'englishLearning.quickIntentsExpand': 'Expand quick intents',
	'englishLearning.intro':
		'On the left, pick a quick intent to steer each turn—vocabulary, morphology, collocations, confusable words, pronunciation, speaking, translation, close reading, literature guidance, or grammar. Click the same chip again to clear; your choice is attached to the next message.',
	'englishLearning.disclaimer':
		'Translations and explanations are for learning only—please proofread important texts. Literature guidance respects copyright; prefer summaries and discussion prompts.',
	'englishLearning.newChat': 'New chat',
	'englishLearning.loading': 'Loading…',
	'englishLearning.assistant.scrollToBottom': 'Scroll to bottom',
	'englishLearning.assistant.scrollToTop': 'Scroll to top',
	'englishLearning.list.scrollToBottom': 'Scroll to bottom',
	'englishLearning.list.scrollToTop': 'Scroll to top',
	'englishLearning.placeholder':
		'Type English or Chinese: a word, a paragraph to translate, or a topic to read…',
	'englishLearning.chip.vocabulary': 'Vocabulary',
	'englishLearning.chip.morphology': 'Roots & affixes',
	'englishLearning.chip.collocations': 'Collocations',
	'englishLearning.chip.confusables': 'Near-synonyms',
	'englishLearning.chip.pronunciation': 'Pronunciation',
	'englishLearning.chip.speaking': 'Spoken practice',
	'englishLearning.chip.translate': 'Translation',
	'englishLearning.chip.reading': 'Reading',
	'englishLearning.chip.literature': 'Literature',
	'englishLearning.chip.grammar': 'Grammar',
	'englishLearning.intent.vocabulary':
		'### Intent: Focus on vocabulary: meaning, collocations, and example sentences; confirm my level if needed.',
	'englishLearning.intent.morphology':
		'### Intent: Starting from roots, prefixes, suffixes, and word-formation rules, explain the common morphological patterns and provide representative words for each.',
	'englishLearning.intent.collocations':
		'### Intent: Focus on idiomatic collocations/chunks: list common pairs, briefly contrast near equivalents, and add short examples.',
	'englishLearning.intent.confusables':
		'### Intent: Contrast easily confused words or near-synonyms: differences, typical misuse, and correct examples (table or bullets).',
	'englishLearning.intent.pronunciation':
		'### Intent: Focus on pronunciation and rhythm: stress, weak forms, linking or assimilation; include IPA and short practice tips.',
	'englishLearning.intent.speaking':
		'### Intent: Focus on spoken interaction and fluency: situational dialogues, natural replies, turn-taking and fillers; include short dialogue samples and register notes.',
	'englishLearning.intent.translate':
		'### Intent: Provide bilingual translation with line/sentence alignment; note proper names where needed.',
	'englishLearning.intent.reading':
		'### Intent: Generate a short text for intensive reading and explain hard parts.',
	'englishLearning.intent.literature':
		'### Intent: Literature guide: context, summary, and discussion; also pick at least 5 high-quality passages from the original (each excerpt reasonably short), each followed by a Chinese translation; avoid unrelated long verbatim copying.',
	'englishLearning.intent.grammar':
		'### Intent: Explain the grammar with good and common-mistake examples.',
	'englishLearning.pendingIntent': 'Intent (appended on next send)',
	'englishLearning.pendingIntentShort': 'Appended on next send',

	'englishLearning.agentTool.internet': 'Web search',
	'englishLearning.agentTool.knowledge': 'Knowledge base',
	'englishLearning.agentTool.date': 'Current date',
	'englishLearning.agentTool.other': '{name}',
	'englishLearning.agentTool.querySuffix': ': {q}',
	'englishLearning.agentTool.statusDoing':
		'Research · {action} in progress{detail}',
	'englishLearning.agentTool.statusDone': 'Research · {action} done',
	'englishLearning.webSearch.viewPages': 'Web search {n} items',
	'englishLearning.webSearch.viewWebPages': 'View search',
	'englishLearning.webSearch.viewPagesTitle': 'This web search {n} items',
	'englishLearning.packHistory.webSearchRounds': 'Web search ×{n}',
	'englishLearning.packHistory.deleteAction': 'Delete record',
	'englishLearning.packHistory.deleteConfirmTitle': 'Delete this run?',
	'englishLearning.packHistory.deleteConfirmDesc':
		'This will permanently delete "{topic}" and {count} word(s) from this run.',
	'englishLearning.packHistory.deleteConfirmDescClassic':
		'This will permanently delete "{topic}" and {count} quote(s) from this run.',
	'englishLearning.packHistory.deleteConfirmAction': 'Delete',
	'englishLearning.packHistory.deleteSuccess': 'Run deleted',

	'englishLearning.favoritesDrawer.selectAllLoaded': 'Select all',
	'englishLearning.favoritesDrawer.selectedCount': '{count} selected',
	'englishLearning.favoritesDrawer.removeSelected': 'Remove selected',
	'englishLearning.favoritesDrawer.removing': 'Removing...',
	'englishLearning.favoritesDrawer.removeSuccess': 'Removed selected favorites',
	'englishLearning.favoritesDrawer.removeFail':
		'Remove failed. Try again later.',
	'englishLearning.favoritesDrawer.removeConfirmTitle':
		'Remove selected favorites?',
	'englishLearning.favoritesDrawer.removeConfirmDesc':
		'This will remove {count} selected favorite(s). You can favorite them again from the list.',
	'englishLearning.favoritesDrawer.removeConfirmAction': 'Remove',
	'englishLearning.favoritesDrawer.removeNoneHint':
		'Select items to remove first.',
	'englishLearning.favoritesDrawer.removeOneAction': 'Remove this favorite',
	'englishLearning.favoritesDrawer.removeOneConfirmTitle':
		'Remove this favorite?',
	'englishLearning.favoritesDrawer.removeOneConfirmDescVocab':
		'This will unfavorite the word “{word}”. You can favorite it again from the list.',
	'englishLearning.favoritesDrawer.removeOneConfirmDescClassicIntro':
		'This will unfavorite the English line below. You can favorite it again from the list.',
	'englishLearning.favoritesDrawer.removeOneSuccess': 'Favorite removed',

	'englishLearning.favoritesDrawer.toggleRow': 'Select row',

	'englishLearning.vocab.title': 'Vocabulary',
	'englishLearning.vocab.desc':
		'Generate a themed word list (IPA, Chinese gloss, example). Use the speaker to hear each English word (cloud TTS when configured).',
	'englishLearning.vocab.descShort': 'Generate a word list by theme',
	'englishLearning.vocab.import': 'Import vocabulary',
	'englishLearning.vocab.topicFieldLabel': 'Topic / goal',
	'englishLearning.vocab.topicPlaceholder':
		'e.g. travel phrases, business verbs, IELTS collocations, easily confused pairs…',
	'englishLearning.vocab.topicRequired': 'Enter a topic or learning goal first',
	'englishLearning.vocab.count': 'Count (optional)',
	'englishLearning.vocab.countPlaceholder': 'Empty = max per request',
	'englishLearning.vocab.countHint':
		'Leave empty for the server per-request limit; enter 1–12000, or tap a preset',
	'englishLearning.vocab.countInvalid': 'Use 1–12000, or leave empty',
	'englishLearning.vocab.progress':
		'{collected} / {target} words · batch {round}',
	'englishLearning.vocab.fromDatabase':
		'Loaded {count} word(s) from your library (matching topic)',
	'englishLearning.classic.fromDatabase':
		'Loaded {count} quote(s) from your library (matching topic)',
	'englishLearning.vocab.partialResult':
		'Requested {want}; received {got} (stopped early due to duplicates or limits)',
	'englishLearning.vocab.aborted': 'Fetch cancelled',
	'englishLearning.vocab.streamDisconnected':
		'Stream ended unexpectedly—check your network and try again',
	'englishLearning.vocab.stop': 'Stop fetching',
	'englishLearning.vocab.generate': 'Fetch word list',
	'englishLearning.vocab.empty': 'No items returned; try another topic',
	'englishLearning.vocab.playWord': 'Play word',
	'englishLearning.vocab.favoriteWord': 'Save word',
	'englishLearning.vocab.unfavoriteWord': 'Remove from saved',
	'englishLearning.vocab.listHeading': 'Words',
	'englishLearning.vocab.collapseList': 'Collapse word list',
	'englishLearning.vocab.expandList': 'Expand word list',
	'englishLearning.vocab.historyTitle': 'Past word lists',
	'englishLearning.vocab.historyOpenDrawer': 'History',
	'englishLearning.vocab.favoritesOpenDrawer': 'Saved words',
	'englishLearning.vocab.favoritesTitle': 'Saved vocabulary',
	'englishLearning.vocab.favoritesLoading': 'Loading saved…',
	'englishLearning.vocab.favoritesEmpty': 'No saved words yet',
	'englishLearning.vocab.exportDocx': 'Export DOCX',
	'englishLearning.vocab.exportDocxEmpty': 'Nothing to export',
	'englishLearning.vocab.exportDocxSuccess': 'Download successful',
	'englishLearning.vocab.exportDocxFail': 'Export failed—try again later',
	'englishLearning.vocab.favoritesLoaded': 'Loaded into word list',
	'englishLearning.vocab.historyEmpty':
		'No saved lists yet. They appear here after a successful fetch.',
	'englishLearning.vocab.historyWords': '{count} words',
	'englishLearning.vocab.historyLoad': 'Load',
	'englishLearning.vocab.historyLoaded': 'Loaded this word list',
	'englishLearning.vocab.historyLoading': 'Loading history…',
	'englishLearning.vocab.historyStreaming': 'Generating',

	'englishLearning.classic.title': 'Classic quotes',
	'englishLearning.classic.descShort':
		'Fetch famous quotes, phrases, etc. by theme',
	'englishLearning.classic.import': 'Import quotes',
	'englishLearning.classic.topicFieldLabel': 'Topic / angle',
	'englishLearning.classic.topicPlaceholder':
		'e.g. courage quotes, Pride & Prejudice lines, speech highlights, Shakespeare…',
	'englishLearning.classic.topicRequired': 'Enter a topic or angle first',
	'englishLearning.classic.count': 'Count (optional)',
	'englishLearning.classic.countPlaceholder': 'Empty = max per request',
	'englishLearning.classic.countHint':
		'Leave empty for the server per-request limit; enter 1–6000, or tap a preset',
	'englishLearning.classic.countInvalid': 'Use 1–6000, or leave empty',
	'englishLearning.classic.progress':
		'{collected} / {target} lines · batch {round}',
	'englishLearning.classic.partialResult':
		'Requested {want}; received {got} (stopped early due to duplicates or limits)',
	'englishLearning.classic.aborted': 'Fetch cancelled',
	'englishLearning.classic.streamDisconnected':
		'Stream ended unexpectedly—check your network and try again',
	'englishLearning.classic.stop': 'Stop fetching',
	'englishLearning.classic.generate': 'Fetch quotes',
	'englishLearning.classic.empty': 'No lines returned; try another topic',
	'englishLearning.classic.playQuote': 'Play line',
	'englishLearning.classic.favoriteQuote': 'Save quote',
	'englishLearning.classic.unfavoriteQuote': 'Remove from saved',
	'englishLearning.classic.collapseList': 'Collapse quote list',
	'englishLearning.classic.expandList': 'Expand quote list',
	'englishLearning.classic.sourceLabel': 'Source: ',
	'englishLearning.classic.historyTitle': 'Past quote lists',
	'englishLearning.classic.historyOpenDrawer': 'History',
	'englishLearning.classic.favoritesOpenDrawer': 'Saved quotes',
	'englishLearning.classic.favoritesTitle': 'Saved quotes',
	'englishLearning.classic.favoritesLoading': 'Loading saved…',
	'englishLearning.classic.favoritesEmpty': 'No saved quotes yet',
	'englishLearning.classic.exportDocx': 'Export DOCX',
	'englishLearning.classic.exportDocxEmpty': 'Nothing to export',
	'englishLearning.classic.exportDocxSuccess': 'Download started',
	'englishLearning.classic.exportDocxFail': 'Export failed—try again later',
	'englishLearning.classic.favoritesLoaded': 'Loaded into quote list',
	'englishLearning.classic.historyEmpty': 'No records yet',
	'englishLearning.classic.historyQuotes': '{count} lines',
	'englishLearning.classic.historySentences': '{count} sentences',
	'englishLearning.classic.historyLoaded': 'Loaded this list',
	'englishLearning.classic.historyLoading': 'Loading history…',
	'englishLearning.classic.historyStreaming': 'Generating',

	'englishLearning.tts.play': 'Read aloud',
	'englishLearning.tts.stop': 'Stop',
	'englishLearning.tts.unsupported':
		'Playback unavailable. Check login and cloud TTS, or use a browser with local speech.',
	'assistant.selection.speak': 'Read aloud',
	'assistant.selection.copy': 'Copy',
	'assistant.selection.speakBar': 'Read-aloud controls',
	'assistant.selection.dragBar': 'Drag control bar',
	'assistant.selection.resetBar': 'Reset to default position',
	'assistant.selection.stopSpeak': 'Stop reading',
	'assistant.selection.resizeBar': 'Resize control bar',
	'assistant.tts.unsupported':
		'Playback unavailable. Check login and cloud TTS, or use a browser with local speech.',
	'englishLearning.tts.cloudXfyunFailed': 'iFlytek cloud playback failed',
	'englishLearning.tts.cloudEdgeFailed': 'Edge free voice playback failed',
	'englishLearning.tts.cloudMinimaxFailed': 'MiniMax cloud playback failed',
	'englishLearning.tts.cloudFallbackLocal':
		'Playing with local voice instead. Check your iFlytek credentials or server configuration.',
	'englishLearning.tts.cloudFallbackEdge':
		'Continuing with Edge free voice instead.',
	'englishLearning.tts.hint':
		'Cloud TTS is tried first; browser speech is the fallback. Vocabulary cards play each word.',
	'route.document.title': 'Document',
	'route.coding.title': 'Coding',
	'route.profile.title': 'Profile',
	'route.knowledge.title': 'Knowledge',
	'route.ebook.title': 'Moke BookHouse',
	'route.ebook.shelf': 'My bookshelf',
	'route.ebook.read': 'Reading',

	'ebook.shelf.title': 'My bookshelf',
	'ebook.shelf.hint':
		'EPUB and PDF. Desktop: open local files. Web: import a file. (Upload to cloud after membership)',
	'ebook.shelf.hintTauri':
		'Support epub and pdf. Local file only for non-members. (Upload to cloud after membership)',
	'ebook.shelf.hintTauriMember':
		'Support epub and pdf. Imports are backed up to the cloud.',
	'ebook.shelf.hintWeb':
		'Web import requires membership; desktop can read local files',
	'ebook.shelf.hintWebMember':
		'Support epub and pdf. Imports are backed up to the cloud.',
	'ebook.shelf.membershipRequiredUploadTitle': 'Membership required',
	'ebook.shelf.membershipRequiredUploadMessage':
		'Uploading books to the cloud is a member benefit. Please subscribe before importing.',
	'ebook.shelf.pickLocal': 'Select local file',
	'ebook.shelf.search': 'Search books',
	'ebook.shelf.searchClose': 'Close search',
	'ebook.shelf.searchPlaceholder': 'Search by book title',
	'ebook.shelf.searchEmpty': 'No matching books.',
	'ebook.shelf.pickFile': 'Import file',
	'ebook.shelf.empty': 'No books yet.',
	'ebook.shelf.progress': 'About {pct}% read',
	'ebook.shelf.read': 'Start reading',
	'ebook.shelf.continue': 'Continue',
	'ebook.shelf.deleteConfirmTitle': 'Remove this book?',
	'ebook.shelf.deleteConfirmDesc':
		'「{title}」 and its reading progress will be removed. This cannot be undone.',
	'ebook.shelf.uploadReading': 'Reading local file "{name}"…',
	'ebook.shelf.uploading': 'Uploading "{name}"',
	'ebook.shelf.uploadProgress': '{pct}%',
	'ebook.shelf.uploadHint':
		'Large files may take a while. Please keep this page open.',
	'ebook.shelf.coverSetting': 'Set cover',
	'ebook.shelf.coverSaved': 'Cover updated',
	'ebook.shelf.coverFailed': 'Failed to set cover',
	'ebook.shelf.editTitle': 'Edit title',
	'ebook.shelf.editTitleHint': 'Click to edit: {title}',
	'ebook.shelf.bookCategory': 'Book category: {category}',
	'ebook.shelf.titleSaved': 'Title updated',
	'ebook.shelf.titleFailed': 'Failed to update title',
	'ebook.shelf.alreadyImportedTitle': 'Already on shelf',
	'ebook.shelf.alreadyImportedMessage':
		'This book is already on your shelf; no need to upload again.',
	'ebook.shelf.category.all': 'All',
	'ebook.shelf.category.uncategorized': 'Uncategorized',
	'ebook.shelf.category.manage': 'Manage categories',
	'ebook.shelf.category.add': 'Add category',
	'ebook.shelf.category.rename': 'Rename',
	'ebook.shelf.category.delete': 'Delete category',
	'ebook.shelf.category.deleteConfirm':
		'Books in this category will move to Uncategorized.',
	'ebook.shelf.category.move': 'Move to category',
	'ebook.shelf.category.empty': 'No books in this category.',
	'ebook.shelf.category.duplicateName': 'Category name already exists',
	'ebook.shelf.publicEmpty': 'No public books from others yet.',
	'ebook.shelf.publicOwner': 'Owner',
	'ebook.public.makePublic': 'Make public',
	'ebook.public.confirmPublicTitle': 'Make this book public?',
	'ebook.public.confirmPublicDesc':
		'The full book and your reading thoughts will be visible to all users on their shelves.',
	'ebook.public.confirmPrivateTitle': 'Make this book private?',
	'ebook.public.confirmPrivateDesc':
		'Others will no longer see this book on their public shelf.',
	'ebook.public.epubOnly': 'Only EPUB books can be made public',
	'ebook.public.cloudRequired': 'Upload to cloud before making public',
	'ebook.public.localCannotShare': 'Local books cannot be shared',
	'ebook.public.noLongerPublic': 'This book is no longer public',
	'ebook.read.publicSourceRevoked':
		'The owner has made this book private. You can no longer read it.',
	'ebook.public.sourceGone': 'Book not found or unavailable',
	'ebook.public.visibilityFailed': 'Failed to update visibility',
	'ebook.read.publicReadingBanner':
		'This book is no longer public. You can still read with your own progress and notes.',
	'ebook.read.missing': 'Book not found',
	'ebook.read.sourceLocal': 'Local',
	'ebook.read.sourceOnline': 'Online',
	'ebook.read.backShelf': 'Back to shelf',
	'ebook.read.toc': 'Book contents',
	'ebook.read.ebookIdeas.title': 'All ideas',
	'ebook.read.ebookIdeas.open': 'Ideas for this book',
	'ebook.read.tocEmpty': 'This file has no book contents.',
	'ebook.read.tocScrollToBottom': 'Scroll to bottom',
	'ebook.read.tocScrollToTop': 'Scroll to top',
	'ebook.read.tocScrollToCurrent': 'Scroll to current',
	'ebook.read.settings': 'Reading settings',
	'ebook.read.settings.fontSize': 'Font size',
	'ebook.read.settings.lineHeight': 'Line spacing',
	'ebook.read.settings.pageFlow': 'Page mode',
	'ebook.read.settings.pageFlow.paginated': 'Paginated',
	'ebook.read.settings.pageFlow.scrolled': 'Continuous scroll',
	'ebook.read.settings.textColor': 'Text color',
	'ebook.read.settings.textColor.auto': 'Follow app theme',
	'ebook.read.settings.textColor.dark': 'Black (Kindle)',
	'ebook.read.settings.textColor.softDark': 'Soft black',
	'ebook.read.settings.textColor.brown': 'Brown (sepia)',
	'ebook.read.settings.textColor.sepia': 'Sepia brown',
	'ebook.read.settings.textColor.gray': 'Gray',
	'ebook.read.settings.textColor.light': 'White',
	'ebook.read.settings.textColor.softLight': 'Soft gray (night)',
	'ebook.read.settings.textColor.green': 'Forest green',
	'ebook.read.settings.textColor.blue': 'Slate blue',
	'ebook.read.settings.textColor.rose': 'Rose (pink bg)',
	'ebook.read.settings.textColor.warmGray': 'Warm gray',
	'ebook.read.settings.bgTheme': 'Reading background',
	'ebook.read.settings.bgTheme.default': 'Follow app',
	'ebook.read.settings.bgTheme.paper': 'Paper white',
	'ebook.read.settings.bgTheme.cream': 'Parchment (iBooks)',
	'ebook.read.settings.bgTheme.sepia': 'Sepia',
	'ebook.read.settings.bgTheme.warm': 'Warm yellow',
	'ebook.read.settings.bgTheme.green': 'Mint green (Kindle)',
	'ebook.read.settings.bgTheme.blue': 'Cool blue-gray',
	'ebook.read.settings.bgTheme.gray': 'Soft gray',
	'ebook.read.settings.bgTheme.pink': 'Eye-care pink (WeRead)',
	'ebook.read.settings.bgTheme.lavender': 'Lavender',
	'ebook.read.settings.bgTheme.night': 'Night mode',
	'ebook.read.settings.bgTheme.moon': 'Moonshadow',
	'ebook.read.settings.reset': 'Reset to default',
	'ebook.read.prev': 'Previous',
	'ebook.read.next': 'Next',
	'ebook.read.pdfZoomIn': 'Zoom in',
	'ebook.read.pdfZoomOut': 'Zoom out',
	'ebook.read.pdfZoomHint':
		'Scale relative to fit width; 100% fills the reader width',
	'ebook.read.contextMenu.copy': 'Copy',
	'ebook.read.selectionPop.underline': 'Highlight',
	'ebook.read.selectionPop.removeUnderline': 'Remove highlight',
	'ebook.read.selectionPop.styleHighlight': 'Background highlight',
	'ebook.read.selectionPop.styleUnderline': 'Straight underline',
	'ebook.read.selectionPop.styleWavy': 'Wavy underline',
	'ebook.read.selectionPop.colorPrefix': 'Highlight color',
	'ebook.read.selectionPop.customColor': 'Custom color',
	'ebook.read.selectionPop.share': 'Share',
	'ebook.read.quoteShare.title': 'Share excerpt',
	'ebook.read.quoteShare.hint':
		'Generate an excerpt card image you can paste into WeChat and other apps.',
	'ebook.read.quoteShare.generating': 'Generating image…',
	'ebook.read.quoteShare.previewAlt': 'Excerpt share preview',
	'ebook.read.quoteShare.copyImage': 'Copy image',
	'ebook.read.quoteShare.copied': 'Copied',
	'ebook.read.quoteShare.copySuccess':
		'Image copied—you can share it in other apps.',
	'ebook.read.quoteShare.copyFailed': 'Copy failed. Please try again.',
	'ebook.read.quoteShare.generateFailed': 'Failed to generate share image.',
	'ebook.read.quoteShare.downloadFailed': 'Download failed. Please try again.',
	'ebook.read.quoteShare.brand': 'Moke Reading',
	'ebook.read.selectionPop.askBook': 'Ask MK',
	'ebook.read.selectionPop.listen': 'Listen',
	'ebook.read.listen.followResume': 'Follow playback',
	'ebook.read.listen.followResumeAria':
		'Scroll to the playing passage and resume auto-follow',
	'ebook.read.listenBook': 'Listen to book',
	'ebook.read.listenBook.stop': 'Stop listening',
	'ebook.read.listenBook.pause': 'Pause',
	'ebook.read.listenBook.resume': 'Resume',
	'ebook.read.listenBook.prevSentence': 'Previous sentence',
	'ebook.read.listenBook.nextSentence': 'Next sentence',
	'ebook.read.listenBook.prevChapter': 'Previous chapter',
	'ebook.read.listenBook.nextChapter': 'Next chapter',
	'ebook.read.listenBook.sentenceMenu': 'Sentences',
	'ebook.read.listenBook.sentenceMenuEmpty': 'No sentences',
	'ebook.read.listenBook.scrollToCurrentSentence': 'Scroll to current sentence',
	'ebook.read.listenBook.speed': 'Playback speed',
	'ebook.read.listenBook.speedBookOnly': 'Apply to this book only',
	'ebook.read.listenBook.progress':
		'Ch. {chapter} · sentence {current}/{total}',
	'ebook.read.listenBook.loading': 'Loading…',
	'ebook.read.listenBook.barAria': 'Listen playback controls',
	'ebook.read.listenBook.emptySection': 'No readable text in this section',
	'ebook.read.listenBook.notReady': 'Reader not ready yet. Please try again.',
	'ebook.read.listenBook.finished': 'Finished the book',
	'ebook.read.contextMenu.addThought': 'Add note',
	'ebook.read.contextMenu.assistant': 'Reading assistant',
	'ebook.read.contextMenu.askSelection': 'Ask MK about selection',
	'ebook.read.assistant.close': 'Close MOKE assistant',
	'ebook.read.assistant.open': 'Open MOKE assistant',
	'ebook.read.assistant.toggleAria': 'Toggle MOKE reading assistant',
	'ebook.read.assistant.intro':
		'Ask MOKE about “{title}”—themes, context, or takeaways—or have MOKE summarize chapters and explain difficult passages. Right-click a selection and choose “Ask MK about selection” to ask with that excerpt in context.',
	'ebook.read.assistant.placeholder': 'Ask MOKE about this book…',
	'ebook.read.assistant.systemHint':
		'The user is reading the ebook “{title}”. Answer in that context; when they quote a passage, explain it and its surrounding context first.',
	'ebook.read.assistant.askSelectionDraft':
		'Please explain this excerpt from the book:\n\n> {quote}',
	'ebook.read.thought.createTitle': 'Add note',
	'ebook.read.thought.viewTitle': 'Reading note',
	'ebook.read.thought.editTitle': 'Edit note',
	'ebook.read.thought.label': 'Your note',
	'ebook.read.thought.placeholder': 'Write your thoughts…',
	'ebook.read.thought.save': 'Save',
	'ebook.read.thought.sendPublic': 'Send publicly',
	'ebook.read.thought.sendPrivate': 'Send privately',
	'ebook.read.thought.cancel': 'Cancel',
	'ebook.read.thought.delete': 'Delete',
	'ebook.read.thought.edit': 'Edit',
	'ebook.read.thought.empty': 'No content',
	'ebook.read.thought.cfiFailed':
		'Could not locate the selection. Right-click inside the book text to add a note.',
	'ebook.read.thought.loadFailed': 'Failed to load reading notes',
	'ebook.read.thought.saveFailed': 'Failed to save note',
	'ebook.read.highlight.loadFailed': 'Failed to load highlights',
	'ebook.read.highlight.saveFailed': 'Failed to save highlight',
	'ebook.read.highlight.deleteFailed': 'Failed to remove highlight',
	'ebook.read.thought.deleteFailed': 'Failed to delete note',
	'ebook.read.thought.listTitle': '{count} notes on this passage',
	'ebook.read.thought.totalCount': '{count} total',
	'ebook.read.thought.bookExcerpt': 'Excerpt from book',
	'ebook.read.thought.quoteExpand': 'Expand excerpt',
	'ebook.read.thought.quoteCollapse': 'Collapse excerpt',
	'ebook.read.thought.closeView': 'Close reading note',
	'ebook.read.thought.closeEdit': 'Close note editor',
	'ebook.read.thought.unknownUser': 'Unknown user',
	'ebook.read.thought.clusterExcerpt': 'Excerpt ({length} chars)',
	'ebook.read.thought.viewDetail': 'View note',
	'ebook.read.thought.selectedQuoteHint': 'Showing quote for selected note',
	'ebook.read.thought.visibilityPrivate': 'Private',
	'ebook.err.open': 'Failed to open',
	'ebook.err.loadFailed':
		'Unable to load this book. Please check whether it still exists.',
	'route.account.title': 'Account',
	'route.pay.title': 'Membership',
	'route.setting.title': 'Settings',
	'route.plugins.title': 'Plugins',
	'plugins.page.title': 'Plugins',
	'plugins.page.desc':
		'Plugins Installed (All Disabled by Default). Disabling prevents base loading and hides entry points.',
	'plugins.page.empty': 'No plugins (check that the registry is reachable)',
	'plugins.page.editRegistry': 'Edit config',
	'route.plugins.registry.title': 'Plugin registry',
	'plugins.registry.title': 'Plugin registry',
	'plugins.registry.back': 'Back to Plugins',
	'plugins.registry.reload': 'Reload',
	'plugins.registry.save': 'Save to server',
	'plugins.registry.saving': 'Saving…',
	'plugins.registry.loading': 'Loading…',
	'plugins.registry.invalidJson':
		'Invalid JSON: must parse and include a plugins array',
	'plugins.registry.saveOk': 'Saved to remotes',
	'plugins.registry.saveFail': 'Save failed',
	'plugins.registry.noChanges': 'No changes, no need to save',
	'plugins.registry.missingHostApiRange': 'Plugin {id} is missing hostApiRange',
	'plugins.registry.hostApiIncompatible':
		'Plugin {id}: hostApiRange "{range}" is incompatible with Host API {hostApi}. Bump version only for cache bust; keep hostApiRange as ^{hostApi}',
	'plugins.registry.pluginNotFound': 'Plugin {id} not found in registry',
	'plugins.registry.help.triggerAria': 'Field reference',
	'plugins.registry.help.panelTitle': 'plugins-registry field reference',
	'plugins.registry.help.footnote':
		'Bump version only for cache bust. hostApiRange must cover the current Host API (see VITE_HOST_API_VERSION).',
	'plugins.registry.help.sectionRoot': 'Root',
	'plugins.registry.help.sectionBasic': 'Plugin basics',
	'plugins.registry.help.sectionMf': 'Load & permissions',
	'plugins.registry.help.sectionHost': 'Mount & security',
	'plugins.registry.help.updatedAt':
		'Last updated time; written automatically by the host on save.',
	'plugins.registry.help.plugins':
		'Array of plugin descriptors; each item is one listable plugin.',
	'plugins.registry.help.id':
		'Unique plugin id used for routes, sidebar, and local state.',
	'plugins.registry.help.fieldTitle':
		'Localized name map (zh-CN / en-US) for the plugins page and breadcrumbs.',
	'plugins.registry.help.description':
		'Localized blurb, or a legacy plain string; shown on plugin cards.',
	'plugins.registry.help.routePath':
		'Plugin route path, e.g. /english-learning/notes.',
	'plugins.registry.help.entry':
		'MF entry URL (prefer mf-manifest.json). Production requires https; localhost http is allowed in dev.',
	'plugins.registry.help.version':
		'Plugin package version. Bump this for releases / cache bust; do not confuse with hostApiRange.',
	'plugins.registry.help.hostApiRange':
		'Required Host API range (e.g. ^1.0.0). Must cover the current Host; change only when the Host contract upgrades.',
	'plugins.registry.help.enabled':
		'Catalog default (now false). Actual shelf state is per-account on the server (Web/desktop sync) and is not written back here.',
	'plugins.registry.help.trust':
		'Trust level: first-party / partner / untrusted (iframe only, no loadRemote).',
	'plugins.registry.help.remoteName':
		'MF registerRemotes.name; defaults to id. Use the federation name when multiple plugins share one Remote.',
	'plugins.registry.help.expose':
		'MF expose path; default ./App (e.g. ./LearningNotes, ./EbookIdeas).',
	'plugins.registry.help.framework':
		'Optional react | vue. For vue, Remote must export mount(el, bridge); Host has no Vue and only calls mount.',
	'plugins.registry.help.injectRoute':
		'Whether PluginManager injects a top-level route. false means the host tree already mounts PluginHostPage.',
	'plugins.registry.help.preload':
		'Load timing: route/idle (lazy, default) or eager (background preload after init; rarely needed).',
	'plugins.registry.help.permissions':
		'Permission list, e.g. ui:toast, nav:subtree, http:plugin-api, modules:ebook.',
	'plugins.registry.iconUploadLabel': 'Set plugin icon',
	'plugins.registry.iconPickPlugin': 'Select plugin',
	'plugins.registry.iconUpload': 'Upload & write',
	'plugins.registry.iconUploading': 'Uploading…',
	'plugins.registry.iconUploadOk': 'SVG icon uploaded and written to registry',
	'plugins.registry.iconUploadFail': 'Icon upload failed',
	'plugins.registry.iconSvgOnly': 'Only SVG files are supported',
	'plugins.registry.iconNoTarget':
		'Plugin has no menu / host; cannot write icon',
	'plugins.registry.help.menu':
		'Sidebar entry: order; icon is an SVG image URL (upload, optional).',
	'plugins.registry.help.host':
		'Auto-mount on a host surface: surface (e.g. ebook.read), slot (drawer/toolbar), icon (SVG URL), order.',
	'plugins.registry.help.iframeUrl':
		'Required when trust is untrusted: standalone HTTPS page opened in an iframe.',
	'plugins.registry.help.integrity':
		'Optional sha384 integrity hash for the entry resource.',
	'plugins.registry.help.signature':
		'Optional signature flag; loading is rejected when set to invalid.',
	'plugins.verify.hostApiIncompatible':
		'Plugin {id}: Host API is {hostApi}, incompatible with hostApiRange "{range}". Bump version only for cache bust; change hostApiRange only when the Host contract upgrades',
	'plugins.shelf.on': 'Listed',
	'plugins.shelf.off': 'Delisted',
	'plugins.shelf.toggle': 'List / delist',
	'plugins.card.route': 'Route',
	'plugins.card.entry': 'Entry',
	'plugins.card.trust': 'Trust',
	'plugins.card.noDesc': 'No description',
	'plugins.host.delisted': 'This plugin is delisted. Re-list it from Plugins.',
	'plugins.host.missingIframeUrl':
		'Plugin "{id}" is untrusted but iframeUrl is missing',
	'plugins.host.loading': 'Loading…',
	'plugins.host.loadingNamed': 'Loading plugin "{id}"…',
	'plugins.host.notLoaded': 'Not loaded (start the Remote and retry)',
	'plugins.host.unavailable': 'Plugin "{id}" is unavailable',
	'plugins.host.reload': 'Reload',
	'plugins.host.loadFailed': 'Failed to load plugin "{id}"',
	'route.setting.about': 'About',
	'route.setting.theme': 'Theme',
	'route.setting.llm': 'LLM settings',
	'route.setting.cloudTts': 'Voice settings',
	'route.setting.language': 'Language',
	'route.legal.servicePolicy': 'User service policy',
	'route.legal.userAgreement': 'User service agreement',
	'route.updateInfo.title': 'Release notes',
	'route.projectGuide.title': 'Product guide',
	'route.pluginDevGuide.title': 'Plugin development guide',
	'route.downloadDesktop.title': 'Download desktop app',
	'route.guard.needLoginTitle': 'Please sign in before accessing',
	'route.guard.needLoginMessage': '「{page}」requires sign-in.',
	'route.guard.unknownPage': 'This page',

	'downloadPage.hero.badge': 'Desktop · Stable',
	'downloadPage.hero.title': 'Download dnhyxc-ai for desktop',
	'downloadPage.hero.subtitle':
		'Get the full macOS experience: global shortcuts, local folders, launch at login, and more. ',
	'downloadPage.hero.versionLabel': 'v{version}',
	'downloadPage.hero.dateLabel': 'Released: {date}',
	'downloadPage.hero.primaryCtaMac': 'Download for macOS (DMG)',
	'downloadPage.hero.copyLink': 'Copy link',
	'downloadPage.hero.pickPlatform':
		'Pick a platform below to see available installers.',
	'downloadPage.links.releaseNotes': 'Release notes',
	'downloadPage.links.userGuide': 'Product guide',
	'downloadPage.links.backHome': 'Home',
	'downloadPage.platforms.sectionLabel': 'Choose your platform',
	'downloadPage.platforms.mac': 'macOS',
	'downloadPage.platforms.windows': 'Windows',
	'downloadPage.platforms.linux': 'Linux',
	'downloadPage.mac.cardTitle': 'macOS (Apple silicon)',
	'downloadPage.mac.cardDesc':
		'Most users should grab the DMG. Prefer the .tar.gz if you need the updater channel layout.',
	'downloadPage.mac.downloadDmg': 'Download .dmg',
	'downloadPage.mac.downloadTarGz': 'Download .tar.gz (updater)',
	'downloadPage.mac.stepInstall':
		'Open the DMG and drag dnhyxc-ai into Applications, then launch from Launchpad.',
	'downloadPage.mac.stepGatekeeper':
		'If Gatekeeper blocks the app, allow it under System Settings → Privacy & Security, or right-click the app and choose Open.',
	'downloadPage.mac.stepUpdater':
		'The app can check for updates from About; see release notes on the site for highlights.',
	'downloadPage.mac.noteIntel':
		'This build targets Apple silicon (ARM64). Intel Mac support may arrive in a future release.',
	'downloadPage.mac.noteSource':
		'Binaries are served from GitHub Releases—if download is slow, try another network or retry later.',
	'downloadPage.mac.historyIntro':
		'“Browse all releases” to see every version and download attachments (including aarch64 DMGs).',
	'downloadPage.mac.openLatestTag': 'Open latest tag',
	'downloadPage.mac.openAllReleases': 'Browse all releases',
	'downloadPage.windows.cardTitle': 'Windows',
	'downloadPage.windows.cardDesc':
		'A Windows installer is not available yet. You can keep using the web app for core workflows.',
	'downloadPage.windows.comingSoon': 'Coming soon',
	'downloadPage.linux.cardTitle': 'Linux',
	'downloadPage.linux.cardDesc':
		'Linux desktop packages are under consideration. Use the web app or build from source for now.',
	'downloadPage.linux.comingSoon': 'Coming soon',
	'downloadPage.requirements.title': 'Before you install',
	'downloadPage.requirements.itemNet':
		'You need a working network for download and first-run setup.',
	'downloadPage.requirements.itemMac':
		'Use a recent macOS version and grant permissions (e.g. microphone) when prompted.',
	'downloadPage.requirements.itemAccount':
		'Some features require sign-in; Knowledge still works locally when logged out.',
	'downloadPage.toast.linkCopied': 'Download link copied',
	'downloadPage.toast.copyFailed': 'Could not copy—select the link manually',

	'updateInfoPage.header.subtitle':
		'Capabilities change with releases — keep in sync with the repo notes.',
	'updateInfoPage.item.dateLabel': 'Updated: {date}',
	'pluginDevGuide.item.dateLabel': 'Updated: {date}',

	// 编程文案
	'coding.toolbar.selectTemplate': 'Select template',
	'coding.toolbar.preview.show': '👁️‍🗨️ Show preview',
	'coding.toolbar.preview.hide': '👁️ Hide preview',
	'coding.toolbar.console.show': '👁️‍🗨️ Show console',
	'coding.toolbar.console.hide': '👁️ Hide console',
	'coding.toolbar.forceRefresh': 'Force refresh',
	'coding.toolbar.currentTemplate': 'Current template',

	// 支付文案
	'pay.productName.default': 'Pro credit top-up',
	'pay.toast.loginRequired': 'Please sign in before starting a payment.',
	'pay.toast.missingStripePk.title': 'Missing VITE_STRIPE_PUBLISHABLE_KEY',
	'pay.toast.missingStripePk.message':
		'Configure the publishable key (pk_test_… / pk_live_…) in the frontend .env.',
	'pay.toast.invalidAmount': 'Please enter a valid amount.',
	'pay.toast.amountTooSmall': 'Amount is too small.',
	'pay.toast.clientSecretMissing.title': 'Missing client_secret',
	'pay.toast.clientSecretMissing.message':
		'Please ensure the backend creates a Checkout Session with ui_mode=embedded.',
	'pay.toast.stripeLoadFailed': 'Failed to load Stripe.js.',
	'pay.toast.paid.title': 'Payment completed',
	'pay.toast.paid.message': 'Thanks for your support.',
	'pay.toast.paid.membershipMessage':
		'Membership is active. View benefits on your profile.',
	'pay.toast.mountNodeNotReady': 'Mount node is not ready.',

	'pay.badge.stripeEmbedded': 'Stripe embedded checkout',
	'pay.title': 'Membership billing',
	'pay.loginRequiredHint': 'You need to sign in before starting a payment.',
	'pay.goLogin': 'Go to sign in',

	'pay.form.plan': 'Choose a plan',
	'pay.plan.monthly.label': 'Monthly',
	'pay.plan.monthly.desc': '30 days of membership',
	'pay.plan.quarterly.label': 'Quarterly',
	'pay.plan.quarterly.desc': '90 days of membership',
	'pay.plan.yearly.label': 'Annual',
	'pay.plan.yearly.desc': '365 days of membership',
	'pay.plan.price': '¥{price}',
	'pay.plan.selectedSummary': 'Selected: {label} · {price}',

	'pay.form.currency': 'Currency',
	'pay.form.currency.placeholder': 'Select currency',
	'pay.form.amount': 'Amount ({format})',
	'pay.form.amount.format.integer': 'integer, no decimals',
	'pay.form.amount.format.decimal2': '2 decimals',
	'pay.form.product': 'Product description (optional)',
	'pay.form.product.placeholder': 'e.g. Monthly membership',

	'pay.actions.openEmbedded': 'Open checkout on this page',
	'pay.footer.stripeProvided':
		'Payment form is provided by Stripe embedded components',
	'pay.actions.closeEmbedded': 'Close checkout',

	'pay.currency.cny': 'CNY · RMB',
	'pay.currency.usd': 'USD · US Dollar',
	'pay.currency.eur': 'EUR · Euro',
	'pay.currency.hkd': 'HKD · Hong Kong Dollar',
	'pay.currency.gbp': 'GBP · Pound Sterling',
	'pay.currency.jpy': 'JPY · Japanese Yen',
} as const;
