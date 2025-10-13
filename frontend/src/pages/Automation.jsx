import { useQuery } from "@tanstack/react-query";
import {
	Activity,
	AlertCircle,
	ArrowDown,
	ArrowUp,
	ArrowUpDown,
	Bot,
	CheckCircle,
	Clock,
	Play,
	RefreshCw,
	Settings,
	XCircle,
	Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import api from "../utils/api";

const Automation = () => {
	const [activeTab, setActiveTab] = useState("overview");
	const [sortField, setSortField] = useState("nextRunTimestamp");
	const [sortDirection, setSortDirection] = useState("asc");

	// Fetch automation overview data
	const { data: overview, isLoading: overviewLoading } = useQuery({
		queryKey: ["automation-overview"],
		queryFn: async () => {
			const response = await api.get("/automation/overview");
			return response.data.data;
		},
		refetchInterval: 30000, // Refresh every 30 seconds
	});

	// Fetch queue statistics
	const { data: queueStats, isLoading: statsLoading } = useQuery({
		queryKey: ["automation-stats"],
		queryFn: async () => {
			const response = await api.get("/automation/stats");
			return response.data.data;
		},
		refetchInterval: 30000,
	});

	// Fetch recent jobs
	const { data: recentJobs, isLoading: jobsLoading } = useQuery({
		queryKey: ["automation-jobs"],
		queryFn: async () => {
			const jobs = await Promise.all([
				api
					.get("/automation/jobs/github-update-check?limit=5")
					.then((r) => r.data.data || []),
				api
					.get("/automation/jobs/session-cleanup?limit=5")
					.then((r) => r.data.data || []),
			]);
			return {
				githubUpdate: jobs[0],
				sessionCleanup: jobs[1],
			};
		},
		refetchInterval: 30000,
	});

	const getStatusIcon = (status) => {
		switch (status) {
			case "completed":
				return <CheckCircle className="h-4 w-4 text-green-500" />;
			case "failed":
				return <XCircle className="h-4 w-4 text-red-500" />;
			case "active":
				return <Activity className="h-4 w-4 text-blue-500 animate-pulse" />;
			default:
				return <Clock className="h-4 w-4 text-gray-500" />;
		}
	};

	const getStatusColor = (status) => {
		switch (status) {
			case "completed":
				return "bg-green-100 text-green-800";
			case "failed":
				return "bg-red-100 text-red-800";
			case "active":
				return "bg-blue-100 text-blue-800";
			default:
				return "bg-gray-100 text-gray-800";
		}
	};

	const formatDate = (dateString) => {
		if (!dateString) return "N/A";
		return new Date(dateString).toLocaleString();
	};

	const formatDuration = (ms) => {
		if (!ms) return "N/A";
		return `${ms}ms`;
	};

	const getStatusBadge = (status) => {
		switch (status) {
			case "Success":
				return (
					<span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
						Success
					</span>
				);
			case "Failed":
				return (
					<span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
						Failed
					</span>
				);
			case "Never run":
				return (
					<span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
						Never run
					</span>
				);
			default:
				return (
					<span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
						{status}
					</span>
				);
		}
	};

	const getNextRunTime = (schedule, lastRun) => {
		if (schedule === "Manual only") return "Manual trigger only";
		if (schedule === "Daily at midnight") {
			const now = new Date();
			const tomorrow = new Date(now);
			tomorrow.setDate(tomorrow.getDate() + 1);
			tomorrow.setHours(0, 0, 0, 0);
			return tomorrow.toLocaleString([], {
				hour12: true,
				hour: "numeric",
				minute: "2-digit",
				day: "numeric",
				month: "numeric",
				year: "numeric",
			});
		}
		if (schedule === "Daily at 2 AM") {
			const now = new Date();
			const tomorrow = new Date(now);
			tomorrow.setDate(tomorrow.getDate() + 1);
			tomorrow.setHours(2, 0, 0, 0);
			return tomorrow.toLocaleString([], {
				hour12: true,
				hour: "numeric",
				minute: "2-digit",
				day: "numeric",
				month: "numeric",
				year: "numeric",
			});
		}
		if (schedule === "Every hour") {
			const now = new Date();
			const nextHour = new Date(now);
			nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
			return nextHour.toLocaleString([], {
				hour12: true,
				hour: "numeric",
				minute: "2-digit",
				day: "numeric",
				month: "numeric",
				year: "numeric",
			});
		}
		return "Unknown";
	};

	const getNextRunTimestamp = (schedule) => {
		if (schedule === "Manual only") return Number.MAX_SAFE_INTEGER; // Manual tasks go to bottom
		if (schedule === "Daily at midnight") {
			const now = new Date();
			const tomorrow = new Date(now);
			tomorrow.setDate(tomorrow.getDate() + 1);
			tomorrow.setHours(0, 0, 0, 0);
			return tomorrow.getTime();
		}
		if (schedule === "Daily at 2 AM") {
			const now = new Date();
			const tomorrow = new Date(now);
			tomorrow.setDate(tomorrow.getDate() + 1);
			tomorrow.setHours(2, 0, 0, 0);
			return tomorrow.getTime();
		}
		if (schedule === "Every hour") {
			const now = new Date();
			const nextHour = new Date(now);
			nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
			return nextHour.getTime();
		}
		return Number.MAX_SAFE_INTEGER; // Unknown schedules go to bottom
	};

	const triggerManualJob = async (jobType, data = {}) => {
		try {
			let endpoint;

			if (jobType === "github") {
				endpoint = "/automation/trigger/github-update";
			} else if (jobType === "sessions") {
				endpoint = "/automation/trigger/session-cleanup";
			} else if (jobType === "echo") {
				endpoint = "/automation/trigger/echo-hello";
			} else if (jobType === "orphaned-repos") {
				endpoint = "/automation/trigger/orphaned-repo-cleanup";
			}

			const response = await api.post(endpoint, data);

			// Refresh data
			window.location.reload();
		} catch (error) {
			console.error("Error triggering job:", error);
			alert(
				"Failed to trigger job: " +
					(error.response?.data?.error || error.message),
			);
		}
	};

	const handleSort = (field) => {
		if (sortField === field) {
			setSortDirection(sortDirection === "asc" ? "desc" : "asc");
		} else {
			setSortField(field);
			setSortDirection("asc");
		}
	};

	const getSortIcon = (field) => {
		if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />;
		return sortDirection === "asc" ? (
			<ArrowUp className="h-4 w-4" />
		) : (
			<ArrowDown className="h-4 w-4" />
		);
	};

	// Sort automations based on current sort settings
	const sortedAutomations = overview?.automations
		? [...overview.automations].sort((a, b) => {
				let aValue, bValue;

				switch (sortField) {
					case "name":
						aValue = a.name.toLowerCase();
						bValue = b.name.toLowerCase();
						break;
					case "schedule":
						aValue = a.schedule.toLowerCase();
						bValue = b.schedule.toLowerCase();
						break;
					case "lastRun":
						// Convert "Never" to empty string for proper sorting
						aValue = a.lastRun === "Never" ? "" : a.lastRun;
						bValue = b.lastRun === "Never" ? "" : b.lastRun;
						break;
					case "lastRunTimestamp":
						aValue = a.lastRunTimestamp || 0;
						bValue = b.lastRunTimestamp || 0;
						break;
					case "nextRunTimestamp":
						aValue = getNextRunTimestamp(a.schedule);
						bValue = getNextRunTimestamp(b.schedule);
						break;
					case "status":
						aValue = a.status.toLowerCase();
						bValue = b.status.toLowerCase();
						break;
					default:
						aValue = a[sortField];
						bValue = b[sortField];
				}

				if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
				if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
				return 0;
			})
		: [];

	const tabs = [{ id: "overview", name: "Overview", icon: Settings }];

	return (
		<div className="space-y-6">
			{/* Page Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-semibold text-secondary-900 dark:text-white">
						Automation Management
					</h1>
					<p className="text-sm text-secondary-600 dark:text-secondary-400 mt-1">
						Monitor and manage automated server operations, agent
						communications, and patch deployments
					</p>
				</div>
				<div className="flex items-center gap-3">
					<button
						type="button"
						onClick={() => triggerManualJob("github")}
						className="btn-outline flex items-center gap-2"
						title="Trigger manual GitHub update check"
					>
						<RefreshCw className="h-4 w-4" />
						Check Updates
					</button>
					<button
						type="button"
						onClick={() => triggerManualJob("sessions")}
						className="btn-outline flex items-center gap-2"
						title="Trigger manual session cleanup"
					>
						<RefreshCw className="h-4 w-4" />
						Clean Sessions
					</button>
					<button
						type="button"
						onClick={() =>
							triggerManualJob("echo", {
								message: "Hello from Automation Page!",
							})
						}
						className="btn-outline flex items-center gap-2"
						title="Trigger echo hello task"
					>
						<RefreshCw className="h-4 w-4" />
						Echo Hello
					</button>
				</div>
			</div>

			{/* Stats Cards */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
				{/* Scheduled Tasks Card */}
				<div className="card p-4">
					<div className="flex items-center">
						<div className="flex-shrink-0">
							<Clock className="h-5 w-5 text-warning-600 mr-2" />
						</div>
						<div className="w-0 flex-1">
							<p className="text-sm text-secondary-500 dark:text-white">
								Scheduled Tasks
							</p>
							<p className="text-xl font-semibold text-secondary-900 dark:text-white">
								{overviewLoading ? "..." : overview?.scheduledTasks || 0}
							</p>
						</div>
					</div>
				</div>

				{/* Running Tasks Card */}
				<div className="card p-4">
					<div className="flex items-center">
						<div className="flex-shrink-0">
							<Play className="h-5 w-5 text-success-600 mr-2" />
						</div>
						<div className="w-0 flex-1">
							<p className="text-sm text-secondary-500 dark:text-white">
								Running Tasks
							</p>
							<p className="text-xl font-semibold text-secondary-900 dark:text-white">
								{overviewLoading ? "..." : overview?.runningTasks || 0}
							</p>
						</div>
					</div>
				</div>

				{/* Failed Tasks Card */}
				<div className="card p-4">
					<div className="flex items-center">
						<div className="flex-shrink-0">
							<XCircle className="h-5 w-5 text-red-600 mr-2" />
						</div>
						<div className="w-0 flex-1">
							<p className="text-sm text-secondary-500 dark:text-white">
								Failed Tasks
							</p>
							<p className="text-xl font-semibold text-secondary-900 dark:text-white">
								{overviewLoading ? "..." : overview?.failedTasks || 0}
							</p>
						</div>
					</div>
				</div>

				{/* Total Task Runs Card */}
				<div className="card p-4">
					<div className="flex items-center">
						<div className="flex-shrink-0">
							<Zap className="h-5 w-5 text-secondary-600 mr-2" />
						</div>
						<div className="w-0 flex-1">
							<p className="text-sm text-secondary-500 dark:text-white">
								Total Task Runs
							</p>
							<p className="text-xl font-semibold text-secondary-900 dark:text-white">
								{overviewLoading ? "..." : overview?.totalAutomations || 0}
							</p>
						</div>
					</div>
				</div>
			</div>

			{/* Tabs */}
			<div className="mb-6">
				<div className="border-b border-gray-200 dark:border-gray-700">
					<nav className="-mb-px flex space-x-8">
						{tabs.map((tab) => (
							<button
								type="button"
								key={tab.id}
								onClick={() => setActiveTab(tab.id)}
								className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
									activeTab === tab.id
										? "border-blue-500 text-blue-600 dark:text-blue-400"
										: "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
								}`}
							>
								<tab.icon className="h-4 w-4" />
								{tab.name}
							</button>
						))}
					</nav>
				</div>
			</div>

			{/* Tab Content */}
			{activeTab === "overview" && (
				<div className="card p-6">
					{overviewLoading ? (
						<div className="text-center py-8">
							<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
							<p className="mt-2 text-sm text-secondary-500">
								Loading automations...
							</p>
						</div>
					) : (
						<div className="overflow-x-auto">
							<table className="min-w-full divide-y divide-secondary-200 dark:divide-secondary-600">
								<thead className="bg-secondary-50 dark:bg-secondary-700">
									<tr>
										<th className="px-4 py-2 text-left text-xs font-medium text-secondary-500 dark:text-secondary-300 uppercase tracking-wider">
											Run
										</th>
										<th
											className="px-4 py-2 text-left text-xs font-medium text-secondary-500 dark:text-secondary-300 uppercase tracking-wider cursor-pointer hover:bg-secondary-100 dark:hover:bg-secondary-600"
											onClick={() => handleSort("name")}
										>
											<div className="flex items-center gap-1">
												Task
												{getSortIcon("name")}
											</div>
										</th>
										<th
											className="px-4 py-2 text-left text-xs font-medium text-secondary-500 dark:text-secondary-300 uppercase tracking-wider cursor-pointer hover:bg-secondary-100 dark:hover:bg-secondary-600"
											onClick={() => handleSort("schedule")}
										>
											<div className="flex items-center gap-1">
												Frequency
												{getSortIcon("schedule")}
											</div>
										</th>
										<th
											className="px-4 py-2 text-left text-xs font-medium text-secondary-500 dark:text-secondary-300 uppercase tracking-wider cursor-pointer hover:bg-secondary-100 dark:hover:bg-secondary-600"
											onClick={() => handleSort("lastRunTimestamp")}
										>
											<div className="flex items-center gap-1">
												Last Run
												{getSortIcon("lastRunTimestamp")}
											</div>
										</th>
										<th
											className="px-4 py-2 text-left text-xs font-medium text-secondary-500 dark:text-secondary-300 uppercase tracking-wider cursor-pointer hover:bg-secondary-100 dark:hover:bg-secondary-600"
											onClick={() => handleSort("nextRunTimestamp")}
										>
											<div className="flex items-center gap-1">
												Next Run
												{getSortIcon("nextRunTimestamp")}
											</div>
										</th>
										<th
											className="px-4 py-2 text-left text-xs font-medium text-secondary-500 dark:text-secondary-300 uppercase tracking-wider cursor-pointer hover:bg-secondary-100 dark:hover:bg-secondary-600"
											onClick={() => handleSort("status")}
										>
											<div className="flex items-center gap-1">
												Status
												{getSortIcon("status")}
											</div>
										</th>
									</tr>
								</thead>
								<tbody className="bg-white dark:bg-secondary-800 divide-y divide-secondary-200 dark:divide-secondary-600">
									{sortedAutomations.map((automation) => (
										<tr
											key={automation.queue}
											className="hover:bg-secondary-50 dark:hover:bg-secondary-700"
										>
											<td className="px-4 py-2 whitespace-nowrap">
												{automation.schedule !== "Manual only" ? (
													<button
														type="button"
														onClick={() => {
															if (automation.queue.includes("github")) {
																triggerManualJob("github");
															} else if (automation.queue.includes("session")) {
																triggerManualJob("sessions");
															} else if (automation.queue.includes("echo")) {
																triggerManualJob("echo", {
																	message: "Manual trigger from table",
																});
															} else if (
																automation.queue.includes("orphaned-repo")
															) {
																triggerManualJob("orphaned-repos");
															}
														}}
														className="inline-flex items-center justify-center w-6 h-6 border border-transparent rounded text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-200"
														title="Run Now"
													>
														<Play className="h-3 w-3" />
													</button>
												) : (
													<button
														type="button"
														onClick={() => {
															if (automation.queue.includes("echo")) {
																triggerManualJob("echo", {
																	message: "Manual trigger from table",
																});
															}
														}}
														className="inline-flex items-center justify-center w-6 h-6 border border-transparent rounded text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-200"
														title="Trigger"
													>
														<Play className="h-3 w-3" />
													</button>
												)}
											</td>
											<td className="px-4 py-2 whitespace-nowrap">
												<div>
													<div className="text-sm font-medium text-secondary-900 dark:text-white">
														{automation.name}
													</div>
													<div className="text-xs text-secondary-500 dark:text-secondary-400">
														{automation.description}
													</div>
												</div>
											</td>
											<td className="px-4 py-2 whitespace-nowrap text-sm text-secondary-900 dark:text-white">
												{automation.schedule}
											</td>
											<td className="px-4 py-2 whitespace-nowrap text-sm text-secondary-900 dark:text-white">
												{automation.lastRun}
											</td>
											<td className="px-4 py-2 whitespace-nowrap text-sm text-secondary-900 dark:text-white">
												{getNextRunTime(
													automation.schedule,
													automation.lastRun,
												)}
											</td>
											<td className="px-4 py-2 whitespace-nowrap">
												{getStatusBadge(automation.status)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</div>
			)}
		</div>
	);
};

export default Automation;
