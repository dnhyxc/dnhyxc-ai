import {
	flexRender,
	getCoreRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
} from '@tanstack/react-table';
import { Database, Globe, Globe2, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
	Badge,
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Spinner,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui';
import { formatDate } from '@/lib/utils';
import { knowledgeApi } from '@/service';
import type { Knowledge } from '@/types';

const KnowledgePage = () => {
	const [knowledge, setKnowledge] = useState<Knowledge[]>([]);
	const [search, setSearch] = useState('');
	const [sorting, setSorting] = useState<SortingState>([]);
	const [filterPublic, setFilterPublic] = useState('');
	const [loading, setLoading] = useState(true);

	const fetchKnowledge = async () => {
		setLoading(true);
		try {
			const res = await knowledgeApi.getList();
			const list = Array.isArray(res)
				? (res as Knowledge[])
				: (res as { list?: Knowledge[] })?.list || [];
			setKnowledge(list);
		} catch (e) {
			toast.error('加载知识库失败');
			setKnowledge([]);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchKnowledge();
	}, []);

	const filtered = useMemo(() => {
		let result = knowledge;
		if (search) {
			const s = search.toLowerCase();
			result = result.filter(
				(k) =>
					k.title.toLowerCase().includes(s) ||
					k.description?.toLowerCase().includes(s),
			);
		}
		if (filterPublic !== '') {
			const boolPub = filterPublic === 'public';
			result = result.filter((k) => k.isPublic === boolPub);
		}
		return result;
	}, [knowledge, search, filterPublic]);

	const columns = useMemo(
		() => [
			{
				accessorKey: 'id',
				header: 'ID',
				size: 120,
				cell: ({ row }: { row: { original: Knowledge } }) => (
					<code className="font-mono text-xs text-muted-foreground">
						{row.original.id}
					</code>
				),
			},
			{
				accessorKey: 'title',
				header: '知识库名',
				cell: ({ row }: { row: { original: Knowledge } }) => {
					const k = row.original;
					return (
						<div className="flex items-start gap-3">
							<div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400">
								<Database size={18} />
							</div>
							<div className="min-w-0">
								<div className="truncate font-medium">{k.title}</div>
								<div className="line-clamp-1 text-xs text-muted-foreground">
									{k.description || '暂无描述'}
								</div>
							</div>
						</div>
					);
				},
			},
			{
				accessorKey: 'description',
				header: '描述',
				size: 220,
				cell: ({ row }: { row: { original: Knowledge } }) => (
					<span className="line-clamp-1 text-sm text-muted-foreground">
						{row.original.description || '—'}
					</span>
				),
			},
			{
				accessorKey: 'docCount',
				header: '文档数',
				size: 90,
				cell: ({ row }: { row: { original: Knowledge } }) => (
					<Badge variant="secondary">{row.original.docCount ?? 0} 篇</Badge>
				),
			},
			{
				accessorKey: 'chunkCount',
				header: '切片数',
				size: 100,
				cell: ({ row }: { row: { original: Knowledge } }) => (
					<span className="text-sm text-muted-foreground">
						{row.original.chunkCount ?? 0}
					</span>
				),
			},
			{
				accessorKey: 'isPublic',
				header: '公开',
				size: 80,
				cell: ({ row }: { row: { original: Knowledge } }) => {
					const k = row.original;
					return (
						<span
							className={
								k.isPublic ? 'text-emerald-600' : 'text-muted-foreground'
							}
							title={k.isPublic ? '公开' : '私有'}
						>
							{k.isPublic ? <Globe2 size={16} /> : <Globe size={16} />}
						</span>
					);
				},
			},
			{
				accessorKey: 'updateTime',
				header: '更新时间',
				size: 160,
				cell: ({ row }: { row: { original: Knowledge } }) => (
					<span className="text-xs text-muted-foreground">
						{row.original.updateTime
							? formatDate(row.original.updateTime)
							: '—'}
					</span>
				),
			},
			{
				id: 'actions',
				header: '操作',
				size: 80,
				cell: ({ row }: { row: { original: Knowledge } }) => {
					const k = row.original;
					return (
						<Button
							variant="ghost"
							size="icon-sm"
							className="text-destructive hover:text-destructive"
							onClick={() => handleDelete(k)}
							title="删除"
						>
							<Trash2 size={14} />
						</Button>
					);
				},
			},
		],
		[],
	);

	const table = useReactTable({
		data: filtered,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		onSortingChange: setSorting,
		getSortedRowModel: getSortedRowModel(),
		state: { sorting },
		initialState: { pagination: { pageSize: 10 } },
	});

	const handleDelete = async (k: Knowledge) => {
		if (
			!window.confirm(`确定删除「${k.title}」？该库内所有文档和数据将被删除。`)
		)
			return;
		try {
			await knowledgeApi.delete(k.id);
			toast.success('删除成功');
			fetchKnowledge();
		} catch (e) {
			toast.error('删除失败');
		}
	};

	return (
		<div className="space-y-4">
			<Card className="border-0 shadow-sm">
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
					<div>
						<CardTitle className="text-base">知识库管理</CardTitle>
						<p className="mt-1 text-xs text-muted-foreground">
							共 {knowledge.length} 个知识库
						</p>
					</div>
				</CardHeader>
				<CardContent>
					<div className="mb-4 flex flex-wrap items-center gap-2">
						<div className="relative flex-1 max-w-sm">
							<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								placeholder="搜索知识库名或描述..."
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								className="pl-10"
							/>
						</div>
						<Select value={filterPublic} onValueChange={setFilterPublic}>
							<SelectTrigger className="w-28">
								<SelectValue placeholder="全部权限" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="">全部权限</SelectItem>
								<SelectItem value="public">仅公开</SelectItem>
								<SelectItem value="private">仅私有</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="rounded-md border overflow-hidden">
						<Table>
							<TableHeader>
								{table.getHeaderGroups().map((hg) => (
									<TableRow key={hg.id}>
										{hg.headers.map((h) => (
											<TableHead key={h.id} style={{ width: h.getSize() }}>
												{h.isPlaceholder
													? null
													: flexRender(
															h.column.columnDef.header,
															h.getContext(),
														)}
											</TableHead>
										))}
									</TableRow>
								))}
							</TableHeader>
							<TableBody>
								{loading ? (
									<TableRow>
										<TableCell
											colSpan={columns.length}
											className="h-24 text-center text-muted-foreground"
										>
											<div className="flex items-center justify-center gap-2">
												<Spinner className="size-4" />
												<span>加载中...</span>
											</div>
										</TableCell>
									</TableRow>
								) : table.getRowModel().rows.length ? (
									table.getRowModel().rows.map((row) => (
										<TableRow key={row.id}>
											{row.getVisibleCells().map((cell) => (
												<TableCell
													key={cell.id}
													style={{ width: cell.column.getSize() }}
												>
													{flexRender(
														cell.column.columnDef.cell,
														cell.getContext(),
													)}
												</TableCell>
											))}
										</TableRow>
									))
								) : (
									<TableRow>
										<TableCell
											colSpan={columns.length}
											className="h-24 text-center text-muted-foreground"
										>
											暂无数据
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</div>
				</CardContent>
			</Card>
		</div>
	);
};

export default KnowledgePage;
