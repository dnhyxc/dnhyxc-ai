import {
	flexRender,
	getCoreRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
} from '@tanstack/react-table';
import { MenuSquare, Pencil, Plus, Search, Trash2 } from 'lucide-react';
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
	DialogTrigger,
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
import { menuApi } from '@/service';
import type { Menu } from '@/types';

const MenusPage = () => {
	const [menus, setMenus] = useState<Menu[]>([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState('');
	const [sorting, setSorting] = useState<SortingState>([]);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [editing, setEditing] = useState<Menu | null>(null);
	const [formData, setFormData] = useState<{
		name: string;
		path: string;
		order: number;
		acl: string;
	}>({ name: '', path: '', order: 1, acl: '' });

	const fetchMenus = async () => {
		setLoading(true);
		try {
			const list = await menuApi.getList();
			setMenus(list);
		} catch (e) {
			console.error(e);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchMenus();
	}, []);

	const filtered = useMemo(() => {
		if (!search) return menus;
		const s = search.toLowerCase();
		return menus.filter(
			(m) =>
				m.name.toLowerCase().includes(s) || m.path.toLowerCase().includes(s),
		);
	}, [menus, search]);

	const columns = useMemo(
		() => [
			{
				accessorKey: 'id',
				header: 'ID',
				size: 70,
				cell: ({ row }: { row: { original: Menu } }) => (
					<span className="font-mono text-xs text-muted-foreground">
						#{row.original.id}
					</span>
				),
			},
			{
				accessorKey: 'name',
				header: '菜单名称',
				cell: ({ row }: { row: { original: Menu } }) => (
					<div className="flex items-center gap-2">
						<div className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
							<MenuSquare size={14} />
						</div>
						<span className="font-medium">{row.original.name}</span>
					</div>
				),
			},
			{
				accessorKey: 'path',
				header: '路径',
				size: 160,
				cell: ({ row }: { row: { original: Menu } }) => (
					<code className="rounded bg-muted px-2 py-0.5 text-xs">
						{row.original.path}
					</code>
				),
			},
			{
				accessorKey: 'order',
				header: '排序',
				size: 80,
				cell: ({ row }: { row: { original: Menu } }) => (
					<span className="text-sm text-muted-foreground">
						{row.original.order}
					</span>
				),
			},
			{
				accessorKey: 'acl',
				header: '权限标识',
				size: 160,
				cell: ({ row }: { row: { original: Menu } }) => {
					const acl = row.original.acl;
					return acl ? (
						<code className="text-xs text-muted-foreground">{acl}</code>
					) : (
						<span className="text-xs text-muted-foreground">—</span>
					);
				},
			},
			{
				id: 'actions',
				header: '操作',
				size: 120,
				cell: ({ row }: { row: { original: Menu } }) => {
					const m = row.original;
					return (
						<div className="flex gap-1">
							<Button
								variant="ghost"
								size="icon-sm"
								onClick={() => openEdit(m)}
								title="编辑"
							>
								<Pencil size={14} />
							</Button>
							<Button
								variant="ghost"
								size="icon-sm"
								className="text-destructive hover:text-destructive"
								onClick={() => handleDelete(m)}
								title="删除"
							>
								<Trash2 size={14} />
							</Button>
						</div>
					);
				},
			},
		],
		[menus],
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

	const openEdit = (menu?: Menu) => {
		setEditing(menu || null);
		setFormData(
			menu
				? {
						name: menu.name,
						path: menu.path,
						order: menu.order,
						acl: menu.acl || '',
					}
				: { name: '', path: '', order: 1, acl: '' },
		);
		setDialogOpen(true);
	};

	const handleSubmit = async () => {
		if (!formData.name) {
			toast.warning('请填写菜单名称');
			return;
		}
		if (!formData.path) {
			toast.warning('请填写路径');
			return;
		}
		setSubmitting(true);
		try {
			const payload = {
				name: formData.name,
				path: formData.path,
				order: formData.order,
				acl: formData.acl || undefined,
			};
			if (editing) {
				await menuApi.update(editing.id, payload);
				toast.success('更新成功');
			} else {
				await menuApi.create(payload);
				toast.success('创建成功');
			}
			setDialogOpen(false);
			await fetchMenus();
		} catch (e) {
			console.error(e);
		} finally {
			setSubmitting(false);
		}
	};

	const handleDelete = async (menu: Menu) => {
		if (!window.confirm(`确定删除菜单「${menu.name}」吗？`)) return;
		try {
			await menuApi.delete(menu.id);
			toast.success('删除成功');
			await fetchMenus();
		} catch (e) {
			console.error(e);
		}
	};

	return (
		<div className="space-y-4">
			<Card className="border-0 shadow-sm">
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
					<div>
						<CardTitle className="text-base">菜单管理</CardTitle>
						<p className="mt-1 text-xs text-muted-foreground">
							共 {menus.length} 个菜单项
						</p>
					</div>
					<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
						<DialogTrigger asChild>
							<Button onClick={() => openEdit()}>
								<Plus size={16} className="mr-2" />
								新增菜单
							</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>{editing ? '编辑菜单' : '新增菜单'}</DialogTitle>
								<DialogDescription>配置菜单项的显示和路由</DialogDescription>
							</DialogHeader>
							<div className="grid gap-4 py-4">
								<div className="space-y-2">
									<Label>菜单名称</Label>
									<Input
										value={formData.name}
										onChange={(e) =>
											setFormData({ ...formData, name: e.target.value })
										}
										placeholder="如：用户管理"
									/>
								</div>
								<div className="space-y-2">
									<Label>路由路径</Label>
									<Input
										value={formData.path}
										onChange={(e) =>
											setFormData({ ...formData, path: e.target.value })
										}
										placeholder="如：/users"
									/>
								</div>
								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label>排序</Label>
										<Input
											type="number"
											min={1}
											value={formData.order}
											onChange={(e) =>
												setFormData({
													...formData,
													order: Number(e.target.value),
												})
											}
										/>
									</div>
									<div className="space-y-2">
										<Label>权限标识 (可选)</Label>
										<Input
											value={formData.acl}
											onChange={(e) =>
												setFormData({ ...formData, acl: e.target.value })
											}
											placeholder="如：menu:view"
										/>
									</div>
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
					<div className="mb-4 flex items-center gap-2">
						<div className="relative flex-1 max-w-sm">
							<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								placeholder="搜索菜单名称、路径..."
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

export default MenusPage;
