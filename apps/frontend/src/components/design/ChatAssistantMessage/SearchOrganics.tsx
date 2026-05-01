import { Drawer } from '@design/Drawer';
import { ScrollArea } from '@ui/index';
import { ChatI18nT, SearchOrganicItem } from '@/types/chat';
import { openExternalUrl } from '@/utils';

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
			<ScrollArea className="h-full overflow-y-auto pr-4 box-border">
				<div className="flex flex-col gap-2">
					{organics?.map((searchOrganic) => (
						<div
							key={searchOrganic.link}
							onClick={() => onClickOrganic(searchOrganic.link)}
							className="w-full cursor-pointer overflow-hidden flex flex-col gap-2 hover:bg-theme/10 p-2 rounded-md"
						>
							{/* float：首行标题在序号/日期右侧，换行后与 position 左缘齐平 */}
							<div className="flow-root">
								<div className="float-left flex items-center gap-2">
									<span className="bg-theme/20 text-textcolor rounded-full text-[13px] w-5 h-5 p-2 flex items-center justify-center">
										{searchOrganic.position}
									</span>
									{searchOrganic.date && (
										<span className="text-textcolor/50 text-base">
											{searchOrganic.date}
										</span>
									)}
								</div>
								<span className="wrap-break-word ml-3">
									{searchOrganic.title}
								</span>
							</div>
							<div className="text-sm text-textcolor/70">
								{searchOrganic.snippet}
							</div>
						</div>
					))}
				</div>
			</ScrollArea>
		</Drawer>
	);
};

export default SearchOrganics;
