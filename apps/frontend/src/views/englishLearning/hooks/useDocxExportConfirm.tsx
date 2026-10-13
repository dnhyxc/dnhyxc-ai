/** 大集合 Word 导出：Confirm 后台生成（返回 Promise<boolean>）。 */
import Confirm from '@design/Confirm';
import { useCallback, useRef, useState } from 'react';
import { useI18n } from '@/hooks';
import { ENGLISH_DOCX_SYNC_SOFT } from '@/service';

export function useDocxExportConfirm() {
	const { t } = useI18n();
	const [open, setOpen] = useState(false);
	const [count, setCount] = useState(0);
	const resolverRef = useRef<((ok: boolean) => void) | null>(null);

	const settle = useCallback((ok: boolean) => {
		resolverRef.current?.(ok);
		resolverRef.current = null;
		setOpen(false);
	}, []);

	const confirmAsync = useCallback((exportCount: number) => {
		setCount(exportCount);
		return new Promise<boolean>((resolve) => {
			resolverRef.current = resolve;
			setOpen(true);
		});
	}, []);

	const confirmNode = (
		<Confirm
			open={open}
			onOpenChange={(next) => {
				if (!next) settle(false);
				else setOpen(true);
			}}
			title={t('englishLearning.export.asyncConfirmTitle')}
			description={t('englishLearning.export.asyncConfirmDesc', {
				count,
				soft: ENGLISH_DOCX_SYNC_SOFT,
			})}
			descriptionClassName="text-left"
			confirmText={t('englishLearning.export.asyncConfirmAction')}
			cancelText={t('common.cancel')}
			onConfirm={() => settle(true)}
		/>
	);

	return { confirmAsync, confirmNode };
}
