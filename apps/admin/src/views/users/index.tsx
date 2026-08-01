import {
	ChevronLeft,
	ChevronRight,
	ChevronsLeft,
	ChevronsRight,
	MoreHorizontal,
	Pencil,
	Plus,
	Search,
	Trash2,
} from 'lucide-react';
import { observer } from 'mobx-react';
import { type KeyboardEvent, useCallback, useEffect, useState } from 'react';
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
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	Input,
	Label,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui';
import { formatDate } from '@/lib/utils';
import { roleApi, userApi } from '@/service';
import type { CreateUserPayload, Role, UpdateUserPayload, User } from '@/types';

interface UserFormData {
	username: string;
	password: string;
	roles: number[];
}

const emptyForm: UserFormData = { username: '', password: '', roles: [] };

const UsersPage = observer(() => {
	const [users, setUsers] = useState<User[]>([]);
	const [total, setTotal] = useState(0);
	const [loading, setLoading] = useState(false);
	const [pageNo, setPageNo] = useState(1);
	const [pageSize] = useState(10);
	const [search, setSearch] = useState('');
	const [searchInput, setSearchInput] = useState('');
	const [roles, setRoles] = useState<Role[]>([]);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingUser, setEditingUser] = useState<User | null>(null);
	const [formData, setFormData] = useState<UserFormData>(emptyForm);
	const [submitting, setSubmitting] = useState(false);

	const fetchUsers = useCallback(async () => {
		setLoading(true);
		try {
			const res = await userApi.getList({
				pageNo,
				pageSize,
				username: search || undefined,
			});
			setUsers(res.list || []);
			setTotal(res.total || 0);
		} catch (e) {
			console.error(e);
		} finally {
			setLoading(false);
		}
	}, [pageNo, pageSize, search]);

	useEffect(() => {
		fetchUsers();
	}, [fetchUsers]);

	useEffect(() => {
		roleApi
			.getList()
			.then(setRoles)
			.catch((e) => console.error(e));
	}, []);

	const totalPages = Math.max(1, Math.ceil(total / pageSize));

	const openCreateDialog = () => {
		setEditingUser(null);
		setFormData(emptyForm);
		setDialogOpen(true);
	};

	const openEditDialog = (user: User) => {
		setEditingUser(user);
		setFormData({
			username: user.username,
			password: '',
			roles: user.roles?.map((r) => r.id) || [],
		});
		setDialogOpen(true);
	};

	const toggleRole = (roleId: number) => {
		setFormData((prev) => ({
			...prev,
			roles: prev.roles.includes(roleId)
				? prev.roles.filter((id) => id !== roleId)
				: [...prev.roles, roleId],
		}));
	};

	const handleSearch = () => {
		setPageNo(1);
		setSearch(searchInput);
	};

	const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter') handleSearch();
	};

	const handleSubmit = async () => {
		if (!formData.username || (!formData.password && !editingUser)) {
			toast.warning('请填写用户名和密码');
			return;
		}
		setSubmitting(true);
		try {
			if (editingUser) {
				const payload: UpdateUserPayload = {
					id: editingUser.id,
					username: formData.username,
					roles: formData.roles,
				};
				if (formData.password) payload.password = formData.password;
				await userApi.update(payload);
				toast.success('更新成功');
			} else {
				const payload: CreateUserPayload = {
					username: formData.username,
					password: formData.password,
					roles: formData.roles,
				};
				await userApi.create(payload);
				toast.success('创建成功');
			}
			setDialogOpen(false);
			fetchUsers();
		} catch (e) {
			console.error(e);
		} finally {
			setSubmitting(false);
		}
	};

	const handleDelete = async (user: User) => {
		if (!window.confirm(`确定删除用户「${user.username}」吗？`)) return;
		try {
			await userApi.delete(user.id);
			toast.success('删除成功');
			if (users.length === 1 && pageNo > 1) {
				setPageNo(pageNo - 1);
			} else {
				fetchUsers();
			}
		} catch (e) {
			console.error(e);
		}
	};

	const goToFirst = () => setPageNo(1);
	const goToPrev = () => setPageNo((p) => Math.max(1, p - 1));
	const goToNext = () => setPageNo((p) => Math.min(totalPages, p + 1));
	const goToLast = () => setPageNo(totalPages);

	return (
		<div className="space-y-4">
			<Card className="border-0 shadow-sm">
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
					<div>
						<CardTitle className="text-base">用户管理</CardTitle>
						<p className="mt-1 text-xs text-muted-foreground">
							共 {total} 位用户
						</p>
					</div>
					<Button onClick={openCreateDialog}>
						<Plus size={16} className="mr-2" />
						新建用户
					</Button>
					<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>
									{editingUser ? '编辑用户' : '新建用户'}
								</DialogTitle>
								<DialogDescription>
									{editingUser ? '修改用户信息' : '创建一个新的用户账号'}
								</DialogDescription>
							</DialogHeader>
							<div className="grid gap-4 py-4">
								<div className="space-y-2">
									<Label>用户名</Label>
									<Input
										value={formData.username}
										onChange={(e) =>
											setFormData({ ...formData, username: e.target.value })
										}
										placeholder="请输入用户名"
									/>
								</div>
								<div className="space-y-2">
									<Label>密码</Label>
									<Input
										type="password"
										value={formData.password}
										onChange={(e) =>
											setFormData({ ...formData, password: e.target.value })
										}
										placeholder={editingUser ? '留空不修改' : '请输入密码'}
									/>
								</div>
								<div className="space-y-2">
									<Label>角色</Label>
									<div className="grid grid-cols-2 gap-2 rounded-lg border p-4">
										{roles.length === 0 && (
											<span className="text-sm text-muted-foreground">
												暂无角色
											</span>
										)}
										{roles.map((role) => {
											const checked = formData.roles.includes(role.id);
											return (
												<label
													key={role.id}
													className="flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-muted/50"
												>
													<Checkbox
														checked={checked}
														onCheckedChange={() => toggleRole(role.id)}
													/>
													<span className="text-sm">{role.name}</span>
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
					{/* Search Bar */}
					<div className="mb-4 flex items-center gap-2">
						<div className="relative max-w-sm flex-1">
							<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								placeholder="搜索用户名..."
								value={searchInput}
								onChange={(e) => setSearchInput(e.target.value)}
								onKeyDown={handleSearchKeyDown}
								className="pl-10"
							/>
						</div>
						<Button variant="outline" onClick={handleSearch}>
							<Search size={16} className="mr-2" />
							搜索
						</Button>
					</div>

					{/* Table */}
					<div className="rounded-md border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="w-[70px]">ID</TableHead>
									<TableHead>用户名</TableHead>
									<TableHead>邮箱</TableHead>
									<TableHead>角色</TableHead>
									<TableHead>会员</TableHead>
									<TableHead>注册时间</TableHead>
									<TableHead className="w-[80px]">操作</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{loading ? (
									<TableRow>
										<TableCell
											colSpan={7}
											className="h-24 text-center text-muted-foreground"
										>
											加载中...
										</TableCell>
									</TableRow>
								) : users.length ? (
									users.map((u) => (
										<TableRow key={u.id}>
											<TableCell>
												<span className="font-mono text-xs text-muted-foreground">
													#{u.id}
												</span>
											</TableCell>
											<TableCell className="font-medium">
												{u.username}
											</TableCell>
											<TableCell className="text-muted-foreground">
												{u.email}
											</TableCell>
											<TableCell>
												{u.roles && u.roles.length > 0 ? (
													<div className="flex flex-wrap gap-1">
														{u.roles.map((r) => (
															<Badge key={r.id} variant="secondary">
																{r.name}
															</Badge>
														))}
													</div>
												) : (
													<span className="text-xs text-muted-foreground">
														—
													</span>
												)}
											</TableCell>
											<TableCell>
												{u.isMember ? (
													<Badge variant="success">
														{u.membershipType || '会员'}
													</Badge>
												) : (
													<Badge variant="secondary">免费</Badge>
												)}
											</TableCell>
											<TableCell>
												<span className="text-xs text-muted-foreground">
													{u.createTime ? formatDate(u.createTime) : '—'}
												</span>
											</TableCell>
											<TableCell>
												<DropdownMenu>
													<DropdownMenuTrigger asChild>
														<Button variant="ghost" size="icon-sm">
															<MoreHorizontal size={16} />
														</Button>
													</DropdownMenuTrigger>
													<DropdownMenuContent align="end" className="w-40">
														<DropdownMenuLabel>操作</DropdownMenuLabel>
														<DropdownMenuSeparator />
														<DropdownMenuItem onClick={() => openEditDialog(u)}>
															<Pencil size={14} className="mr-2" />
															编辑
														</DropdownMenuItem>
														<DropdownMenuItem
															onClick={() => handleDelete(u)}
															className="text-destructive"
														>
															<Trash2 size={14} className="mr-2" />
															删除
														</DropdownMenuItem>
													</DropdownMenuContent>
												</DropdownMenu>
											</TableCell>
										</TableRow>
									))
								) : (
									<TableRow>
										<TableCell
											colSpan={7}
											className="h-24 text-center text-muted-foreground"
										>
											暂无数据
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</div>

					{/* Pagination */}
					<div className="mt-4 flex items-center justify-between">
						<div className="text-sm text-muted-foreground">
							第 {pageNo} / {totalPages} 页，共 {total} 条
						</div>
						<div className="flex items-center gap-1">
							<Button
								variant="outline"
								size="icon-sm"
								onClick={goToFirst}
								disabled={pageNo <= 1}
							>
								<ChevronsLeft size={14} />
							</Button>
							<Button
								variant="outline"
								size="icon-sm"
								onClick={goToPrev}
								disabled={pageNo <= 1}
							>
								<ChevronLeft size={14} />
							</Button>
							<Button
								variant="outline"
								size="icon-sm"
								onClick={goToNext}
								disabled={pageNo >= totalPages}
							>
								<ChevronRight size={14} />
							</Button>
							<Button
								variant="outline"
								size="icon-sm"
								onClick={goToLast}
								disabled={pageNo >= totalPages}
							>
								<ChevronsRight size={14} />
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
});

export default UsersPage;
