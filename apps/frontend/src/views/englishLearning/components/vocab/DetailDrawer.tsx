import { Drawer } from '@design/Drawer';
import { useEffect, useRef, useState } from 'react';
import {
	claimPluginPortalTarget,
	clearPluginPortalClaim,
	pickPluginLocaleText,
	styleRealmKey,
	useHostSurfacePlugins,
} from '@/federation';
import { PluginHostPage } from '@/federation/host/PluginHostPage';
import {
	closeVocabDetail,
	readVocabDetailSession,
	subscribeVocabDetail,
	vocabDetailReplacedByList,
} from '@/federation/modules/vocabDetail/session';
import { useI18n } from '@/hooks';

/** 详解抽屉与详解列表抽屉共用，避免两层宽度不一致。 */
export const vocabDrawerWidth = 'w-full sm:max-w-[420px]';

/** 英语学习布局上唯一的详解抽屉。插件正文只加载一次。 */
export function VocabDetailDrawer() {
	const { locale } = useI18n();
	const plugins = useHostSurfacePlugins('english.vocab.card');
	const [session, setSession] = useState(readVocabDetailSession);

	useEffect(
		() => subscribeVocabDetail(() => setSession(readVocabDetailSession())),
		[],
	);

	const plugin = plugins.find(
		(item) => item.id === session.pluginId && item.host?.slot === 'card-action',
	);
	const open = session.open && Boolean(plugin);
	const claimedId = useRef<string | null>(null);
	// 抽屉走 Portal。先认领再画，第二次渲染才不会把 Portal 从 body 挪进插件 scope
	if (open && plugin) {
		claimPluginPortalTarget(
			plugin.id,
			styleRealmKey(plugin.entry, plugin.remoteName, plugin.id),
		);
		claimedId.current = plugin.id;
	} else if (claimedId.current) {
		clearPluginPortalClaim(claimedId.current);
		claimedId.current = null;
	}

	useEffect(() => {
		if (session.open && session.pluginId && !plugin) closeVocabDetail();
	}, [plugin, session.open, session.pluginId]);

	// 列表同时打开时，退场滑出的这层会把新抽屉的 Loading 挤到右边
	if (!open && vocabDetailReplacedByList()) return null;

	const title = plugin
		? pickPluginLocaleText(plugin.title, locale) || plugin.id
		: '';

	return (
		<Drawer
			open={open}
			title={title}
			width={vocabDrawerWidth}
			bodyClassName="overflow-hidden p-0"
			onOpenChange={(next) => {
				if (!next) {
					if (claimedId.current) {
						clearPluginPortalClaim(claimedId.current);
						claimedId.current = null;
					}
					closeVocabDetail();
				}
			}}
		>
			{plugin ? (
				<div className="h-full min-h-0">
					<PluginHostPage
						pluginId={plugin.id}
						part="drawer"
						className="h-full min-h-0"
					/>
				</div>
			) : null}
		</Drawer>
	);
}
