import { Progress } from '@ui/progress';
import { useI18n } from '@/hooks';
import type { EbookUploadState } from '@/store/ebook';

type Props = {
	state: EbookUploadState;
};

export function EbookShelfUploadBanner({ state }: Props) {
	const { t } = useI18n();
	const isReading = state.phase === 'reading';
	const pct = Math.min(100, Math.max(0, Math.round(state.percent)));

	return (
		<div
			className="border-theme/15 bg-theme-card mb-4 rounded-lg border p-4 shadow-sm"
			role="status"
			aria-live="polite"
		>
			<p className="text-textcolor mb-2 text-sm font-medium">
				{isReading
					? t('ebook.shelf.uploadReading', { name: state.fileName })
					: t('ebook.shelf.uploading', { name: state.fileName })}
			</p>
			{isReading ? (
				<Progress value={12} className="h-2" aria-hidden />
			) : (
				<div className="flex items-center gap-3">
					<Progress
						value={pct}
						className="h-2 flex-1"
						aria-label={t('ebook.shelf.uploadProgress', { pct })}
					/>
					<span className="text-textcolor/60 tabular-nums text-xs">
						{t('ebook.shelf.uploadProgress', { pct })}
					</span>
				</div>
			)}
			<p className="text-textcolor/50 mt-2 text-xs">
				{t('ebook.shelf.uploadHint')}
			</p>
		</div>
	);
}
