import { Button } from '@ui/button';
import { type FormEvent, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import '@/styles.css';

type Note = { id: string; text: string; at: number };

type HostBridgeProps = {
	api: {
		theme: 'light' | 'dark';
		ui?: {
			showToast: (options: {
				message: string;
				type?: 'success' | 'error' | 'info';
			}) => void;
		};
	};
	plugin: { id: string; version: string; routePath: string };
};

export default function LearningNotesApp({ api, plugin }: HostBridgeProps) {
	const [text, setText] = useState('');
	const [notes, setNotes] = useState<Note[]>(() => [
		{
			id: 'seed',
			text: '示例：今天复习了 present perfect 与过去时的区别',
			at: Date.now() - 60_000,
		},
	]);

	const sorted = useMemo(() => [...notes].sort((a, b) => b.at - a.at), [notes]);

	const onSubmit = (e: FormEvent) => {
		e.preventDefault();
		const next = text.trim();
		if (!next) return;
		setNotes((list) => [
			{ id: `${Date.now()}`, text: next, at: Date.now() },
			...list,
		]);
		setText('');
		api.ui?.showToast({ message: '已添加学习笔记' });
	};

	return (
		<div className={cn('text-textcolor min-h-full px-0.5 py-1 text-sm')}>
			<p className="text-textcolor/55 mb-3 text-xs">
				英语学习 · 学习笔记（{plugin.id}@{plugin.version}）
			</p>
			<form onSubmit={onSubmit} className="mb-4 flex flex-col gap-2">
				<textarea
					value={text}
					onChange={(e) => setText(e.target.value)}
					placeholder="记下今天的单词、语法或口语收获…"
					rows={3}
					className="border-theme-border bg-theme-background text-textcolor placeholder:text-textcolor/40 focus-visible:ring-theme/30 w-full resize-y rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2"
				/>
				<Button type="submit" size="sm" className="self-start">
					添加笔记
				</Button>
			</form>
			<div className="m-0 flex list-none flex-col gap-2.5 p-0">
				{sorted.map((n) => (
					<div
						key={n.id}
						className="border-theme-border bg-theme/5 rounded-md border px-3 py-2.5"
					>
						<div className="text-justify whitespace-pre-wrap">{n.text}</div>
						<div className="text-textcolor/45 mt-1.5 text-xs">
							{new Date(n.at).toLocaleString()}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

export async function activate() {
	// ponytail: 本地 demo 态，无远程拉取
}

export async function deactivate() {
	// ponytail: 无全局副作用
}
