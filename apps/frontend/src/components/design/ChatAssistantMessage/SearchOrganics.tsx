import { Drawer } from '@design/Drawer';
import { ScrollArea } from '@ui/index';
import { Globe } from 'lucide-react';
import { ChatI18nT, SearchOrganicItem } from '@/types/chat';
import { openExternalUrl } from '@/utils';
import {
	sanitizeOrganicSnippetForPreview,
	shortHostnameFromUrl,
} from '@/utils/organicCitation';

interface IProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	organics: SearchOrganicItem[];
	/** i18n 翻译函数（可选）；不传则沿用组件内默认中文文案 */
	t?: ChatI18nT;
}

const SearchOrganics: React.FC<IProps> = ({
	open,
	onOpenChange,
	organics,
	t,
}) => {
	const onClickOrganic = (link: string) => {
		void openExternalUrl(link);
	};

	return (
		<Drawer
			title={t?.('chat.searchOrganics.title') ?? '联网搜索结果'}
			open={open}
			onOpenChange={onOpenChange}
		>
			<ScrollArea className="box-border h-full overflow-y-auto pr-2">
				<div className="flex flex-col gap-1 pb-2">
					{organics?.map((item, idx) => (
						<button
							type="button"
							key={`${item.link}-${idx}`}
							onClick={() => onClickOrganic(item.link)}
							className="w-full cursor-pointer bg-transparent text-left p-2 pr-1.5 rounded-md transition-colors hover:bg-theme/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme/30"
						>
							<div className="flex flex-col gap-2">
								<h3 className="text-[15px] font-semibold leading-snug text-textcolor wrap-break-word">
									{item.title}
								</h3>
								{item.snippet ? (
									<p className="line-clamp-3 wrap-break-word text-[13px] leading-relaxed text-textcolor/65">
										{sanitizeOrganicSnippetForPreview(item.snippet)}
									</p>
								) : null}
								<div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5 text-[13px] text-textcolor/55">
									<div className="relative flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-theme/20">
										{item.icon ? (
											<img
												src={item.icon}
												alt=""
												referrerPolicy="no-referrer"
												className="relative z-1 h-full w-full object-cover"
												onError={(ev) => {
													ev.currentTarget.style.visibility = 'hidden';
												}}
											/>
										) : (
											<Globe
												size={12}
												className="pointer-events-none absolute inset-0 m-auto text-textcolor/45"
												aria-hidden
											/>
										)}
									</div>
									<span className="min-w-0 truncate">
										{shortHostnameFromUrl(item.link)}
									</span>
									{item.date ? (
										<span className="shrink-0 tabular-nums">{item.date}</span>
									) : null}
								</div>
							</div>
						</button>
					))}
				</div>
			</ScrollArea>
		</Drawer>
	);
};

export default SearchOrganics;
