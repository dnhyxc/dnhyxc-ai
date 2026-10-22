import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ui/select';

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

/** 下拉目前撑满可用高度，默认只留一半。 */
const DEFAULT_MAX_HEIGHT =
	'calc(var(--radix-select-content-available-height) / 2)';

/** 与设置页选项按钮 h-10 一致。Select 默认 h-9 会压过 class。 */
const DEFAULT_HEIGHT = '2.5rem';

/** 0–23 整点下拉。边框与选中底色跟设置页选项一致。 */
export default function HourPicker({
	value,
	onChange,
	disabled,
	label,
	name = 'hour',
	height = DEFAULT_HEIGHT,
	maxHeight = DEFAULT_MAX_HEIGHT,
}: {
	value: number;
	onChange: (hour: number) => void;
	disabled?: boolean;
	label?: string;
	name?: string;
	height?: string;
	maxHeight?: string;
}) {
	return (
		<section className="flex min-w-0 flex-col gap-3">
			{label ? (
				<h2 className="text-textcolor text-sm font-semibold">{label}</h2>
			) : null}
			<Select
				value={String(value)}
				disabled={disabled}
				onValueChange={(next) => onChange(Number(next))}
			>
				<SelectTrigger
					id={name}
					style={{ height }}
					className="border-theme/10 bg-theme/5 w-full cursor-pointer shadow-none hover:border-teal-500/35 hover:bg-teal-500/10 focus-visible:border-teal-500/40 focus-visible:ring-0"
				>
					<SelectValue />
				</SelectTrigger>
				<SelectContent style={{ maxHeight }}>
					{HOURS.map((hour) => (
						<SelectItem
							key={hour}
							value={String(hour)}
							className="my-1 cursor-pointer focus:bg-teal-500/10 data-[state=checked]:bg-teal-500/15 data-[state=checked]:text-textcolor"
						>
							{`${String(hour).padStart(2, '0')}:00`}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</section>
	);
}
