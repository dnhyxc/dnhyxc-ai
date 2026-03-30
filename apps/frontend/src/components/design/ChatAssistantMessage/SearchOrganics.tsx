import { Drawer } from '@design/Drawer';
import { openUrl } from '@tauri-apps/plugin-opener';
import { ScrollArea } from '@ui/index';
import { SearchOrganicItem } from '@/types/chat';

interface IProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	organics: SearchOrganicItem[];
}

const SearchOrganics: React.FC<IProps> = ({ open, onOpenChange, organics }) => {
	const onClickOrganic = (link: string) => {
		openUrl(link);
	};

	return (
		<Drawer title="联网搜索结果" open={open} onOpenChange={onOpenChange}>
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
									<span className="bg-theme/20 text-textcolor rounded-full text-sm w-5.5 h-5.5 p-2 flex items-center justify-center">
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
