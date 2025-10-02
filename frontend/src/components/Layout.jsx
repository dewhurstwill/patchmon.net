import { useQuery } from "@tanstack/react-query";
import {
	Activity,
	BarChart3,
	ChevronLeft,
	ChevronRight,
	Clock,
	Container,
	GitBranch,
	Github,
	Globe,
	Home,
	LogOut,
	Mail,
	Menu,
	MessageCircle,
	Package,
	Plus,
	RefreshCw,
	Server,
	Settings,
	Shield,
	Star,
	UserCircle,
	X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useUpdateNotification } from "../contexts/UpdateNotificationContext";
import { dashboardAPI, versionAPI } from "../utils/api";
import UpgradeNotificationIcon from "./UpgradeNotificationIcon";

const Layout = ({ children }) => {
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
		// Load sidebar state from localStorage, default to false
		const saved = localStorage.getItem("sidebarCollapsed");
		return saved ? JSON.parse(saved) : false;
	});
	const [_userMenuOpen, setUserMenuOpen] = useState(false);
	const [githubStars, setGithubStars] = useState(null);
	const location = useLocation();
	const navigate = useNavigate();
	const {
		user,
		logout,
		canViewDashboard,
		canViewHosts,
		canManageHosts,
		canViewPackages,
		canViewUsers,
		canManageUsers,
		canViewReports,
		canExportData,
		canManageSettings,
	} = useAuth();
	const { updateAvailable } = useUpdateNotification();
	const userMenuRef = useRef(null);

	// Fetch dashboard stats for the "Last updated" info
	const {
		data: stats,
		refetch,
		isFetching,
	} = useQuery({
		queryKey: ["dashboardStats"],
		queryFn: () => dashboardAPI.getStats().then((res) => res.data),
		staleTime: 5 * 60 * 1000, // Data stays fresh for 5 minutes
		refetchOnWindowFocus: false, // Don't refetch when window regains focus
	});

	// Fetch version info
	const { data: versionInfo } = useQuery({
		queryKey: ["versionInfo"],
		queryFn: () => versionAPI.getCurrent().then((res) => res.data),
		staleTime: 300000, // Consider data stale after 5 minutes
	});

	// Build navigation based on permissions
	const buildNavigation = () => {
		const nav = [];

		// Dashboard - only show if user can view dashboard
		if (canViewDashboard()) {
			nav.push({ name: "Dashboard", href: "/", icon: Home });
		}

		// Inventory section - only show if user has any inventory permissions
		if (canViewHosts() || canViewPackages() || canViewReports()) {
			const inventoryItems = [];

			if (canViewHosts()) {
				inventoryItems.push({ name: "Hosts", href: "/hosts", icon: Server });
				inventoryItems.push({
					name: "Repos",
					href: "/repositories",
					icon: GitBranch,
				});
			}

			if (canViewPackages()) {
				inventoryItems.push({
					name: "Packages",
					href: "/packages",
					icon: Package,
				});
			}

			if (canViewReports()) {
				inventoryItems.push(
					{
						name: "Services",
						href: "/services",
						icon: Activity,
						comingSoon: true,
					},
					{
						name: "Docker",
						href: "/docker",
						icon: Container,
						comingSoon: true,
					},
					{
						name: "Reporting",
						href: "/reporting",
						icon: BarChart3,
						comingSoon: true,
					},
				);
			}

			if (inventoryItems.length > 0) {
				nav.push({
					section: "Inventory",
					items: inventoryItems,
				});
			}
		}

		return nav;
	};

	// Build settings navigation separately (for bottom placement)
	const buildSettingsNavigation = () => {
		const settingsNav = [];

		// Settings section - consolidated all settings into one page
		if (
			canManageSettings() ||
			canViewUsers() ||
			canManageUsers() ||
			canViewReports() ||
			canExportData()
		) {
			const settingsItems = [];

			settingsItems.push({
				name: "Settings",
				href: "/settings/users",
				icon: Settings,
				showUpgradeIcon: updateAvailable,
			});

			settingsNav.push({
				section: "Settings",
				items: settingsItems,
			});
		}

		return settingsNav;
	};

	const navigation = buildNavigation();
	const settingsNavigation = buildSettingsNavigation();

	const isActive = (path) => location.pathname === path;

	// Get page title based on current route
	const getPageTitle = () => {
		const path = location.pathname;

		if (path === "/") return "Dashboard";
		if (path === "/hosts") return "Hosts";
		if (path === "/packages") return "Packages";
		if (path === "/repositories" || path.startsWith("/repositories/"))
			return "Repositories";
		if (path === "/services") return "Services";
		if (path === "/docker") return "Docker";
		if (path === "/users") return "Users";
		if (path === "/permissions") return "Permissions";
		if (path === "/settings") return "Settings";
		if (path === "/options") return "PatchMon Options";
		if (path === "/audit-log") return "Audit Log";
		if (path === "/settings/profile") return "My Profile";
		if (path.startsWith("/hosts/")) return "Host Details";
		if (path.startsWith("/packages/")) return "Package Details";
		if (path.startsWith("/settings/")) return "Settings";

		return "PatchMon";
	};

	const handleLogout = async () => {
		await logout();
		setUserMenuOpen(false);
	};

	const handleAddHost = () => {
		// Navigate to hosts page with add modal parameter
		navigate("/hosts?action=add");
	};

	// Fetch GitHub stars count
	const fetchGitHubStars = useCallback(async () => {
		// Skip if already fetched recently
		const lastFetch = localStorage.getItem("githubStarsFetchTime");
		const now = Date.now();
		if (lastFetch && now - parseInt(lastFetch, 15) < 600000) {
			// 15 minute cache
			return;
		}

		try {
			const response = await fetch(
				"https://api.github.com/repos/9technologygroup/patchmon.net",
			);
			if (response.ok) {
				const data = await response.json();
				setGithubStars(data.stargazers_count);
				localStorage.setItem("githubStarsFetchTime", now.toString());
			}
		} catch (error) {
			console.error("Failed to fetch GitHub stars:", error);
		}
	}, []);

	// Short format for navigation area
	const formatRelativeTimeShort = (date) => {
		if (!date) return "Never";

		const now = new Date();
		const dateObj = new Date(date);

		// Check if date is valid
		if (Number.isNaN(dateObj.getTime())) return "Invalid date";

		const diff = now - dateObj;
		const seconds = Math.floor(diff / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (days > 0) return `${days}d ago`;
		if (hours > 0) return `${hours}h ago`;
		if (minutes > 0) return `${minutes}m ago`;
		return `${seconds}s ago`;
	};

	// Save sidebar collapsed state to localStorage
	useEffect(() => {
		localStorage.setItem("sidebarCollapsed", JSON.stringify(sidebarCollapsed));
	}, [sidebarCollapsed]);

	// Close user menu when clicking outside
	useEffect(() => {
		const handleClickOutside = (event) => {
			if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
				setUserMenuOpen(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, []);

	// Fetch GitHub stars on component mount
	useEffect(() => {
		fetchGitHubStars();
	}, [fetchGitHubStars]);

	return (
		<div className="min-h-screen bg-secondary-50">
			{/* Mobile sidebar */}
			<div
				className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? "block" : "hidden"}`}
			>
				<button
					type="button"
					className="fixed inset-0 bg-secondary-600 bg-opacity-75 cursor-default"
					onClick={() => setSidebarOpen(false)}
					aria-label="Close sidebar"
				/>
				<div className="relative flex w-full max-w-xs flex-col bg-white pb-4 pt-5 shadow-xl">
					<div className="absolute right-0 top-0 -mr-12 pt-2">
						<button
							type="button"
							className="ml-1 flex h-10 w-10 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
							onClick={() => setSidebarOpen(false)}
						>
							<X className="h-6 w-6 text-white" />
						</button>
					</div>
					<div className="flex flex-shrink-0 items-center px-4">
						<div className="flex items-center">
							<Shield className="h-8 w-8 text-primary-600" />
							<h1 className="ml-2 text-xl font-bold text-secondary-900 dark:text-white">
								PatchMon
							</h1>
						</div>
					</div>
					<nav className="mt-8 flex-1 space-y-6 px-2">
						{/* Show message for users with very limited permissions */}
						{navigation.length === 0 && settingsNavigation.length === 0 && (
							<div className="px-2 py-4 text-center">
								<div className="text-sm text-secondary-500 dark:text-secondary-400">
									<p className="mb-2">Limited access</p>
									<p className="text-xs">
										Contact your administrator for additional permissions
									</p>
								</div>
							</div>
						)}
						{navigation.map((item) => {
							if (item.name) {
								// Single item (Dashboard)
								return (
									<Link
										key={item.name}
										to={item.href}
										className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
											isActive(item.href)
												? "bg-primary-100 text-primary-900"
												: "text-secondary-600 hover:bg-secondary-50 hover:text-secondary-900"
										}`}
										onClick={() => setSidebarOpen(false)}
									>
										<item.icon className="mr-3 h-5 w-5" />
										{item.name}
									</Link>
								);
							} else if (item.section) {
								// Section with items
								return (
									<div key={item.section}>
										<h3 className="text-xs font-semibold text-secondary-500 uppercase tracking-wider mb-2 px-2">
											{item.section}
										</h3>
										<div className="space-y-1">
											{item.items.map((subItem) => (
												<div key={subItem.name}>
													{subItem.name === "Hosts" && canManageHosts() ? (
														// Special handling for Hosts item with integrated + button (mobile)
														<Link
															to={subItem.href}
															className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
																isActive(subItem.href)
																	? "bg-primary-100 text-primary-900"
																	: "text-secondary-600 hover:bg-secondary-50 hover:text-secondary-900"
															}`}
															onClick={() => setSidebarOpen(false)}
														>
															<subItem.icon className="mr-3 h-5 w-5" />
															<span className="flex items-center gap-2 flex-1">
																{subItem.name}
																{subItem.name === "Hosts" &&
																	stats?.cards?.totalHosts !== undefined && (
																		<span className="ml-2 inline-flex items-center justify-center px-1.5 py-0.5 text-xs rounded bg-secondary-100 text-secondary-700">
																			{stats.cards.totalHosts}
																		</span>
																	)}
															</span>
															<button
																type="button"
																onClick={(e) => {
																	e.preventDefault();
																	setSidebarOpen(false);
																	handleAddHost();
																}}
																className="ml-auto flex items-center justify-center w-5 h-5 rounded-full border-2 border-current opacity-60 hover:opacity-100 transition-all duration-200 self-center"
																title="Add Host"
															>
																<Plus className="h-3 w-3" />
															</button>
														</Link>
													) : (
														// Standard navigation item (mobile)
														<Link
															to={subItem.href}
															className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
																isActive(subItem.href)
																	? "bg-primary-100 text-primary-900"
																	: "text-secondary-600 hover:bg-secondary-50 hover:text-secondary-900"
															} ${subItem.comingSoon ? "opacity-50 cursor-not-allowed" : ""}`}
															onClick={
																subItem.comingSoon
																	? (e) => e.preventDefault()
																	: () => setSidebarOpen(false)
															}
														>
															<subItem.icon className="mr-3 h-5 w-5" />
															<span className="flex items-center gap-2">
																{subItem.name}
																{subItem.name === "Hosts" &&
																	stats?.cards?.totalHosts !== undefined && (
																		<span className="ml-2 inline-flex items-center justify-center px-1.5 py-0.5 text-xs rounded bg-secondary-100 text-secondary-700">
																			{stats.cards.totalHosts}
																		</span>
																	)}
																{subItem.comingSoon && (
																	<span className="text-xs bg-secondary-100 text-secondary-600 px-1.5 py-0.5 rounded">
																		Soon
																	</span>
																)}
															</span>
														</Link>
													)}
												</div>
											))}
										</div>
									</div>
								);
							}
							return null;
						})}

						{/* Settings Section - Mobile */}
						{settingsNavigation.map((item) => {
							if (item.section) {
								// Settings section (no heading)
								return (
									<div key={item.section}>
										<div className="space-y-1">
											{item.items.map((subItem) => (
												<Link
													key={subItem.name}
													to={subItem.href}
													className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
														isActive(subItem.href)
															? "bg-primary-100 text-primary-900"
															: "text-secondary-600 hover:bg-secondary-50 hover:text-secondary-900"
													}`}
													onClick={() => setSidebarOpen(false)}
												>
													<subItem.icon className="mr-3 h-5 w-5" />
													<span className="flex items-center gap-2">
														{subItem.name}
														{subItem.showUpgradeIcon && (
															<UpgradeNotificationIcon className="h-3 w-3" />
														)}
													</span>
												</Link>
											))}
										</div>
									</div>
								);
							}
							return null;
						})}
					</nav>
				</div>
			</div>

			{/* Desktop sidebar */}
			<div
				className={`hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:flex-col transition-all duration-300 ${
					sidebarCollapsed ? "lg:w-16" : "lg:w-64"
				} bg-white dark:bg-secondary-800`}
			>
				<div
					className={`flex grow flex-col gap-y-5 overflow-y-auto border-r border-secondary-200 dark:border-secondary-600 bg-white dark:bg-secondary-800 ${
						sidebarCollapsed ? "px-2 shadow-lg" : "px-6"
					}`}
				>
					<div
						className={`flex h-16 shrink-0 items-center border-b border-secondary-200 ${
							sidebarCollapsed ? "justify-center" : "justify-between"
						}`}
					>
						{sidebarCollapsed ? (
							<button
								type="button"
								onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
								className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-secondary-100 transition-colors"
								title="Expand sidebar"
							>
								<ChevronRight className="h-5 w-5 text-secondary-700 dark:text-white" />
							</button>
						) : (
							<>
								<div className="flex items-center">
									<Shield className="h-8 w-8 text-primary-600" />
									<h1 className="ml-2 text-xl font-bold text-secondary-900 dark:text-white">
										PatchMon
									</h1>
								</div>
								<button
									type="button"
									onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
									className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-secondary-100 transition-colors"
									title="Collapse sidebar"
								>
									<ChevronLeft className="h-5 w-5 text-secondary-700 dark:text-white" />
								</button>
							</>
						)}
					</div>
					<nav className="flex flex-1 flex-col">
						<ul className="flex flex-1 flex-col gap-y-6">
							{/* Show message for users with very limited permissions */}
							{navigation.length === 0 && settingsNavigation.length === 0 && (
								<li className="px-2 py-4 text-center">
									<div className="text-sm text-secondary-500 dark:text-secondary-400">
										<p className="mb-2">Limited access</p>
										<p className="text-xs">
											Contact your administrator for additional permissions
										</p>
									</div>
								</li>
							)}
							{navigation.map((item) => {
								if (item.name) {
									// Single item (Dashboard)
									return (
										<li key={item.name}>
											<Link
												to={item.href}
												className={`group flex gap-x-3 rounded-md text-sm leading-6 font-semibold transition-all duration-200 ${
													isActive(item.href)
														? "bg-primary-50 dark:bg-primary-600 text-primary-700 dark:text-white"
														: "text-secondary-700 dark:text-secondary-200 hover:text-primary-700 dark:hover:text-primary-300 hover:bg-secondary-50 dark:hover:bg-secondary-700"
												} ${sidebarCollapsed ? "justify-center p-2" : "p-2"}`}
												title={sidebarCollapsed ? item.name : ""}
											>
												<item.icon
													className={`h-5 w-5 shrink-0 ${sidebarCollapsed ? "mx-auto" : ""}`}
												/>
												{!sidebarCollapsed && (
													<span className="truncate">{item.name}</span>
												)}
											</Link>
										</li>
									);
								} else if (item.section) {
									// Section with items
									return (
										<li key={item.section}>
											{!sidebarCollapsed && (
												<h3 className="text-xs font-semibold text-secondary-500 dark:text-secondary-300 uppercase tracking-wider mb-2 px-2">
													{item.section}
												</h3>
											)}
											<ul
												className={`space-y-1 ${sidebarCollapsed ? "" : "-mx-2"}`}
											>
												{item.items.map((subItem) => (
													<li key={subItem.name}>
														{subItem.name === "Hosts" && canManageHosts() ? (
															// Special handling for Hosts item with integrated + button
															<div className="flex items-center gap-1">
																<Link
																	to={subItem.href}
																	className={`group flex gap-x-3 rounded-md text-sm leading-6 font-medium transition-all duration-200 flex-1 ${
																		isActive(subItem.href)
																			? "bg-primary-50 dark:bg-primary-600 text-primary-700 dark:text-white"
																			: "text-secondary-700 dark:text-secondary-200 hover:text-primary-700 dark:hover:text-primary-300 hover:bg-secondary-50 dark:hover:bg-secondary-700"
																	} ${sidebarCollapsed ? "justify-center p-2" : "p-2"}`}
																	title={sidebarCollapsed ? subItem.name : ""}
																>
																	<subItem.icon
																		className={`h-5 w-5 shrink-0 ${sidebarCollapsed ? "mx-auto" : ""}`}
																	/>
																	{!sidebarCollapsed && (
																		<span className="truncate flex items-center gap-2 flex-1">
																			{subItem.name}
																			{subItem.name === "Hosts" &&
																				stats?.cards?.totalHosts !==
																					undefined && (
																					<span className="ml-2 inline-flex items-center justify-center px-1.5 py-0.5 text-xs rounded bg-secondary-100 text-secondary-700">
																						{stats.cards.totalHosts}
																					</span>
																				)}
																		</span>
																	)}
																	{!sidebarCollapsed && (
																		<button
																			type="button"
																			onClick={(e) => {
																				e.preventDefault();
																				handleAddHost();
																			}}
																			className="ml-auto flex items-center justify-center w-5 h-5 rounded-full border-2 border-current opacity-60 hover:opacity-100 transition-all duration-200 self-center"
																			title="Add Host"
																		>
																			<Plus className="h-3 w-3" />
																		</button>
																	)}
																</Link>
															</div>
														) : (
															// Standard navigation item
															<Link
																to={subItem.href}
																className={`group flex gap-x-3 rounded-md text-sm leading-6 font-medium transition-all duration-200 ${
																	isActive(subItem.href)
																		? "bg-primary-50 dark:bg-primary-600 text-primary-700 dark:text-white"
																		: "text-secondary-700 dark:text-secondary-200 hover:text-primary-700 dark:hover:text-primary-300 hover:bg-secondary-50 dark:hover:bg-secondary-700"
																} ${sidebarCollapsed ? "justify-center p-2 relative" : "p-2"} ${
																	subItem.comingSoon
																		? "opacity-50 cursor-not-allowed"
																		: ""
																}`}
																title={sidebarCollapsed ? subItem.name : ""}
																onClick={
																	subItem.comingSoon
																		? (e) => e.preventDefault()
																		: undefined
																}
															>
																<div
																	className={`flex items-center ${sidebarCollapsed ? "justify-center" : ""}`}
																>
																	<subItem.icon
																		className={`h-5 w-5 shrink-0 ${sidebarCollapsed ? "mx-auto" : ""}`}
																	/>
																	{sidebarCollapsed &&
																		subItem.showUpgradeIcon && (
																			<UpgradeNotificationIcon className="h-3 w-3 absolute -top-1 -right-1" />
																		)}
																</div>
																{!sidebarCollapsed && (
																	<span className="truncate flex items-center gap-2">
																		{subItem.name}
																		{subItem.name === "Hosts" &&
																			stats?.cards?.totalHosts !==
																				undefined && (
																				<span className="ml-2 inline-flex items-center justify-center px-1.5 py-0.5 text-xs rounded bg-secondary-100 text-secondary-700">
																					{stats.cards.totalHosts}
																				</span>
																			)}
																		{subItem.comingSoon && (
																			<span className="text-xs bg-secondary-100 text-secondary-600 px-1.5 py-0.5 rounded">
																				Soon
																			</span>
																		)}
																		{subItem.showUpgradeIcon && (
																			<UpgradeNotificationIcon className="h-3 w-3" />
																		)}
																	</span>
																)}
															</Link>
														)}
													</li>
												))}
											</ul>
										</li>
									);
								}
								return null;
							})}
						</ul>

						{/* Settings Section - Bottom of Navigation */}
						{settingsNavigation.length > 0 && (
							<ul className="gap-y-6">
								{settingsNavigation.map((item) => {
									if (item.section) {
										// Settings section (no heading)
										return (
											<li key={item.section}>
												<ul
													className={`space-y-1 ${sidebarCollapsed ? "" : "-mx-2"}`}
												>
													{item.items.map((subItem) => (
														<li key={subItem.name}>
															<Link
																to={subItem.href}
																className={`group flex gap-x-3 rounded-md text-sm leading-6 font-medium transition-all duration-200 ${
																	isActive(subItem.href)
																		? "bg-primary-50 dark:bg-primary-600 text-primary-700 dark:text-white"
																		: "text-secondary-700 dark:text-secondary-200 hover:text-primary-700 dark:hover:text-primary-300 hover:bg-secondary-50 dark:hover:bg-secondary-700"
																} ${sidebarCollapsed ? "justify-center p-2 relative" : "p-2"}`}
																title={sidebarCollapsed ? subItem.name : ""}
															>
																<div
																	className={`flex items-center ${sidebarCollapsed ? "justify-center" : ""}`}
																>
																	<subItem.icon
																		className={`h-5 w-5 shrink-0 ${sidebarCollapsed ? "mx-auto" : ""}`}
																	/>
																	{sidebarCollapsed &&
																		subItem.showUpgradeIcon && (
																			<UpgradeNotificationIcon className="h-3 w-3 absolute -top-1 -right-1" />
																		)}
																</div>
																{!sidebarCollapsed && (
																	<span className="truncate flex items-center gap-2">
																		{subItem.name}
																		{subItem.showUpgradeIcon && (
																			<UpgradeNotificationIcon className="h-3 w-3" />
																		)}
																	</span>
																)}
															</Link>
														</li>
													))}
												</ul>
											</li>
										);
									}
									return null;
								})}
							</ul>
						)}
					</nav>

					{/* Profile Section - Bottom of Sidebar */}
					<div className="border-t border-secondary-200 dark:border-secondary-600">
						{!sidebarCollapsed ? (
							<div>
								{/* User Info with Sign Out - Username is clickable */}
								<div className="flex items-center justify-between -mx-2 py-2">
									<Link
										to="/settings/profile"
										className={`flex-1 min-w-0 rounded-md p-2 transition-all duration-200 ${
											isActive("/settings/profile")
												? "bg-primary-50 dark:bg-primary-600"
												: "hover:bg-secondary-50 dark:hover:bg-secondary-700"
										}`}
									>
										<div className="flex items-center gap-x-3">
											<UserCircle
												className={`h-5 w-5 shrink-0 ${
													isActive("/settings/profile")
														? "text-primary-700 dark:text-white"
														: "text-secondary-500 dark:text-secondary-400"
												}`}
											/>
											<div className="flex flex-col min-w-0">
												<span
													className={`text-sm leading-6 font-semibold truncate ${
														isActive("/settings/profile")
															? "text-primary-700 dark:text-white"
															: "text-secondary-700 dark:text-secondary-200"
													}`}
												>
													{user?.first_name || user?.username}
												</span>
												{user?.role === "admin" && (
													<span
														className={`text-xs leading-4 ${
															isActive("/settings/profile")
																? "text-primary-600 dark:text-primary-200"
																: "text-secondary-500 dark:text-secondary-400"
														}`}
													>
														Role: Admin
													</span>
												)}
											</div>
										</div>
									</Link>
									<button
										type="button"
										onClick={handleLogout}
										className="ml-2 p-1.5 text-secondary-400 hover:text-secondary-600 hover:bg-secondary-100 rounded transition-colors"
										title="Sign out"
									>
										<LogOut className="h-4 w-4" />
									</button>
								</div>
								{/* Updated info */}
								{stats && (
									<div className="px-2 py-1 border-t border-secondary-200 dark:border-secondary-700">
										<div className="flex items-center gap-x-1 text-xs text-secondary-500 dark:text-secondary-400">
											<Clock className="h-3 w-3 flex-shrink-0" />
											<span className="truncate">
												Updated: {formatRelativeTimeShort(stats.lastUpdated)}
											</span>
											<button
												type="button"
												onClick={() => refetch()}
												disabled={isFetching}
												className="p-1 hover:bg-secondary-100 dark:hover:bg-secondary-700 rounded flex-shrink-0 disabled:opacity-50"
												title="Refresh data"
											>
												<RefreshCw
													className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`}
												/>
											</button>
											{versionInfo && (
												<span className="text-xs text-secondary-400 dark:text-secondary-500 flex-shrink-0">
													v{versionInfo.version}
												</span>
											)}
										</div>
									</div>
								)}
							</div>
						) : (
							<div className="space-y-1">
								<Link
									to="/settings/profile"
									className={`flex items-center justify-center p-2 rounded-md transition-colors ${
										isActive("/settings/profile")
											? "bg-primary-50 dark:bg-primary-600 text-primary-700 dark:text-white"
											: "text-secondary-700 dark:text-secondary-200 hover:bg-secondary-50 dark:hover:bg-secondary-700"
									}`}
									title={`My Profile (${user?.username})`}
								>
									<UserCircle className="h-5 w-5" />
								</Link>
								<button
									type="button"
									onClick={handleLogout}
									className="flex items-center justify-center w-full p-2 text-secondary-400 hover:text-secondary-600 hover:bg-secondary-100 dark:hover:bg-secondary-700 rounded-md transition-colors"
									title="Sign out"
								>
									<LogOut className="h-4 w-4" />
								</button>
								{/* Updated info for collapsed sidebar */}
								{stats && (
									<div className="flex flex-col items-center py-1 border-t border-secondary-200 dark:border-secondary-700">
										<button
											type="button"
											onClick={() => refetch()}
											disabled={isFetching}
											className="p-1 hover:bg-secondary-100 dark:hover:bg-secondary-700 rounded disabled:opacity-50"
											title={`Refresh data - Updated: ${formatRelativeTimeShort(stats.lastUpdated)}`}
										>
											<RefreshCw
												className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`}
											/>
										</button>
										{versionInfo && (
											<span className="text-xs text-secondary-400 dark:text-secondary-500 mt-1">
												v{versionInfo.version}
											</span>
										)}
									</div>
								)}
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Main content */}
			<div
				className={`flex flex-col min-h-screen transition-all duration-300 ${
					sidebarCollapsed ? "lg:pl-16" : "lg:pl-64"
				}`}
			>
				{/* Top bar */}
				<div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-secondary-200 dark:border-secondary-600 bg-white dark:bg-secondary-800 px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
					<button
						type="button"
						className="-m-2.5 p-2.5 text-secondary-700 lg:hidden"
						onClick={() => setSidebarOpen(true)}
					>
						<Menu className="h-6 w-6" />
					</button>

					{/* Separator */}
					<div className="h-6 w-px bg-secondary-200 lg:hidden" />

					<div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
						<div className="relative flex flex-1 items-center">
							<h2 className="text-lg font-semibold text-secondary-900 dark:text-secondary-100">
								{getPageTitle()}
							</h2>
						</div>
						<div className="flex items-center gap-x-4 lg:gap-x-6">
							{/* External Links */}
							<div className="flex items-center gap-2">
								<a
									href="https://github.com/9technologygroup/patchmon.net"
									target="_blank"
									rel="noopener noreferrer"
									className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-50 dark:bg-gray-800 text-secondary-600 dark:text-secondary-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors shadow-sm group relative"
								>
									<Github className="h-5 w-5 flex-shrink-0" />
									{githubStars !== null && (
										<div className="flex items-center gap-0.5">
											<Star className="h-3 w-3 fill-current text-yellow-500" />
											<span className="text-sm font-medium">{githubStars}</span>
										</div>
									)}
								</a>
								<a
									href="https://patchmon.net/discord"
									target="_blank"
									rel="noopener noreferrer"
									className="flex items-center justify-center w-10 h-10 bg-gray-50 dark:bg-gray-800 text-secondary-600 dark:text-secondary-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors shadow-sm"
									title="Discord"
								>
									<MessageCircle className="h-5 w-5" />
								</a>
								<a
									href="mailto:support@patchmon.net"
									className="flex items-center justify-center w-10 h-10 bg-gray-50 dark:bg-gray-800 text-secondary-600 dark:text-secondary-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors shadow-sm"
									title="Email support@patchmon.net"
								>
									<Mail className="h-5 w-5" />
								</a>
								<a
									href="https://patchmon.net"
									target="_blank"
									rel="noopener noreferrer"
									className="flex items-center justify-center w-10 h-10 bg-gray-50 dark:bg-gray-800 text-secondary-600 dark:text-secondary-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors shadow-sm"
									title="Visit patchmon.net"
								>
									<Globe className="h-5 w-5" />
								</a>
							</div>
						</div>
					</div>
				</div>

				<main className="flex-1 py-6 bg-secondary-50 dark:bg-secondary-800">
					<div className="px-4 sm:px-6 lg:px-8">{children}</div>
				</main>
			</div>
		</div>
	);
};

export default Layout;
