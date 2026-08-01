import {
	flexRender,
	getCoreRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
} from '@tanstack/react-table';
import { Pencil, Plus, Search, ShieldCheck, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
	Badge,
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Checkbox,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Input,
	Label,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	Textarea,
} from '@/components/ui';
import { menuApi, roleApi } from '@/service';
import type { Menu, Role } from '@/types';

interface RoleFormData {
	name: string;
	description: string;
	menuIds: number[];
}

const emptyForm: RoleFormData = { name: '', description: '', menuIds: [] };

const RolesPage = () => {
	const [roles, setRoles] = useState<Role[]>([]);
	const [menus, setMenus] = useState<Menu[]>([]);
	const [loading, setLoading] = useState(false);
	const [search, setSearch] = useState('');
	const [sorting, setSorting] = useState<SortingState>([]);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [editingRole, setEditingRole] = useState<Role | null>(null);
	const [formData, setFormData] = useState<RoleFormData>(emptyForm);

	const fetchRoles = () => {
		setLoading(true);
		roleApi
			.getList()
			.then(setRoles)
			.catch((e) => console.error(e))
			.finally(() => setLoading(false));
	};

	useEffect(() => {
		fetchRoles();
		menuApi
			.getList()
			.then(setMenus)
			.catch((e) => console.error(e));
	}, []);

	const columns = useMemo(
		() => [
			{
				accessorKey: 'id',
				header: 'ID',
				size: 70,
				cell: ({ row }: { row: { original: Role } }) => (
					<span className="font-mono text-xs text-muted-foreground">
						#{row.original.id}
					</span>
				),
			},
			{
				accessorKey: 'name',
				header: '角色名称',
				cell: ({ row }: { row: { original: Role } }) => (
					<div className="flex items-center gap-2">
						<div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
							<ShieldCheck size={16} />
						</div>
						<div className="font-medium">{row.original.name}</div>
					</div>
				),
			},
			{
				accessorKey: 'description',
				header: '描述',
				cell: ({ row }: { row: { original: Role } }) => (
					<span className="text-sm text-muted-foreground">
						{row.original.description || '—'}
					</span>
				),
			},
			{
				id: 'menuCount',
				header: '关联菜单数',
				size: 110,
				cell: ({ row }: { row: { original: Role } }) => (
					<Badge variant="secondary">
						{row.original.menus?.length || 0} 个
					</Badge>
				),
			},
			{
				id: 'actions',
				header: '操作',
				size: 130,
				cell: ({ row }: { row: { original: Role } }) => {
					const r = row.original;
					return (
						<div className="flex gap-1">
							<Button
								variant="ghost"
								size="icon-sm"
								onClick={() => openEdit(r)}
								title="编辑"
							>
								<Pencil size={14} />
							</Button>
							<Button
								variant="ghost"
								size="icon-sm"
								className="text-destructive hover:text-destructive"
								onClick={() => handleDelete(r)}
								title="删除"
							>
								<Trash2 size={14} />
							</Button>
						</div>
					);
				},
			},
		],
		[roles],
	);

	const filteredRoles = useMemo(() => {
		if (!search) return roles;
		const s = search.toLowerCase();
		return roles.filter(
			(r) =>
				r.name.toLowerCase().includes(s) ||
				r.description?.toLowerCase().includes(s),
		);
	}, [roles, search]);

	const table = useReactTable({
		data: filteredRoles,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		onSortingChange: setSorting,
		getSortedRowModel: getSortedRowModel(),
		state: { sorting },
		initialState: { pagination: { pageSize: 10 } },
	});

	const openCreate = () => {
		setEditingRole(null);
		setFormData(emptyForm);
		setDialogOpen(true);
	};

	const openEdit = (role: Role) => {
		setEditingRole(role);
		setFormData({
			name: role.name,
			description: role.description || '',
			menuIds: role.menus?.map((m) => m.id) || [],
		});
		setDialogOpen(true);
	};

	const toggleMenu = (menuId: number) => {
		setFormData((prev) => ({
			...prev,
			menuIds: prev.menuIds.includes(menuId)
				? prev.menuIds.filter((id) => id !== menuId)
				: [...prev.menuIds, menuId],
		}));
	};

	const handleSubmit = async () => {
		if (!formData.name) {
			toast.warning('请填写角色名称');
			return;
		}
		setSubmitting(true);
		try {
			if (editingRole) {
				await roleApi.update({
					id: editingRole.id,
					name: formData.name,
					description: formData.description,
					menuIds: formData.menuIds,
				});
				toast.success('更新成功');
			} else {
				await roleApi.create({
					name: formData.name,
					description: formData.description,
					menuIds: formData.menuIds,
				});
				toast.success('创建成功');
			}
			setDialogOpen(false);
			fetchRoles();
		} catch (e) {
			console.error(e);
		} finally {
			setSubmitting(false);
		}
	};

	const handleDelete = async (role: Role) => {
		if (!window.confirm(`确定删除角色「${role.name}」吗？`)) return;
		try {
			await roleApi.delete(role.id);
			toast.success('删除成功');
			fetchRoles();
		} catch (e) {
			console.error(e);
		}
	};

	return (
		<div className="space-y-4">
			<Card className="border-0 shadow-sm">
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
					<div>
						<CardTitle className="text-base">角色与权限</CardTitle>
						<p className="mt-1 text-xs text-muted-foreground">
							共 {roles.length} 个角色
						</p>
					</div>
					<Button onClick={openCreate}>
						<Plus size={16} className="mr-2" />
						新建角色
					</Button>
					<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
						<DialogContent className="max-w-2xl">
							<DialogHeader>
								<DialogTitle>
									{editingRole ? '编辑角色' : '新建角色'}
								</DialogTitle>
								<DialogDescription>
									设置角色的基本信息和菜单权限
								</DialogDescription>
							</DialogHeader>
							<div className="max-h-[60vh] grid gap-4 overflow-y-auto py-4 pr-2">
								<div className="space-y-2">
									<Label>角色名称</Label>
									<Input
										value={formData.name}
										onChange={(e) =>
											setFormData({ ...formData, name: e.target.value })
										}
										placeholder="如：内容管理员"
									/>
								</div>
								<div className="space-y-2">
									<Label>角色描述</Label>
									<Textarea
										value={formData.description}
										onChange={(e) =>
											setFormData({ ...formData, description: e.target.value })
										}
										placeholder="简要描述该角色的职责和权限范围"
										rows={2}
									/>
								</div>
								<div className="space-y-3">
									<Label>菜单权限</Label>
									<div className="grid grid-cols-2 gap-2 rounded-lg border p-4">
										{menus.length === 0 && (
											<span className="text-sm text-muted-foreground">
												暂无菜单
											</span>
										)}
										{menus.map((menu) => {
											const checked = formData.menuIds.includes(menu.id);
											return (
												<label
													key={menu.id}
													className="flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-muted/50"
												>
													<Checkbox
														checked={checked}
														onCheckedChange={() => toggleMenu(menu.id)}
													/>
													<span className="text-sm">{menu.name}</span>
													<span className="ml-auto font-mono text-xs text-muted-foreground">
														{menu.path}
													</span>
												</label>
											);
										})}
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
						<div className="relative max-w-sm flex-1">
							<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								placeholder="搜索角色..."
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								className="pl-10"
							/>
						</div>
					</div>

					<div className="rounded-md border">
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
											加载中...
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

export default RolesPage;
