import { useQuery } from "@tanstack/react-query";
import {
	ArcElement,
	BarElement,
	CategoryScale,
	Chart as ChartJS,
	Legend,
	LinearScale,
	Title,
	Tooltip,
} from "chart.js";
import {
	AlertTriangle,
	Folder,
	GitBranch,
	Package,
	RefreshCw,
	Server,
	Settings,
	Shield,
	TrendingUp,
	Users,
	WifiOff,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Bar, Doughnut, Pie } from "react-chartjs-2";
import { useNavigate } from "react-router-dom";
import DashboardSettingsModal from "../components/DashboardSettingsModal";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import {
	dashboardAPI,
	dashboardPreferencesAPI,
	formatRelativeTime,
	settingsAPI,
} from "../utils/api";

// Register Chart.js components
ChartJS.register(
	ArcElement,
	Tooltip,
	Legend,
	CategoryScale,
	LinearScale,
	BarElement,
	Title,
);

const Dashboard = () => {
	const [showSettingsModal, setShowSettingsModal] = useState(false);
	const [cardPreferences, setCardPreferences] = useState([]);
	const navigate = useNavigate();
	const { isDark } = useTheme();
	const { user } = useAuth();

	// Navigation handlers
	const handleTotalHostsClick = () => {
		navigate("/hosts", { replace: true });
	};

	const handleHostsNeedingUpdatesClick = () => {
		navigate("/hosts?filter=needsUpdates");
	};

	const handleOutdatedPackagesClick = () => {
		navigate("/packages?filter=outdated");
	};

	const handleSecurityUpdatesClick = () => {
		navigate("/packages?filter=security");
	};

	const handleErroredHostsClick = () => {
		navigate("/hosts?filter=inactive");
	};

	const handleOfflineHostsClick = () => {
		navigate("/hosts?filter=offline");
	};

	// New navigation handlers for top cards
	const handleUsersClick = () => {
		navigate("/users");
	};

	const handleHostGroupsClick = () => {
		navigate("/options");
	};

	const handleRepositoriesClick = () => {
		navigate("/repositories");
	};

	const handleOSDistributionClick = () => {
		navigate("/hosts?showFilters=true", { replace: true });
	};

	const handleUpdateStatusClick = () => {
		navigate("/hosts?filter=needsUpdates", { replace: true });
	};

	const handlePackagePriorityClick = () => {
		navigate("/packages?filter=security");
	};

	// Chart click handlers
	const handleOSChartClick = (_, elements) => {
		if (elements.length > 0) {
			const elementIndex = elements[0].index;
			const osName =
				stats.charts.osDistribution[elementIndex].name.toLowerCase();
			navigate(`/hosts?osFilter=${osName}&showFilters=true`, { replace: true });
		}
	};

	const handleUpdateStatusChartClick = (_, elements) => {
		if (elements.length > 0) {
			const elementIndex = elements[0].index;
			const statusName =
				stats.charts.updateStatusDistribution[elementIndex].name;

			// Map status names to filter parameters
			let filter = "";
			if (statusName.toLowerCase().includes("needs updates")) {
				filter = "needsUpdates";
			} else if (statusName.toLowerCase().includes("up to date")) {
				filter = "upToDate";
			} else if (statusName.toLowerCase().includes("stale")) {
				filter = "stale";
			}

			if (filter) {
				navigate(`/hosts?filter=${filter}`, { replace: true });
			}
		}
	};

	const handlePackagePriorityChartClick = (_, elements) => {
		if (elements.length > 0) {
			const elementIndex = elements[0].index;
			const priorityName =
				stats.charts.packageUpdateDistribution[elementIndex].name;

			// Map priority names to filter parameters
			if (priorityName.toLowerCase().includes("security")) {
				navigate("/packages?filter=security", { replace: true });
			} else if (priorityName.toLowerCase().includes("regular")) {
				navigate("/packages?filter=regular", { replace: true });
			}
		}
	};

	// Helper function to format the update interval threshold
	const formatUpdateIntervalThreshold = () => {
		if (!settings?.updateInterval) return "24 hours";

		const intervalMinutes = settings.updateInterval;
		const thresholdMinutes = intervalMinutes * 2; // 2x the update interval

		if (thresholdMinutes < 60) {
			return `${thresholdMinutes} minutes`;
		} else if (thresholdMinutes < 1440) {
			const hours = Math.floor(thresholdMinutes / 60);
			const minutes = thresholdMinutes % 60;
			if (minutes === 0) {
				return `${hours} hour${hours > 1 ? "s" : ""}`;
			}
			return `${hours}h ${minutes}m`;
		} else {
			const days = Math.floor(thresholdMinutes / 1440);
			const hours = Math.floor((thresholdMinutes % 1440) / 60);
			if (hours === 0) {
				return `${days} day${days > 1 ? "s" : ""}`;
			}
			return `${days}d ${hours}h`;
		}
	};

	const {
		data: stats,
		isLoading,
		error,
		refetch,
		isFetching,
	} = useQuery({
		queryKey: ["dashboardStats"],
		queryFn: () => dashboardAPI.getStats().then((res) => res.data),
		staleTime: 5 * 60 * 1000, // Data stays fresh for 5 minutes
		refetchOnWindowFocus: false, // Don't refetch when window regains focus
	});

	// Fetch recent users (permission protected server-side)
	const { data: recentUsers } = useQuery({
		queryKey: ["dashboardRecentUsers"],
		queryFn: () => dashboardAPI.getRecentUsers().then((res) => res.data),
		staleTime: 60 * 1000,
	});

	// Fetch recent collection (permission protected server-side)
	const { data: recentCollection } = useQuery({
		queryKey: ["dashboardRecentCollection"],
		queryFn: () => dashboardAPI.getRecentCollection().then((res) => res.data),
		staleTime: 60 * 1000,
	});

	// Fetch settings to get the agent update interval
	const { data: settings } = useQuery({
		queryKey: ["settings"],
		queryFn: () => settingsAPI.get().then((res) => res.data),
	});

	// Fetch user's dashboard preferences
	const { data: preferences } = useQuery({
		queryKey: ["dashboardPreferences"],
		queryFn: () => dashboardPreferencesAPI.get().then((res) => res.data),
		staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
	});

	// Fetch default card configuration
	const { data: defaultCards } = useQuery({
		queryKey: ["dashboardDefaultCards"],
		queryFn: () =>
			dashboardPreferencesAPI.getDefaults().then((res) => res.data),
	});

	// Merge preferences with default cards (normalize snake_case from API)
	useEffect(() => {
		if (preferences && defaultCards) {
			const normalizedPreferences = preferences.map((p) => ({
				cardId: p.cardId ?? p.card_id,
				enabled: p.enabled,
				order: p.order,
			}));

			const mergedCards = defaultCards
				.map((defaultCard) => {
					const userPreference = normalizedPreferences.find(
						(p) => p.cardId === defaultCard.cardId,
					);
					return {
						...defaultCard,
						enabled: userPreference
							? userPreference.enabled
							: defaultCard.enabled,
						order: userPreference ? userPreference.order : defaultCard.order,
					};
				})
				.sort((a, b) => a.order - b.order);

			setCardPreferences(mergedCards);
		} else if (defaultCards) {
			// If no preferences exist, use defaults
			setCardPreferences(defaultCards.sort((a, b) => a.order - b.order));
		}
	}, [preferences, defaultCards]);

	// Listen for custom event from Layout component
	useEffect(() => {
		const handleOpenSettings = () => {
			setShowSettingsModal(true);
		};

		window.addEventListener("openDashboardSettings", handleOpenSettings);
		return () => {
			window.removeEventListener("openDashboardSettings", handleOpenSettings);
		};
	}, []);

	// Helper function to check if a card should be displayed
	const isCardEnabled = (cardId) => {
		const card = cardPreferences.find((c) => c.cardId === cardId);
		return card ? card.enabled : true; // Default to enabled if not found
	};

	// Helper function to get card type for layout grouping
	const getCardType = (cardId) => {
		if (
			[
				"totalHosts",
				"hostsNeedingUpdates",
				"totalOutdatedPackages",
				"securityUpdates",
				"upToDateHosts",
				"totalHostGroups",
				"totalUsers",
				"totalRepos",
			].includes(cardId)
		) {
			return "stats";
		} else if (
			[
				"osDistribution",
				"osDistributionBar",
				"osDistributionDoughnut",
				"updateStatus",
				"packagePriority",
				"recentUsers",
				"recentCollection",
			].includes(cardId)
		) {
			return "charts";
		} else if (["erroredHosts", "quickStats"].includes(cardId)) {
			return "fullwidth";
		}
		return "fullwidth"; // Default to full width
	};

	// Helper function to get CSS class for card group
	const getGroupClassName = (cardType) => {
		switch (cardType) {
			case "stats":
				return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4";
			case "charts":
				return "grid grid-cols-1 lg:grid-cols-3 gap-6";
			case "fullwidth":
				return "space-y-6";
			default:
				return "space-y-6";
		}
	};

	// Helper function to render a card by ID
	const renderCard = (cardId) => {
		switch (cardId) {
			case "upToDateHosts":
				return (
					<div className="card p-4">
						<div className="flex items-center">
							<div className="flex-shrink-0">
								<TrendingUp className="h-5 w-5 text-success-600 mr-2" />
							</div>
							<div className="w-0 flex-1">
								<p className="text-sm text-secondary-500 dark:text-white">
									Up to date
								</p>
								<p className="text-xl font-semibold text-secondary-900 dark:text-white">
									{stats.cards.upToDateHosts}/{stats.cards.totalHosts}
								</p>
							</div>
						</div>
					</div>
				);
			case "totalHosts":
				return (
					<button
						type="button"
						className="card p-4 cursor-pointer hover:shadow-card-hover dark:hover:shadow-card-hover-dark transition-shadow duration-200 w-full text-left"
						onClick={handleTotalHostsClick}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								handleTotalHostsClick();
							}
						}}
					>
						<div className="flex items-center">
							<div className="flex-shrink-0">
								<Server className="h-5 w-5 text-primary-600 mr-2" />
							</div>
							<div className="w-0 flex-1">
								<p className="text-sm text-secondary-500 dark:text-white">
									Total Hosts
								</p>
								<p className="text-xl font-semibold text-secondary-900 dark:text-white">
									{stats.cards.totalHosts}
								</p>
							</div>
						</div>
					</button>
				);

			case "hostsNeedingUpdates":
				return (
					<button
						type="button"
						className="card p-4 cursor-pointer hover:shadow-card-hover dark:hover:shadow-card-hover-dark transition-shadow duration-200 w-full text-left"
						onClick={handleHostsNeedingUpdatesClick}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								handleHostsNeedingUpdatesClick();
							}
						}}
					>
						<div className="flex items-center">
							<div className="flex-shrink-0">
								<AlertTriangle className="h-5 w-5 text-warning-600 mr-2" />
							</div>
							<div className="w-0 flex-1">
								<p className="text-sm text-secondary-500 dark:text-white">
									Needs Updating
								</p>
								<p className="text-xl font-semibold text-secondary-900 dark:text-white">
									{stats.cards.hostsNeedingUpdates}
								</p>
							</div>
						</div>
					</button>
				);

			case "totalOutdatedPackages":
				return (
					<button
						type="button"
						className="card p-4 cursor-pointer hover:shadow-card-hover dark:hover:shadow-card-hover-dark transition-shadow duration-200 w-full text-left"
						onClick={handleOutdatedPackagesClick}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								handleOutdatedPackagesClick();
							}
						}}
					>
						<div className="flex items-center">
							<div className="flex-shrink-0">
								<Package className="h-5 w-5 text-secondary-600 mr-2" />
							</div>
							<div className="w-0 flex-1">
								<p className="text-sm text-secondary-500 dark:text-white">
									Outdated Packages
								</p>
								<p className="text-xl font-semibold text-secondary-900 dark:text-white">
									{stats.cards.totalOutdatedPackages}
								</p>
							</div>
						</div>
					</button>
				);

			case "securityUpdates":
				return (
					<button
						type="button"
						className="card p-4 cursor-pointer hover:shadow-card-hover dark:hover:shadow-card-hover-dark transition-shadow duration-200 w-full text-left"
						onClick={handleSecurityUpdatesClick}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								handleSecurityUpdatesClick();
							}
						}}
					>
						<div className="flex items-center">
							<div className="flex-shrink-0">
								<Shield className="h-5 w-5 text-danger-600 mr-2" />
							</div>
							<div className="w-0 flex-1">
								<p className="text-sm text-secondary-500 dark:text-white">
									Security Updates
								</p>
								<p className="text-xl font-semibold text-secondary-900 dark:text-white">
									{stats.cards.securityUpdates}
								</p>
							</div>
						</div>
					</button>
				);

			case "totalHostGroups":
				return (
					<button
						type="button"
						className="card p-4 cursor-pointer hover:shadow-card-hover dark:hover:shadow-card-hover-dark transition-shadow duration-200 w-full text-left"
						onClick={handleHostGroupsClick}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								handleHostGroupsClick();
							}
						}}
					>
						<div className="flex items-center">
							<div className="flex-shrink-0">
								<Folder className="h-5 w-5 text-primary-600 mr-2" />
							</div>
							<div className="w-0 flex-1">
								<p className="text-sm text-secondary-500 dark:text-white">
									Host Groups
								</p>
								<p className="text-xl font-semibold text-secondary-900 dark:text-white">
									{stats.cards.totalHostGroups}
								</p>
							</div>
						</div>
					</button>
				);

			case "totalUsers":
				return (
					<button
						type="button"
						className="card p-4 cursor-pointer hover:shadow-card-hover dark:hover:shadow-card-hover-dark transition-shadow duration-200 w-full text-left"
						onClick={handleUsersClick}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								handleUsersClick();
							}
						}}
					>
						<div className="flex items-center">
							<div className="flex-shrink-0">
								<Users className="h-5 w-5 text-success-600 mr-2" />
							</div>
							<div className="w-0 flex-1">
								<p className="text-sm text-secondary-500 dark:text-white">
									Users
								</p>
								<p className="text-xl font-semibold text-secondary-900 dark:text-white">
									{stats.cards.totalUsers}
								</p>
							</div>
						</div>
					</button>
				);

			case "totalRepos":
				return (
					<button
						type="button"
						className="card p-4 cursor-pointer hover:shadow-card-hover dark:hover:shadow-card-hover-dark transition-shadow duration-200 w-full text-left"
						onClick={handleRepositoriesClick}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								handleRepositoriesClick();
							}
						}}
					>
						<div className="flex items-center">
							<div className="flex-shrink-0">
								<GitBranch className="h-5 w-5 text-warning-600 mr-2" />
							</div>
							<div className="w-0 flex-1">
								<p className="text-sm text-secondary-500 dark:text-white">
									Repositories
								</p>
								<p className="text-xl font-semibold text-secondary-900 dark:text-white">
									{stats.cards.totalRepos}
								</p>
							</div>
						</div>
					</button>
				);

			case "erroredHosts":
				return (
					<button
						type="button"
						className={`border rounded-lg p-4 cursor-pointer hover:shadow-card-hover dark:hover:shadow-card-hover-dark transition-shadow duration-200 w-full text-left ${
							stats.cards.erroredHosts > 0
								? "bg-danger-50 border-danger-200"
								: "bg-success-50 border-success-200"
						}`}
						onClick={handleErroredHostsClick}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								handleErroredHostsClick();
							}
						}}
					>
						<div className="flex">
							<AlertTriangle
								className={`h-5 w-5 ${
									stats.cards.erroredHosts > 0
										? "text-danger-400"
										: "text-success-400"
								}`}
							/>
							<div className="ml-3">
								{stats.cards.erroredHosts > 0 ? (
									<>
										<h3 className="text-sm font-medium text-danger-800">
											{stats.cards.erroredHosts} host
											{stats.cards.erroredHosts > 1 ? "s" : ""} haven't reported
											in {formatUpdateIntervalThreshold()}+
										</h3>
										<p className="text-sm text-danger-700 mt-1">
											These hosts may be offline or experiencing connectivity
											issues.
										</p>
									</>
								) : (
									<>
										<h3 className="text-sm font-medium text-success-800">
											All hosts are reporting normally
										</h3>
										<p className="text-sm text-success-700 mt-1">
											No hosts have failed to report in the last{" "}
											{formatUpdateIntervalThreshold()}.
										</p>
									</>
								)}
							</div>
						</div>
					</button>
				);

			case "offlineHosts":
				return (
					<button
						type="button"
						className={`border rounded-lg p-4 cursor-pointer hover:shadow-card-hover dark:hover:shadow-card-hover-dark transition-shadow duration-200 w-full text-left ${
							stats.cards.offlineHosts > 0
								? "bg-warning-50 border-warning-200"
								: "bg-success-50 border-success-200"
						}`}
						onClick={handleOfflineHostsClick}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								handleOfflineHostsClick();
							}
						}}
					>
						<div className="flex">
							<WifiOff
								className={`h-5 w-5 ${
									stats.cards.offlineHosts > 0
										? "text-warning-400"
										: "text-success-400"
								}`}
							/>
							<div className="ml-3">
								{stats.cards.offlineHosts > 0 ? (
									<>
										<h3 className="text-sm font-medium text-warning-800">
											{stats.cards.offlineHosts} host
											{stats.cards.offlineHosts > 1 ? "s" : ""} offline/stale
										</h3>
										<p className="text-sm text-warning-700 mt-1">
											These hosts haven't reported in{" "}
											{formatUpdateIntervalThreshold() * 3}+ minutes.
										</p>
									</>
								) : (
									<>
										<h3 className="text-sm font-medium text-success-800">
											All hosts are online
										</h3>
										<p className="text-sm text-success-700 mt-1">
											No hosts are offline or stale.
										</p>
									</>
								)}
							</div>
						</div>
					</button>
				);

			case "osDistribution":
				return (
					<div className="card p-6 w-full">
						<h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-4">
							OS Distribution
						</h3>
						<div className="h-64 w-full flex items-center justify-center">
							<div className="w-full h-full max-w-sm">
								<Pie data={osChartData} options={chartOptions} />
							</div>
						</div>
					</div>
				);

			case "osDistributionDoughnut":
				return (
					<div className="card p-6 w-full">
						<h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-4">
							OS Distribution
						</h3>
						<div className="h-64 w-full flex items-center justify-center">
							<div className="w-full h-full max-w-sm">
								<Doughnut data={osChartData} options={doughnutChartOptions} />
							</div>
						</div>
					</div>
				);

			case "osDistributionBar":
				return (
					<div className="card p-6 w-full">
						<h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-4">
							OS Distribution
						</h3>
						<div className="h-64">
							<Bar data={osBarChartData} options={barChartOptions} />
						</div>
					</div>
				);

			case "updateStatus":
				return (
					<button
						type="button"
						className="card p-6 cursor-pointer hover:shadow-card-hover dark:hover:shadow-card-hover-dark transition-shadow duration-200 w-full text-left"
						onClick={handleUpdateStatusClick}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								handleUpdateStatusClick();
							}
						}}
					>
						<h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-4">
							Update Status
						</h3>
						<div className="h-64 w-full flex items-center justify-center">
							<div className="w-full h-full max-w-sm">
								<Pie
									data={updateStatusChartData}
									options={updateStatusChartOptions}
								/>
							</div>
						</div>
					</button>
				);

			case "packagePriority":
				return (
					<div className="card p-6 w-full">
						<h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-4">
							Outdated Packages by Priority
						</h3>
						<div className="h-64 w-full flex items-center justify-center">
							<div className="w-full h-full max-w-sm">
								<Pie
									data={packagePriorityChartData}
									options={packagePriorityChartOptions}
								/>
							</div>
						</div>
					</div>
				);

			case "quickStats": {
				// Calculate dynamic stats
				const updatePercentage =
					stats.cards.totalHosts > 0
						? (
								(stats.cards.hostsNeedingUpdates / stats.cards.totalHosts) *
								100
							).toFixed(1)
						: 0;
				const onlineHosts = stats.cards.totalHosts - stats.cards.erroredHosts;
				const onlinePercentage =
					stats.cards.totalHosts > 0
						? ((onlineHosts / stats.cards.totalHosts) * 100).toFixed(0)
						: 0;
				const securityPercentage =
					stats.cards.totalOutdatedPackages > 0
						? (
								(stats.cards.securityUpdates /
									stats.cards.totalOutdatedPackages) *
								100
							).toFixed(0)
						: 0;
				const avgPackagesPerHost =
					stats.cards.totalHosts > 0
						? Math.round(
								stats.cards.totalOutdatedPackages / stats.cards.totalHosts,
							)
						: 0;

				return (
					<div className="card p-6">
						<div className="flex items-center justify-between mb-4">
							<h3 className="text-lg font-medium text-secondary-900 dark:text-white">
								System Overview
							</h3>
						</div>
						<div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
							<div className="text-center">
								<div className="text-2xl font-bold text-primary-600">
									{updatePercentage}%
								</div>
								<div className="text-sm text-secondary-500 dark:text-secondary-300">
									Need Updates
								</div>
								<div className="text-xs text-secondary-400 dark:text-secondary-500">
									{stats.cards.hostsNeedingUpdates}/{stats.cards.totalHosts}{" "}
									hosts
								</div>
							</div>
							<div className="text-center">
								<div className="text-2xl font-bold text-danger-600">
									{stats.cards.securityUpdates}
								</div>
								<div className="text-sm text-secondary-500 dark:text-secondary-300">
									Security Issues
								</div>
								<div className="text-xs text-secondary-400 dark:text-secondary-500">
									{securityPercentage}% of updates
								</div>
							</div>
							<div className="text-center">
								<div className="text-2xl font-bold text-success-600">
									{onlinePercentage}%
								</div>
								<div className="text-sm text-secondary-500 dark:text-secondary-300">
									Online
								</div>
								<div className="text-xs text-secondary-400 dark:text-secondary-500">
									{onlineHosts}/{stats.cards.totalHosts} hosts
								</div>
							</div>
							<div className="text-center">
								<div className="text-2xl font-bold text-secondary-600">
									{avgPackagesPerHost}
								</div>
								<div className="text-sm text-secondary-500 dark:text-secondary-300">
									Avg per Host
								</div>
								<div className="text-xs text-secondary-400 dark:text-secondary-500">
									outdated packages
								</div>
							</div>
						</div>
					</div>
				);
			}

			case "recentUsers":
				return (
					<div className="card p-6">
						<h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-4">
							Recent Users Logged in
						</h3>
						<div className="h-64 overflow-y-auto">
							<div className="space-y-3">
								{(recentUsers || []).slice(0, 5).map((u) => (
									<div
										key={u.id}
										className="flex items-center justify-between py-2 border-b border-secondary-100 dark:border-secondary-700 last:border-b-0"
									>
										<div className="text-sm font-medium text-secondary-900 dark:text-white">
											{u.username}
										</div>
										<div className="text-sm text-secondary-500 dark:text-secondary-400">
											{u.last_login
												? formatRelativeTime(u.last_login)
												: "Never"}
										</div>
									</div>
								))}
								{(!recentUsers || recentUsers.length === 0) && (
									<div className="text-center text-secondary-500 dark:text-secondary-400 py-4">
										No users found
									</div>
								)}
							</div>
						</div>
					</div>
				);

			case "recentCollection":
				return (
					<div className="card p-6">
						<h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-4">
							Recent Collection
						</h3>
						<div className="h-64 overflow-y-auto">
							<div className="space-y-3">
								{(recentCollection || []).slice(0, 5).map((host) => (
									<div
										key={host.id}
										className="flex items-center justify-between py-2 border-b border-secondary-100 dark:border-secondary-700 last:border-b-0"
									>
										<button
											type="button"
											onClick={() => navigate(`/hosts/${host.id}`)}
											className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:underline text-left"
										>
											{host.friendly_name || host.hostname}
										</button>
										<div className="text-sm text-secondary-500 dark:text-secondary-400">
											{host.last_update
												? formatRelativeTime(host.last_update)
												: "Never"}
										</div>
									</div>
								))}
								{(!recentCollection || recentCollection.length === 0) && (
									<div className="text-center text-secondary-500 dark:text-secondary-400 py-4">
										No hosts found
									</div>
								)}
							</div>
						</div>
					</div>
				);

			default:
				return null;
		}
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-64">
				<RefreshCw className="h-8 w-8 animate-spin text-primary-600" />
			</div>
		);
	}

	if (error) {
		return (
			<div className="bg-danger-50 border border-danger-200 rounded-md p-4">
				<div className="flex">
					<AlertTriangle className="h-5 w-5 text-danger-400" />
					<div className="ml-3">
						<h3 className="text-sm font-medium text-danger-800">
							Error loading dashboard
						</h3>
						<p className="text-sm text-danger-700 mt-1">
							{error.message || "Failed to load dashboard statistics"}
						</p>
						<button
							type="button"
							onClick={() => refetch()}
							className="mt-2 btn-danger text-xs"
						>
							Try again
						</button>
					</div>
				</div>
			</div>
		);
	}

	const chartOptions = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: {
				position: "right",
				labels: {
					color: isDark ? "#ffffff" : "#374151",
					font: {
						size: 12,
					},
					padding: 15,
					usePointStyle: true,
					pointStyle: "circle",
				},
			},
		},
		layout: {
			padding: {
				right: 20,
			},
		},
		onClick: handleOSChartClick,
	};

	const doughnutChartOptions = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: {
				position: "right",
				labels: {
					color: isDark ? "#ffffff" : "#374151",
					font: {
						size: 12,
					},
					padding: 15,
					usePointStyle: true,
					pointStyle: "circle",
				},
			},
		},
		layout: {
			padding: {
				right: 20,
			},
		},
		onClick: handleOSChartClick,
	};

	const updateStatusChartOptions = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: {
				position: "right",
				labels: {
					color: isDark ? "#ffffff" : "#374151",
					font: {
						size: 12,
					},
					padding: 15,
					usePointStyle: true,
					pointStyle: "circle",
				},
			},
		},
		layout: {
			padding: {
				right: 20,
			},
		},
		onClick: handleUpdateStatusChartClick,
	};

	const packagePriorityChartOptions = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: {
				position: "right",
				labels: {
					color: isDark ? "#ffffff" : "#374151",
					font: {
						size: 12,
					},
					padding: 15,
					usePointStyle: true,
					pointStyle: "circle",
				},
			},
		},
		layout: {
			padding: {
				right: 20,
			},
		},
		onClick: handlePackagePriorityChartClick,
	};

	const barChartOptions = {
		responsive: true,
		indexAxis: "y", // Make the chart horizontal
		plugins: {
			legend: {
				display: false,
			},
		},
		scales: {
			x: {
				ticks: {
					color: isDark ? "#ffffff" : "#374151",
					font: {
						size: 12,
					},
				},
				grid: {
					color: isDark ? "#374151" : "#e5e7eb",
				},
			},
			y: {
				ticks: {
					color: isDark ? "#ffffff" : "#374151",
					font: {
						size: 12,
					},
				},
				grid: {
					color: isDark ? "#374151" : "#e5e7eb",
				},
			},
		},
		onClick: handleOSChartClick,
	};

	const osChartData = {
		labels: stats.charts.osDistribution.map((item) => item.name),
		datasets: [
			{
				data: stats.charts.osDistribution.map((item) => item.count),
				backgroundColor: [
					"#3B82F6", // Blue
					"#10B981", // Green
					"#F59E0B", // Yellow
					"#EF4444", // Red
					"#8B5CF6", // Purple
					"#06B6D4", // Cyan
				],
				borderWidth: 2,
				borderColor: "#ffffff",
			},
		],
	};

	const osBarChartData = {
		labels: stats.charts.osDistribution.map((item) => item.name),
		datasets: [
			{
				label: "Hosts",
				data: stats.charts.osDistribution.map((item) => item.count),
				backgroundColor: [
					"#3B82F6", // Blue
					"#10B981", // Green
					"#F59E0B", // Yellow
					"#EF4444", // Red
					"#8B5CF6", // Purple
					"#06B6D4", // Cyan
				],
				borderWidth: 1,
				borderColor: isDark ? "#374151" : "#ffffff",
				borderRadius: 4,
				borderSkipped: false,
			},
		],
	};

	const updateStatusChartData = {
		labels: stats.charts.updateStatusDistribution.map((item) => item.name),
		datasets: [
			{
				data: stats.charts.updateStatusDistribution.map((item) => item.count),
				backgroundColor: [
					"#10B981", // Green - Up to date
					"#F59E0B", // Yellow - Needs updates
					"#EF4444", // Red - Errored
				],
				borderWidth: 2,
				borderColor: "#ffffff",
			},
		],
	};

	const packagePriorityChartData = {
		labels: stats.charts.packageUpdateDistribution.map((item) => item.name),
		datasets: [
			{
				data: stats.charts.packageUpdateDistribution.map((item) => item.count),
				backgroundColor: [
					"#EF4444", // Red - Security
					"#3B82F6", // Blue - Regular
				],
				borderWidth: 2,
				borderColor: "#ffffff",
			},
		],
	};

	return (
		<div className="space-y-6">
			{/* Page Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-semibold text-secondary-900 dark:text-white">
						Welcome back, {user?.first_name || user?.username || "User"} 👋
					</h1>
					<p className="text-sm text-secondary-600 dark:text-secondary-400 mt-1">
						Overview of your PatchMon infrastructure
					</p>
				</div>
				<div className="flex items-center gap-3">
					<button
						type="button"
						onClick={() => setShowSettingsModal(true)}
						className="btn-outline flex items-center gap-2"
						title="Customize dashboard layout"
					>
						<Settings className="h-4 w-4" />
						Customize Dashboard
					</button>
					<button
						type="button"
						onClick={() => refetch()}
						disabled={isFetching}
						className="btn-outline flex items-center gap-2"
						title="Refresh dashboard data"
					>
						<RefreshCw
							className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
						/>
						{isFetching ? "Refreshing..." : "Refresh"}
					</button>
				</div>
			</div>

			{/* Dynamically Rendered Cards - Unified Order */}
			{(() => {
				const enabledCards = cardPreferences
					.filter((card) => isCardEnabled(card.cardId))
					.sort((a, b) => a.order - b.order);

				// Group consecutive cards of the same type for proper layout
				const cardGroups = [];
				let currentGroup = null;

				enabledCards.forEach((card) => {
					const cardType = getCardType(card.cardId);

					if (!currentGroup || currentGroup.type !== cardType) {
						// Start a new group
						currentGroup = {
							type: cardType,
							cards: [card],
						};
						cardGroups.push(currentGroup);
					} else {
						// Add to existing group
						currentGroup.cards.push(card);
					}
				});

				return (
					<>
						{cardGroups.map((group, groupIndex) => (
							<div
								key={`group-${group.type}-${groupIndex}`}
								className={getGroupClassName(group.type)}
							>
								{group.cards.map((card, cardIndex) => (
									<div key={`card-${card.cardId}-${groupIndex}-${cardIndex}`}>
										{renderCard(card.cardId)}
									</div>
								))}
							</div>
						))}
					</>
				);
			})()}

			{/* Dashboard Settings Modal */}
			<DashboardSettingsModal
				isOpen={showSettingsModal}
				onClose={() => setShowSettingsModal(false)}
			/>
		</div>
	);
};

export default Dashboard;
