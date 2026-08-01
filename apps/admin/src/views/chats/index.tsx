import {
	flexRender,
	getCoreRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
} from '@tanstack/react-table';
import { MessageSquareText, Search, Trash2 } from 'lucide-react';
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
	Spinner,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui';
import { formatDate } from '@/lib/utils';
import { chatApi } from '@/service';
import type { ChatSession } from '@/types';

const ChatsPage = () => {
	const [chats, setChats] = useState<ChatSession[]>([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState('');
	const [sorting, setSorting] = useState<SortingState>([]);

	const fetchChats = async () => {
		setLoading(true);
		try {
			const res = await chatApi.getSessionList({ pageNo: 1, pageSize: 50 });
			const list = Array.isArray(res)
				? (res as ChatSession[])
				: (res as { list?: ChatSession[] })?.list || [];
			setChats(list);
		} catch (e) {
			console.error(e);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchChats();
	}, []);

	const filtered = useMemo(() => {
		if (!search) return chats;
		const s = search.toLowerCase();
		return chats.filter((c) => c.title.toLowerCase().includes(s));
	}, [chats, search]);

	const columns = useMemo(
		() => [
			{
				accessorKey: 'id',
				header: 'ID',
				size: 120,
				cell: ({ row }: { row: { original: ChatSession } }) => (
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
				header: '会话标题',
				cell: ({ row }: { row: { original: ChatSession } }) => (
					<div className="flex items-center gap-2">
						<div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
							<MessageSquareText size={16} />
						</div>
						<span className="truncate font-medium">{row.original.title}</span>
					</div>
				),
			},
			{
				accessorKey: 'type',
				header: '类型',
				size: 100,
				cell: ({ row }: { row: { original: ChatSession } }) => {
					const type = row.original.type;
					return type ? (
						<Badge variant="secondary">{type}</Badge>
					) : (
						<span className="text-xs text-muted-foreground">—</span>
					);
				},
			},
			{
				accessorKey: 'messageCount',
				header: '消息数',
				size: 80,
				cell: ({ row }: { row: { original: ChatSession } }) => (
					<span className="text-sm text-muted-foreground">
						{row.original.messageCount ?? 0}
					</span>
				),
			},
			{
				accessorKey: 'lastMessageAt',
				header: '最后消息',
				size: 160,
				cell: ({ row }: { row: { original: ChatSession } }) => (
					<span className="text-xs text-muted-foreground">
						{row.original.lastMessageAt
							? formatDate(row.original.lastMessageAt)
							: '—'}
					</span>
				),
			},
			{
				accessorKey: 'createTime',
				header: '创建时间',
				size: 160,
				cell: ({ row }: { row: { original: ChatSession } }) => (
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
				size: 80,
				cell: ({ row }: { row: { original: ChatSession } }) => {
					const c = row.original;
					return (
						<Button
							variant="ghost"
							size="icon-sm"
							className="text-destructive hover:text-destructive"
							onClick={() => handleDelete(c)}
							title="删除会话"
						>
							<Trash2 size={14} />
						</Button>
					);
				},
			},
		],
		[chats],
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

	const handleDelete = async (chat: ChatSession) => {
		if (!window.confirm(`确定删除会话「${chat.title}」？`)) return;
		try {
			await chatApi.deleteSession(chat.id);
			toast.success('删除成功');
			await fetchChats();
		} catch (e) {
			console.error(e);
		}
	};

	return (
		<div className="space-y-4">
			<Card className="border-0 shadow-sm">
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
					<div>
						<CardTitle className="text-base">对话管理</CardTitle>
						<p className="mt-1 text-xs text-muted-foreground">
							共 {chats.length} 个会话
						</p>
					</div>
				</CardHeader>
				<CardContent>
					<div className="mb-4 flex flex-wrap items-center gap-2">
						<div className="relative flex-1 max-w-sm">
							<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								placeholder="搜索会话标题..."
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
				</CardContent>
			</Card>
		</div>
	);
};

export default ChatsPage;
