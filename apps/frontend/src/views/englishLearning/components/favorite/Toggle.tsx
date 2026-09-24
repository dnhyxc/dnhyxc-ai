import { Button } from '@ui/index';
import { Star } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import Tooltip from '@/components/design/Tooltip';
import { useI18n } from '@/hooks';
import { useIncrementalClassicQuoteFavoriteStatus } from '@/hooks/useIncrementalClassicQuoteFavoriteStatus';
import { useIncrementalVocabFavoriteStatus } from '@/hooks/useIncrementalVocabFavoriteStatus';
import { cn } from '@/lib/utils';
import {
	addEnglishClassicQuoteFavorite,
	addEnglishVocabularyFavorite,
	classicQuoteFavoriteContentKey,
	type EnglishClassicQuoteItem,
	type EnglishVocabularyItem,
	normalizeEnglishVocabWordKey,
	removeEnglishClassicQuoteFavorite,
	removeEnglishVocabularyFavorite,
} from '@/service';

export type VocabFavoriteItem = EnglishVocabularyItem & {
	favoriteId?: string | null;
};

export type ClassicFavoriteItem = EnglishClassicQuoteItem & {
	favoriteId?: string | null;
};

export type ToggleProps =
	| {
			kind: 'vocab';
			item: VocabFavoriteItem;
			className?: string;
			tabIndex?: number;
	  }
	| {
			kind: 'classic';
			item: ClassicFavoriteItem;
			className?: string;
			tabIndex?: number;
	  };

function useToggleBindings(props: ToggleProps) {
	const { t } = useI18n();
	const { kind } = props;
	const vocabItem = kind === 'vocab' ? props.item : null;
	const classicItem = kind === 'classic' ? props.item : null;

	const vocabCardItems = useMemo(
		() => (vocabItem ? [{ word: vocabItem.word }] : []),
		[vocabItem?.word],
	);
	const classicCardItems = useMemo(
		() => (classicItem ? [{ english: classicItem.english }] : []),
		[classicItem?.english],
	);

	const vocabStatus = useIncrementalVocabFavoriteStatus(vocabCardItems);
	const classicStatus =
		useIncrementalClassicQuoteFavoriteStatus(classicCardItems);

	const itemKey =
		kind === 'vocab' && vocabItem
			? normalizeEnglishVocabWordKey(vocabItem.word)
			: classicItem
				? classicQuoteFavoriteContentKey(classicItem.english)
				: '';

	const isFavorited =
		kind === 'vocab' && vocabItem
			? vocabStatus.isVocabularyFavorited(vocabItem.word, vocabItem.favoriteId)
			: classicItem
				? classicStatus.isClassicQuoteFavorited(
						classicItem.english,
						classicItem.favoriteId,
					)
				: false;

	const checkFavorited = useCallback(() => {
		if (kind === 'vocab' && vocabItem) {
			return vocabStatus.isVocabularyFavorited(
				vocabItem.word,
				vocabItem.favoriteId,
			);
		}
		if (classicItem) {
			return classicStatus.isClassicQuoteFavorited(
				classicItem.english,
				classicItem.favoriteId,
			);
		}
		return false;
	}, [classicItem, classicStatus, kind, vocabItem, vocabStatus]);

	const resolveFavoriteId = useCallback(() => {
		if (kind === 'vocab' && vocabItem) {
			return vocabStatus.resolveVocabularyFavoriteId(
				vocabItem.word,
				vocabItem.favoriteId,
			);
		}
		if (classicItem) {
			return classicStatus.resolveClassicQuoteFavoriteId(
				classicItem.english,
				classicItem.favoriteId,
			);
		}
		return undefined;
	}, [classicItem, classicStatus, kind, vocabItem, vocabStatus]);

	const addFavorite = useCallback(async () => {
		if (kind === 'vocab' && vocabItem) {
			const res = await addEnglishVocabularyFavorite(vocabItem);
			return res.data?.id;
		}
		if (classicItem) {
			const res = await addEnglishClassicQuoteFavorite(classicItem);
			return res.data?.id;
		}
		return undefined;
	}, [classicItem, kind, vocabItem]);

	const removeFavorite = useCallback(
		(id: string) =>
			kind === 'vocab'
				? removeEnglishVocabularyFavorite(id)
				: removeEnglishClassicQuoteFavorite(id),
		[kind],
	);

	const setFavoriteId = useCallback(
		(id: string) => {
			if (kind === 'vocab') {
				vocabStatus.setVocabularyFavoriteId(itemKey, id);
				return;
			}
			classicStatus.setClassicQuoteFavoriteId(itemKey, id);
		},
		[classicStatus, itemKey, kind, vocabStatus],
	);

	const clearFavorite = useCallback(() => {
		if (kind === 'vocab') {
			vocabStatus.clearVocabularyFavorite(itemKey);
			return;
		}
		classicStatus.clearClassicQuoteFavorite(itemKey);
	}, [classicStatus, itemKey, kind, vocabStatus]);

	const favoriteLabel =
		kind === 'vocab'
			? t('englishLearning.vocab.favoriteWord')
			: t('englishLearning.classic.favoriteQuote');
	const unfavoriteLabel =
		kind === 'vocab'
			? t('englishLearning.vocab.unfavoriteWord')
			: t('englishLearning.classic.unfavoriteQuote');

	const [favBusy, setFavBusy] = useState(false);

	const onToggle = useCallback(async () => {
		if (!itemKey || favBusy) return;
		setFavBusy(true);
		try {
			if (checkFavorited()) {
				const favoriteId = resolveFavoriteId();
				if (!favoriteId) {
					clearFavorite();
					return;
				}
				await removeFavorite(favoriteId);
				clearFavorite();
			} else {
				const newId = await addFavorite();
				if (newId) setFavoriteId(newId);
			}
		} catch {
			// 错误提示由 http 客户端统一处理
		} finally {
			setFavBusy(false);
		}
	}, [
		addFavorite,
		checkFavorited,
		clearFavorite,
		favBusy,
		itemKey,
		removeFavorite,
		resolveFavoriteId,
		setFavoriteId,
	]);

	return {
		favBusy,
		isFavorited,
		onToggle,
		favoriteLabel,
		unfavoriteLabel,
	};
}

export function Toggle({ className, tabIndex, ...props }: ToggleProps) {
	const { favBusy, isFavorited, onToggle, favoriteLabel, unfavoriteLabel } =
		useToggleBindings(props);

	return (
		<Tooltip side="top" content={isFavorited ? unfavoriteLabel : favoriteLabel}>
			<Button
				type="button"
				variant="link"
				size="sm"
				tabIndex={tabIndex}
				aria-busy={favBusy}
				className={cn(
					'h-8 w-8 shrink-0 cursor-pointer rounded-md border-0 p-0 shadow-none transition-colors focus-visible:border-transparent focus-visible:ring-0 focus-visible:shadow-none',
					favBusy && 'opacity-60',
					isFavorited ? 'text-teal-500' : 'text-textcolor/55',
					className,
				)}
				aria-pressed={isFavorited}
				aria-label={isFavorited ? unfavoriteLabel : favoriteLabel}
				onClick={(e) => {
					void onToggle();
					e.currentTarget.blur();
				}}
			>
				<Star
					className={cn('size-4.5', isFavorited && 'fill-current')}
					aria-hidden
				/>
			</Button>
		</Tooltip>
	);
}
