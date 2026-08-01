import {
	flexRender,
	getCoreRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
} from '@tanstack/react-table';
import {
	BookOpenCheck,
	Globe,
	Globe2,
	Pencil,
	Search,
	Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Input,
	Label,
	Spinner,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui';
import { formatDate, formatFileSize } from '@/lib/utils';
import { ebookApi } from '@/service';
import type { Ebook } from '@/types';

const EbooksPage = () => {
	const [ebooks, setEbooks] = useState<Ebook[]>([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState('');
	const [sorting, setSorting] = useState<SortingState>([]);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [editing, setEditing] = useState<Ebook | null>(null);
	const [titleValue, setTitleValue] = useState('');

	const fetchEbooks = async () => {
		setLoading(true);
		try {
			const res = await ebookApi.getShelf();
			const list = Array.isArray(res)
				? (res as Ebook[])
				: (res as { list?: Ebook[] })?.list || [];
			setEbooks(list);
		} catch (e) {
			console.error(e);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchEbooks();
	}, []);

	const filtered = useMemo(() => {
		if (!search) return ebooks;
		const s = search.toLowerCase();
		return ebooks.filter(
			(e) =>
				e.title.toLowerCase().includes(s) ||
				e.author?.toLowerCase().includes(s),
		);
	}, [ebooks, search]);

	const columns = useMemo(
		() => [
			{
				accessorKey: 'id',
				header: 'ID',
				size: 120,
				cell: ({ row }: { row: { original: Ebook } }) => (
					<code
						className="block max-w-[100px] truncate text-xs text-muted-foreground"
						title={row.original.id}
					>
						{row.original.id}
					</code>
				),
			},
			{
				accessorKey: 'title',
				header: '书名',
				cell: ({ row }: { row: { original: Ebook } }) => (
					<div className="flex items-center gap-2">
						<div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
							<BookOpenCheck size={16} />
						</div>
						<span className="truncate font-medium">{row.original.title}</span>
					</div>
				),
			},
			{
				accessorKey: 'author',
				header: '作者',
				size: 140,
				cell: ({ row }: { row: { original: Ebook } }) => (
					<span className="text-sm text-muted-foreground">
						{row.original.author || '—'}
					</span>
				),
			},
			{
				accessorKey: 'totalChapters',
				header: '章节数',
				size: 80,
				cell: ({ row }: { row: { original: Ebook } }) => (
					<span className="text-sm text-muted-foreground">
						{row.original.totalChapters ?? 0}
					</span>
				),
			},
			{
				accessorKey: 'fileSize',
				header: '大小',
				size: 100,
				cell: ({ row }: { row: { original: Ebook } }) => (
					<span className="text-xs text-muted-foreground">
						{row.original.fileSize
							? formatFileSize(row.original.fileSize)
							: '—'}
					</span>
				),
			},
			{
				accessorKey: 'isPublic',
				header: '公开',
				size: 80,
				cell: ({ row }: { row: { original: Ebook } }) => {
					const e = row.original;
					const isPublic = !!e.isPublic;
					return (
						<Button
							variant="ghost"
							size="icon-sm"
							onClick={() => togglePublic(e)}
							className={
								isPublic ? 'text-emerald-600' : 'text-muted-foreground'
							}
							title={isPublic ? '公开' : '私有'}
						>
							{isPublic ? <Globe2 size={16} /> : <Globe size={16} />}
						</Button>
					);
				},
			},
			{
				accessorKey: 'createTime',
				header: '上传时间',
				size: 160,
				cell: ({ row }: { row: { original: Ebook } }) => (
					<span className="text-xs text-muted-foreground">
						{row.original.createTime
							? formatDate(row.original.createTime)
							: '—'}
					</span>
				),
			},
			{
				id: 'actions',
				header: '操作',
				size: 120,
				cell: ({ row }: { row: { original: Ebook } }) => {
					const e = row.original;
					return (
						<div className="flex gap-1">
							<Button
								variant="ghost"
								size="icon-sm"
								title="编辑标题"
								onClick={() => openEdit(e)}
							>
								<Pencil size={14} />
							</Button>
							<Button
								variant="ghost"
								size="icon-sm"
								title="删除"
								className="text-destructive hover:text-destructive"
								onClick={() => handleDelete(e)}
							>
								<Trash2 size={14} />
							</Button>
						</div>
					);
				},
			},
		],
		[ebooks],
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

	const openEdit = (ebook: Ebook) => {
		setEditing(ebook);
		setTitleValue(ebook.title);
		setDialogOpen(true);
	};

	const togglePublic = async (ebook: Ebook) => {
		try {
			await ebookApi.setVisibility(ebook.id, !ebook.isPublic);
			setEbooks((prev) =>
				prev.map((e) =>
					e.id === ebook.id ? { ...e, isPublic: !e.isPublic } : e,
				),
			);
			toast.success(`已${!ebook.isPublic ? '公开' : '设为私有'}`);
		} catch (e) {
			console.error(e);
		}
	};

	const handleDelete = async (ebook: Ebook) => {
		if (!window.confirm(`确定删除「${ebook.title}」吗？此操作不可恢复。`))
			return;
		try {
			await ebookApi.delete(ebook.id);
			toast.success('删除成功');
			await fetchEbooks();
		} catch (e) {
			console.error(e);
		}
	};

	const handleSubmit = async () => {
		if (!editing) return;
		if (!titleValue) {
			toast.warning('请填写书名');
			return;
		}
		setSubmitting(true);
		try {
			await ebookApi.updateTitle({ bookId: editing.id, title: titleValue });
			toast.success('更新成功');
			setDialogOpen(false);
			await fetchEbooks();
		} catch (e) {
			console.error(e);
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div className="space-y-4">
			<Card className="border-0 shadow-sm">
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
					<div>
						<CardTitle className="text-base">书籍管理</CardTitle>
						<p className="mt-1 text-xs text-muted-foreground">
							共 {ebooks.length} 本书籍
						</p>
					</div>
					<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>编辑书名</DialogTitle>
								<DialogDescription>修改书籍的标题</DialogDescription>
							</DialogHeader>
							<div className="grid gap-4 py-4">
								<div className="space-y-2">
									<Label>书名</Label>
									<Input
										value={titleValue}
										onChange={(e) => setTitleValue(e.target.value)}
									/>
								</div>
							</div>
							<DialogFooter>
								<Button variant="outline" onClick={() => setDialogOpen(false)}>
									取消
								</Button>
								<Button
									onClick={handleSubmit}
									variant={submitting ? 'loading' : 'default'}
									disabled={submitting}
								>
									{submitting ? '保存中...' : '保存'}
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>
				</CardHeader>
				<CardContent>
					<div className="mb-4 flex flex-wrap items-center gap-2">
						<div className="relative flex-1 max-w-sm">
							<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								placeholder="搜索书名、作者..."
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								className="pl-10"
							/>
						</div>
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
										<TableCell colSpan={columns.length} className="h-24">
											<div className="flex items-center justify-center">
												<Spinner className="size-5" />
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

					<div className="mt-4 flex items-center justify-between">
						<span className="text-sm text-muted-foreground">
							共 {filtered.length} 条，每页{' '}
							{table.getState().pagination.pageSize} 条
						</span>
					</div>
				</CardContent>
			</Card>
		</div>
	);
};

export default EbooksPage;
