import { Button, Spinner } from '@ui/index';
import { useSyncExternalStore } from 'react';
import { pickPluginLocaleText, useHostSurfacePlugins } from '@/federation';
import { PluginIcon } from '@/federation/host/PluginIcon';
import {
	isVocabDetailPending,
	openVocabDetail,
	subscribeVocabDetailPending,
} from '@/federation/modules/vocabDetail/session';
import { useI18n } from '@/hooks';
import type { CardData } from './Card';

/** 单词卡尾部：已启用的 card-action 插件各一枚图标。未启用时不占位。 */
export function VocabCardPluginActions({ card }: { card: CardData }) {
	const { locale } = useI18n();
	const pending = useSyncExternalStore(
		subscribeVocabDetailPending,
		() => isVocabDetailPending(card.word),
		() => false,
	);
	const plugins = useHostSurfacePlugins('english.vocab.card').filter(
		(plugin) => plugin.host?.slot === 'card-action',
	);
	if (plugins.length === 0) return null;
	return (
		<>
			{plugins.map((plugin) => {
				const label = pickPluginLocaleText(plugin.title, locale) || plugin.id;
				return (
					<Button
						key={plugin.id}
						type="button"
						variant="ghost"
						size="sm"
						disabled={!card.word.trim()}
						className="h-7 w-7 shrink-0 rounded-md border border-theme/10 p-0 text-textcolor/55 hover:border-theme/20 hover:bg-theme/10 hover:text-teal-600"
						aria-label={label}
						aria-busy={pending}
						onPointerDown={(event) => event.stopPropagation()}
						onClick={() =>
							openVocabDetail(plugin.id, {
								word: card.word,
								pos: card.pos,
								ipa: card.ipa,
								translationZh: card.translationZh,
								example: card.example,
							})
						}
					>
						{pending ? (
							<Spinner className="size-3.5 text-textcolor/55" aria-hidden />
						) : (
							<PluginIcon name={plugin.host?.icon} className="size-3.5" />
						)}
					</Button>
				);
			})}
		</>
	);
}
