import { Route, Routes } from "react-router-dom";
import FirstTimeAdminSetup from "./components/FirstTimeAdminSetup";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import SettingsLayout from "./components/SettingsLayout";
import { isAuthPhase } from "./constants/authPhases";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { UpdateNotificationProvider } from "./contexts/UpdateNotificationContext";
import Dashboard from "./pages/Dashboard";
import HostDetail from "./pages/HostDetail";
import Hosts from "./pages/Hosts";
import Login from "./pages/Login";
import PackageDetail from "./pages/PackageDetail";
import Packages from "./pages/Packages";
import Profile from "./pages/Profile";
import Repositories from "./pages/Repositories";
import RepositoryDetail from "./pages/RepositoryDetail";
import AlertChannels from "./pages/settings/AlertChannels";
import Integrations from "./pages/settings/Integrations";
import Notifications from "./pages/settings/Notifications";
import PatchManagement from "./pages/settings/PatchManagement";
import SettingsAgentConfig from "./pages/settings/SettingsAgentConfig";
import SettingsHostGroups from "./pages/settings/SettingsHostGroups";
import SettingsServerConfig from "./pages/settings/SettingsServerConfig";
import SettingsUsers from "./pages/settings/SettingsUsers";

function AppRoutes() {
	const { needsFirstTimeSetup, authPhase, isAuthenticated } = useAuth();
	const isAuth = isAuthenticated(); // Call the function to get boolean value

	// Show loading while checking setup or initialising
	if (
		isAuthPhase.initialising(authPhase) ||
		isAuthPhase.checkingSetup(authPhase)
	) {
		return (
			<div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-secondary-900 dark:to-secondary-800 flex items-center justify-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
					<p className="text-secondary-600 dark:text-secondary-300">
						Checking system status...
					</p>
				</div>
			</div>
		);
	}

	// Show first-time setup if no admin users exist
	if (needsFirstTimeSetup && !isAuth) {
		return <FirstTimeAdminSetup />;
	}

	return (
		<Routes>
			<Route path="/login" element={<Login />} />
			<Route
				path="/"
				element={
					<ProtectedRoute requirePermission="can_view_dashboard">
						<Layout>
							<Dashboard />
						</Layout>
					</ProtectedRoute>
				}
			/>
			<Route
				path="/hosts"
				element={
					<ProtectedRoute requirePermission="can_view_hosts">
						<Layout>
							<Hosts />
						</Layout>
					</ProtectedRoute>
				}
			/>
			<Route
				path="/hosts/:hostId"
				element={
					<ProtectedRoute requirePermission="can_view_hosts">
						<Layout>
							<HostDetail />
						</Layout>
					</ProtectedRoute>
				}
			/>
			<Route
				path="/packages"
				element={
					<ProtectedRoute requirePermission="can_view_packages">
						<Layout>
							<Packages />
						</Layout>
					</ProtectedRoute>
				}
			/>
			<Route
				path="/repositories"
				element={
					<ProtectedRoute requirePermission="can_view_hosts">
						<Layout>
							<Repositories />
						</Layout>
					</ProtectedRoute>
				}
			/>
			<Route
				path="/repositories/:repositoryId"
				element={
					<ProtectedRoute requirePermission="can_view_hosts">
						<Layout>
							<RepositoryDetail />
						</Layout>
					</ProtectedRoute>
				}
			/>
			<Route
				path="/users"
				element={
					<ProtectedRoute requirePermission="can_view_users">
						<Layout>
							<SettingsUsers />
						</Layout>
					</ProtectedRoute>
				}
			/>
			<Route
				path="/permissions"
				element={
					<ProtectedRoute requirePermission="can_manage_settings">
						<Layout>
							<SettingsUsers />
						</Layout>
					</ProtectedRoute>
				}
			/>
			<Route
				path="/settings"
				element={
					<ProtectedRoute requirePermission="can_manage_settings">
						<Layout>
							<SettingsServerConfig />
						</Layout>
					</ProtectedRoute>
				}
			/>
			<Route
				path="/settings/users"
				element={
					<ProtectedRoute requirePermission="can_view_users">
						<Layout>
							<SettingsUsers />
						</Layout>
					</ProtectedRoute>
				}
			/>
			<Route
				path="/settings/roles"
				element={
					<ProtectedRoute requirePermission="can_manage_settings">
						<Layout>
							<SettingsUsers />
						</Layout>
					</ProtectedRoute>
				}
			/>
			<Route
				path="/settings/profile"
				element={
					<ProtectedRoute>
						<Layout>
							<SettingsLayout>
								<Profile />
							</SettingsLayout>
						</Layout>
					</ProtectedRoute>
				}
			/>
			<Route
				path="/settings/host-groups"
				element={
					<ProtectedRoute requirePermission="can_manage_settings">
						<Layout>
							<SettingsHostGroups />
						</Layout>
					</ProtectedRoute>
				}
			/>
			<Route
				path="/settings/notifications"
				element={
					<ProtectedRoute requirePermission="can_manage_settings">
						<Layout>
							<SettingsLayout>
								<Notifications />
							</SettingsLayout>
						</Layout>
					</ProtectedRoute>
				}
			/>
			<Route
				path="/settings/agent-config"
				element={
					<ProtectedRoute requirePermission="can_manage_settings">
						<Layout>
							<SettingsAgentConfig />
						</Layout>
					</ProtectedRoute>
				}
			/>
			<Route
				path="/settings/agent-config/management"
				element={
					<ProtectedRoute requirePermission="can_manage_settings">
						<Layout>
							<SettingsAgentConfig />
						</Layout>
					</ProtectedRoute>
				}
			/>
			<Route
				path="/settings/server-config"
				element={
					<ProtectedRoute requirePermission="can_manage_settings">
						<Layout>
							<SettingsServerConfig />
						</Layout>
					</ProtectedRoute>
				}
			/>
			<Route
				path="/settings/server-config/version"
				element={
					<ProtectedRoute requirePermission="can_manage_settings">
						<Layout>
							<SettingsServerConfig />
						</Layout>
					</ProtectedRoute>
				}
			/>
			<Route
				path="/settings/alert-channels"
				element={
					<ProtectedRoute requirePermission="can_manage_settings">
						<Layout>
							<SettingsLayout>
								<AlertChannels />
							</SettingsLayout>
						</Layout>
					</ProtectedRoute>
				}
			/>
			<Route
				path="/settings/integrations"
				element={
					<ProtectedRoute requirePermission="can_manage_settings">
						<Layout>
							<Integrations />
						</Layout>
					</ProtectedRoute>
				}
			/>
			<Route
				path="/settings/patch-management"
				element={
					<ProtectedRoute requirePermission="can_manage_settings">
						<Layout>
							<PatchManagement />
						</Layout>
					</ProtectedRoute>
				}
			/>
			<Route
				path="/settings/server-url"
				element={
					<ProtectedRoute requirePermission="can_manage_settings">
						<Layout>
							<SettingsServerConfig />
						</Layout>
					</ProtectedRoute>
				}
			/>
			<Route
				path="/settings/server-version"
				element={
					<ProtectedRoute requirePermission="can_manage_settings">
						<Layout>
							<SettingsServerConfig />
						</Layout>
					</ProtectedRoute>
				}
			/>
			<Route
				path="/settings/agent-version"
				element={
					<ProtectedRoute requirePermission="can_manage_settings">
						<Layout>
							<SettingsAgentConfig />
						</Layout>
					</ProtectedRoute>
				}
			/>
			<Route
				path="/options"
				element={
					<ProtectedRoute requirePermission="can_manage_hosts">
						<Layout>
							<SettingsHostGroups />
						</Layout>
					</ProtectedRoute>
				}
			/>
			<Route
				path="/packages/:packageId"
				element={
					<ProtectedRoute requirePermission="can_view_packages">
						<Layout>
							<PackageDetail />
						</Layout>
					</ProtectedRoute>
				}
			/>
		</Routes>
	);
}

function App() {
	return (
		<ThemeProvider>
			<AuthProvider>
				<UpdateNotificationProvider>
					<AppRoutes />
				</UpdateNotificationProvider>
			</AuthProvider>
		</ThemeProvider>
	);
}

export default App;
