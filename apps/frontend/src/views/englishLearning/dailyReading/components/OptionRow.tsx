import { RadioGroup, RadioGroupItem } from '@ui/index';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { LABEL, OPT_OFF, OPT_ON } from './classes';

export function OptionRow<T extends string>({
	name,
	label,
	value,
	options,
	onChange,
	trailing,
}: {
	name: string;
	label: string;
	value: T;
	options: { value: T; label: string }[];
	onChange: (value: T) => void;
	trailing?: ReactNode;
}) {
	const radios = (
		<RadioGroup
			value={value}
			onValueChange={(next) => onChange(next as T)}
			className={cn(
				'grid gap-4',
				options.length === 4
					? 'grid-cols-4'
					: options.length === 2
						? 'grid-cols-2'
						: 'grid-cols-3',
			)}
		>
			{options.map((opt) => {
				const id = `${name}-${opt.value}`;
				const active = value === opt.value;
				return (
					<label
						key={opt.value}
						htmlFor={id}
						className={cn(
							'flex h-10 cursor-pointer items-center justify-center rounded-md border text-base font-semibold transition-colors',
							active ? OPT_ON : OPT_OFF,
						)}
					>
						<RadioGroupItem value={opt.value} id={id} className="sr-only" />
						{opt.label}
					</label>
				);
			})}
		</RadioGroup>
	);
	return (
		<section className="flex min-w-0 flex-col gap-3">
			{trailing ? (
				<div className="flex min-w-0 items-stretch gap-4">
					<div className="flex min-w-0 flex-1 flex-col gap-3">
						<h2 className={LABEL}>{label}</h2>
						{radios}
					</div>
					{trailing}
				</div>
			) : (
				<>
					<h2 className={LABEL}>{label}</h2>
					{radios}
				</>
			)}
		</section>
	);
}
