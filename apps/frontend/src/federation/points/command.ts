import { isPluginEnabled } from '@dnhyxc-ai/federation-kit';
import { playPreferred, stopAllPlayback } from '@/utils/speech';
import { pickEnglishLearningJsonFile } from '@/views/englishLearning/import/englishLearningImportFile';
import { TTS_CACHE_FOLDER } from '@/views/englishLearning/utils/ttsCacheFolder';
import { getHostPoint, POINT } from './catalog';
import {
	bindPointCommand,
	closePoint,
	getPointCommand,
	openPoint,
} from './session';

function wordOf(arg: unknown): string {
	if (typeof arg === 'string') return arg.trim();
	if (arg && typeof arg === 'object' && 'word' in arg) {
		const word = (arg as { word?: unknown }).word;
		return typeof word === 'string' ? word.trim() : '';
	}
	return '';
}

function wordPayload(
	arg: unknown,
	opts?: { listSource?: boolean; fields?: readonly string[] },
): Record<string, unknown> | null {
	const word = wordOf(arg);
	if (!word) return null;
	const payload: Record<string, unknown> = { word };
	if (opts?.listSource) payload.source = 'list';
	if (arg && typeof arg === 'object' && opts?.fields) {
		const row = arg as Record<string, unknown>;
		for (const key of opts.fields) {
			if (key === 'source') {
				if (row.source === 'list') payload.source = 'list';
				continue;
			}
			if (typeof row[key] === 'string') payload[key] = row[key];
		}
	}
	return payload;
}

export function runCommand(
	pointId: string,
	name: string,
	arg: unknown,
): unknown {
	const spec = getHostPoint(pointId);
	if (!spec?.commands.includes(name)) throw new Error('UNKNOWN_POINT_COMMAND');
	const fn = getPointCommand(pointId, name);
	if (!fn) throw new Error('POINT_COMMAND_UNBOUND');
	return fn(arg);
}

bindPointCommand(POINT.vocabCard, 'play', (arg) => {
	const word = wordOf(arg);
	if (!word) return Promise.resolve();
	return playPreferred(word, {
		persistDisk: true,
		cacheFolder: TTS_CACHE_FOLDER.vocabDetail,
	});
});

bindPointCommand(POINT.vocabCard, 'stop', () => {
	stopAllPlayback();
});

bindPointCommand(POINT.vocabLibrary, 'pickJsonFile', () =>
	pickEnglishLearningJsonFile(),
);

bindPointCommand(POINT.vocabLibrary, 'openCard', (arg) => {
	const payload = wordPayload(arg, { listSource: true });
	if (!payload) return false;
	return openPoint(POINT.vocabCard, 'vocabDetail', 'drawer', payload);
});

bindPointCommand(POINT.dailyReadingArticle, 'play', (arg) => {
	const text = typeof arg === 'string' ? arg.trim() : '';
	if (!text) return Promise.resolve();
	return playPreferred(text, {
		persistDisk: true,
		cacheFolder: 'daily_reading_words',
		cacheTitle: text,
	});
});

bindPointCommand(POINT.dailyReadingArticle, 'stop', () => {
	stopAllPlayback();
});

bindPointCommand(POINT.dailyReadingArticle, 'detailEntries', () => ({
	detail: isPluginEnabled('vocabDetail'),
	list: isPluginEnabled('vocabDetailList'),
	import: isPluginEnabled('vocabDetailImport'),
}));

bindPointCommand(POINT.dailyReadingArticle, 'openDetail', (arg) => {
	const payload = wordPayload(arg, {
		fields: ['translationZh', 'example', 'source'],
	});
	if (!payload) return false;
	return openPoint(POINT.vocabCard, 'vocabDetail', 'drawer', payload);
});

bindPointCommand(POINT.dailyReadingArticle, 'openDetailList', () =>
	openPoint(POINT.vocabLibrary, 'vocabDetailList', 'drawer', {
		scope: 'dailyReading',
	}),
);

bindPointCommand(POINT.dailyReadingArticle, 'openDetailImport', () =>
	openPoint(POINT.vocabLibrary, 'vocabDetailImport', 'import-drawer', {
		scope: 'dailyReading',
	}),
);

bindPointCommand(POINT.ebookRead, 'closeIdeasList', () => {
	closePoint(POINT.ebookRead, 'drawer');
	return true;
});
