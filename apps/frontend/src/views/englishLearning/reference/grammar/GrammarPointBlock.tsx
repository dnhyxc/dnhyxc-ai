import type { GrammarPoint } from './types';

type GrammarPointBlockProps = {
	point: GrammarPoint;
	depth?: number;
};

export function GrammarPointBlock({
	point,
	depth = 0,
}: GrammarPointBlockProps) {
	const pad = depth > 0 ? 'pl-3 border-l border-theme/15' : '';

	return (
		<div className={`space-y-2 ${pad}`}>
			{point.name ? (
				<div className="text-textcolor text-sm font-semibold">{point.name}</div>
			) : null}
			{point.description ? (
				<p className="text-textcolor/75 text-sm leading-relaxed">
					{point.description}
				</p>
			) : null}
			{point.rules?.length ? (
				<ul className="text-textcolor/80 list-disc space-y-1 pl-5 text-sm leading-relaxed">
					{point.rules.map((rule) => (
						<li key={rule}>{rule}</li>
					))}
				</ul>
			) : null}
			{point.examples?.length ? (
				<ul className="text-textcolor/70 list-disc space-y-0.5 pl-5 font-mono text-xs leading-relaxed">
					{point.examples.map((ex) => (
						<li key={ex}>{ex}</li>
					))}
				</ul>
			) : null}
			{point.subtypes?.map((sub) => (
				<GrammarPointBlock
					key={sub.name ?? sub.description}
					point={sub}
					depth={depth + 1}
				/>
			))}
		</div>
	);
}
