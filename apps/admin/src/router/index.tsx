import { observer } from 'mobx-react';
import { type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import AdminLayout from '@/layout';
import { authStore } from '@/store';
import ChatsPage from '@/views/chats';
import DashboardPage from '@/views/dashboard';
import EbooksPage from '@/views/ebooks';
import KnowledgePage from '@/views/knowledge';
import LoginPage from '@/views/login';
import LogsPage from '@/views/logs';
import MembershipPage from '@/views/membership';
import MenusPage from '@/views/menus';
import RolesPage from '@/views/roles';
import UsersPage from '@/views/users';

function RequireAuth({ children }: { children: ReactNode }) {
	// if (!authStore.isLoggedIn) {
	// 	return <Navigate to="/login" replace />;
	// }
	return children;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
	if (!authStore.isAdmin) {
		return <Navigate to="/dashboard" replace />;
	}
	return <>{children}</>;
}

const AppRouter = observer(() => {
	return (
		<Routes>
			<Route path="/login" element={<LoginPage />} />
			<Route
				path="/"
				element={
					<RequireAuth>
						<AdminLayout />
					</RequireAuth>
				}
			>
				<Route index element={<Navigate to="/dashboard" replace />} />
				<Route path="dashboard" element={<DashboardPage />} />
				<Route
					path="users"
					element={
						<RequireAdmin>
							<UsersPage />
						</RequireAdmin>
					}
				/>
				<Route
					path="roles"
					element={
						<RequireAdmin>
							<RolesPage />
						</RequireAdmin>
					}
				/>
				<Route
					path="menus"
					element={
						<RequireAdmin>
							<MenusPage />
						</RequireAdmin>
					}
				/>
				<Route
					path="ebooks"
					element={
						<RequireAdmin>
							<EbooksPage />
						</RequireAdmin>
					}
				/>
				<Route
					path="chats"
					element={
						<RequireAdmin>
							<ChatsPage />
						</RequireAdmin>
					}
				/>
				<Route
					path="knowledge"
					element={
						<RequireAdmin>
							<KnowledgePage />
						</RequireAdmin>
					}
				/>
				<Route
					path="logs"
					element={
						<RequireAdmin>
							<LogsPage />
						</RequireAdmin>
					}
				/>
				<Route
					path="membership"
					element={
						<RequireAdmin>
							<MembershipPage />
						</RequireAdmin>
					}
				/>
			</Route>
			<Route path="*" element={<Navigate to="/dashboard" replace />} />
		</Routes>
	);
});

export default AppRouter;
