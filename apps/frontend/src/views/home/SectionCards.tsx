import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { SquareArrowOutUpRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
	HUE_HOVER_GLOW,
	HUE_HOVER_SHADOW,
	HUE_STYLES,
	HUE_TEXT_GRADIENT,
} from './content';

const SECTION_GLOW_BG = [
	'radial-gradient(55% 70% at 9% 10%, color-mix(in oklch, #2dd4bf 5%, transparent), transparent 55%)',
	'radial-gradient(90% 70% at 70% 30%, color-mix(in oklch, #2dd4bf 10%, transparent), transparent 58%)',
	'radial-gradient(70% 55% at 10% 85%, color-mix(in oklch, #22d3ee 7%, transparent), transparent 52%)',
	'radial-gradient(55% 70% at 91% 90%, color-mix(in oklch, #2dd4bf 5%, transparent), transparent 55%)',
].join(', ');

export type HueKey = keyof typeof HUE_STYLES;

export type ItemCardProps = {
	hue: HueKey;
	icon: LucideIcon;
	title: ReactNode;
	desc: ReactNode;
	delay: number;
	itemKey: string;
	ctaLabel?: ReactNode;
	onClick?: () => void;
};

export type SectionWithCardsProps = {
	id?: string;
	title: ReactNode;
	items: ItemCardProps[];
	delayStep?: number;
	status?: ReactNode;
};

function SectionGlow() {
	return (
		<div
			className="pointer-events-none absolute inset-0"
			style={{ scale: 1.08, background: SECTION_GLOW_BG }}
			aria-hidden
		/>
	);
}

export function ItemCard({
	hue,
	icon: Icon,
	title,
	desc,
	ctaLabel,
	delay,
	itemKey,
	onClick,
}: ItemCardProps) {
	const style = HUE_STYLES[hue] ?? HUE_STYLES.teal;
	return (
		<motion.div
			key={itemKey}
			initial={{ opacity: 0, y: 16 }}
			whileInView={{ opacity: 1, y: 0 }}
			viewport={{ once: true, margin: '-20px' }}
			transition={{ delay, duration: 0.35 }}
			whileHover={{ y: -4 }}
			className={cn(
				'group relative isolate flex h-45 cursor-pointer flex-col items-center justify-center rounded-md border-0 bg-theme/5 p-5 text-center transition-all duration-300',
				HUE_HOVER_GLOW[hue] ?? HUE_HOVER_GLOW.teal,
				HUE_HOVER_SHADOW[hue] ?? HUE_HOVER_SHADOW.teal,
			)}
			onClick={onClick}
		>
			<div
				className={cn(
					'mb-3.5 flex h-11 w-11 items-center justify-center rounded-lg bg-linear-to-br shadow-md transition-shadow duration-300 group-hover:shadow-lg',
					style.icon,
				)}
			>
				<Icon className="h-5 w-5 text-white" />
			</div>
			<h4
				className={cn(
					'mb-1.5 bg-linear-to-r bg-clip-text text-sm font-semibold leading-tight text-transparent',
					HUE_TEXT_GRADIENT[hue] ?? HUE_TEXT_GRADIENT.teal,
				)}
			>
				{title}
			</h4>
			<p className="text-xs leading-5 text-textcolor/45">{desc}</p>
			{ctaLabel ? (
				<div className="mt-3 flex min-h-[20px] items-center gap-1 text-xs font-medium text-textcolor/35 transition-colors group-hover:text-teal-500">
					<span>{ctaLabel}</span>
					<SquareArrowOutUpRight className="h-3 w-3 transition-transform duration-300" />
				</div>
			) : null}
		</motion.div>
	);
}

export function SectionCards({
	id,
	title,
	items,
	delayStep = 0.06,
	status,
}: SectionWithCardsProps) {
	return (
		<motion.section
			id={id}
			initial={{ opacity: 0, y: 16 }}
			whileInView={{ opacity: 1, y: 0 }}
			viewport={{ once: true, margin: '-40px' }}
			transition={{ duration: 0.4 }}
			className={cn(
				'relative overflow-hidden rounded-md bg-theme-background p-5.5 backdrop-blur-xl',
				id && 'scroll-mt-4',
			)}
		>
			<SectionGlow />
			<div className="relative z-10">
				<div className="mb-6 flex items-center justify-between">
					<h3 className="bg-linear-to-r from-teal-400 to-cyan-400 bg-clip-text text-xl font-semibold tracking-tight text-transparent">
						{title}
					</h3>
					{status != null &&
						(typeof status === 'string' ? (
							<span className="hidden shrink-0 items-center gap-2 text-xs tracking-wide text-textcolor/35 sm:inline-flex">
								<span className="relative flex size-1.5">
									<span className="absolute inline-flex size-full animate-ping rounded-full bg-teal-400/50" />
									<span className="relative size-1.5 rounded-full bg-teal-500" />
								</span>
								{status}
							</span>
						) : (
							status
						))}
				</div>
				<div className="grid grid-cols-1 gap-5.5 sm:grid-cols-2 lg:grid-cols-4">
					{items.map((item, idx) => (
						<ItemCard key={item.itemKey} {...item} delay={idx * delayStep} />
					))}
				</div>
			</div>
		</motion.section>
	);
}
