import { readingExportItem } from './reading-word-export';

describe('readingExportItem', () => {
	it('keeps a word that has no ipa and uses the newest sentence', () => {
		const item = readingExportItem({
			word: 'steadfast',
			zh: '坚定的',
			sources: [
				{
					readingId: 'a',
					titleEn: '',
					titleZh: '',
					sentence: 'old',
					surface: 'gloss',
					collectedAt: '2020-01-01T00:00:00.000Z',
				},
				{
					readingId: 'b',
					titleEn: '',
					titleZh: '',
					sentence: 'new',
					surface: 'gloss',
					collectedAt: '2024-01-01T00:00:00.000Z',
				},
			],
		});
		expect(item).toEqual({
			word: 'steadfast',
			ipa: '',
			pos: '',
			segmentation: '',
			translationZh: '坚定的',
			example: 'new',
		});
	});
});
