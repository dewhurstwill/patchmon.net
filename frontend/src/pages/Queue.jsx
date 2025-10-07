import {
	Activity,
	AlertCircle,
	CheckCircle,
	Clock,
	Download,
	Eye,
	Filter,
	Package,
	Pause,
	Play,
	RefreshCw,
	Search,
	Server,
	XCircle,
} from "lucide-react";
import { useState } from "react";

const Queue = () => {
	const [activeTab, setActiveTab] = useState("server");
	const [filterStatus, setFilterStatus] = useState("all");
	const [searchQuery, setSearchQuery] = useState("");

	// Mock data for demonstration
	const serverQueueData = [
		{
			id: 1,
			type: "Server Update Check",
			description: "Check for server updates from GitHub",
			status: "running",
			priority: "high",
			createdAt: "2024-01-15 10:30:00",
			estimatedCompletion: "2024-01-15 10:35:00",
			progress: 75,
			retryCount: 0,
			maxRetries: 3,
		},
		{
			id: 2,
			type: "Session Cleanup",
			description: "Clear expired login sessions",
			status: "pending",
			priority: "medium",
			createdAt: "2024-01-15 10:25:00",
			estimatedCompletion: "2024-01-15 10:40:00",
			progress: 0,
			retryCount: 0,
			maxRetries: 2,
		},
		{
			id: 3,
			type: "Database Optimization",
			description: "Optimize database indexes and cleanup old records",
			status: "completed",
			priority: "low",
			createdAt: "2024-01-15 09:00:00",
			completedAt: "2024-01-15 09:45:00",
			progress: 100,
			retryCount: 0,
			maxRetries: 1,
		},
		{
			id: 4,
			type: "Backup Creation",
			description: "Create system backup",
			status: "failed",
			priority: "high",
			createdAt: "2024-01-15 08:00:00",
			errorMessage: "Insufficient disk space",
			progress: 45,
			retryCount: 2,
			maxRetries: 3,
		},
	];

	const agentQueueData = [
		{
			id: 1,
			hostname: "web-server-01",
			ip: "192.168.1.100",
			type: "Agent Update Collection",
			description: "Agent v1.2.7 → v1.2.8",
			status: "pending",
			priority: "medium",
			lastCommunication: "2024-01-15 10:00:00",
			nextExpectedCommunication: "2024-01-15 11:00:00",
			currentVersion: "1.2.7",
			targetVersion: "1.2.8",
			retryCount: 0,
			maxRetries: 5,
		},
		{
			id: 2,
			hostname: "db-server-02",
			ip: "192.168.1.101",
			type: "Data Collection",
			description: "Collect package and system information",
			status: "running",
			priority: "high",
			lastCommunication: "2024-01-15 10:15:00",
			nextExpectedCommunication: "2024-01-15 11:15:00",
			currentVersion: "1.2.8",
			targetVersion: "1.2.8",
			retryCount: 0,
			maxRetries: 3,
		},
		{
			id: 3,
			hostname: "app-server-03",
			ip: "192.168.1.102",
			type: "Agent Update Collection",
			description: "Agent v1.2.6 → v1.2.8",
			status: "completed",
			priority: "low",
			lastCommunication: "2024-01-15 09:30:00",
			completedAt: "2024-01-15 09:45:00",
			currentVersion: "1.2.8",
			targetVersion: "1.2.8",
			retryCount: 0,
			maxRetries: 5,
		},
		{
			id: 4,
			hostname: "test-server-04",
			ip: "192.168.1.103",
			type: "Data Collection",
			description: "Collect package and system information",
			status: "failed",
			priority: "medium",
			lastCommunication: "2024-01-15 08:00:00",
			errorMessage: "Connection timeout",
			retryCount: 3,
			maxRetries: 3,
		},
	];

	const patchQueueData = [
		{
			id: 1,
			hostname: "web-server-01",
			ip: "192.168.1.100",
			packages: ["nginx", "openssl", "curl"],
			type: "Security Updates",
			description: "Apply critical security patches",
			status: "pending",
			priority: "high",
			scheduledFor: "2024-01-15 19:00:00",
			lastCommunication: "2024-01-15 18:00:00",
			nextExpectedCommunication: "2024-01-15 19:00:00",
			retryCount: 0,
			maxRetries: 3,
		},
		{
			id: 2,
			hostname: "db-server-02",
			ip: "192.168.1.101",
			packages: ["postgresql", "python3"],
			type: "Feature Updates",
			description: "Update database and Python packages",
			status: "running",
			priority: "medium",
			scheduledFor: "2024-01-15 20:00:00",
			lastCommunication: "2024-01-15 19:15:00",
			nextExpectedCommunication: "2024-01-15 20:15:00",
			retryCount: 0,
			maxRetries: 2,
		},
		{
			id: 3,
			hostname: "app-server-03",
			ip: "192.168.1.102",
			packages: ["nodejs", "npm"],
			type: "Maintenance Updates",
			description: "Update Node.js and npm packages",
			status: "completed",
			priority: "low",
			scheduledFor: "2024-01-15 18:30:00",
			completedAt: "2024-01-15 18:45:00",
			retryCount: 0,
			maxRetries: 2,
		},
		{
			id: 4,
			hostname: "test-server-04",
			ip: "192.168.1.103",
			packages: ["docker", "docker-compose"],
			type: "Security Updates",
			description: "Update Docker components",
			status: "failed",
			priority: "high",
			scheduledFor: "2024-01-15 17:00:00",
			errorMessage: "Package conflicts detected",
			retryCount: 2,
			maxRetries: 3,
		},
	];

	const getStatusIcon = (status) => {
		switch (status) {
			case "running":
				return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
			case "completed":
				return <CheckCircle className="h-4 w-4 text-green-500" />;
			case "failed":
				return <XCircle className="h-4 w-4 text-red-500" />;
			case "pending":
				return <Clock className="h-4 w-4 text-yellow-500" />;
			case "paused":
				return <Pause className="h-4 w-4 text-gray-500" />;
			default:
				return <AlertCircle className="h-4 w-4 text-gray-500" />;
		}
	};

	const getStatusColor = (status) => {
		switch (status) {
			case "running":
				return "bg-blue-100 text-blue-800";
			case "completed":
				return "bg-green-100 text-green-800";
			case "failed":
				return "bg-red-100 text-red-800";
			case "pending":
				return "bg-yellow-100 text-yellow-800";
			case "paused":
				return "bg-gray-100 text-gray-800";
			default:
				return "bg-gray-100 text-gray-800";
		}
	};

	const getPriorityColor = (priority) => {
		switch (priority) {
			case "high":
				return "bg-red-100 text-red-800";
			case "medium":
				return "bg-yellow-100 text-yellow-800";
			case "low":
				return "bg-green-100 text-green-800";
			default:
				return "bg-gray-100 text-gray-800";
		}
	};

	const filteredData = (data) => {
		let filtered = data;

		if (filterStatus !== "all") {
			filtered = filtered.filter((item) => item.status === filterStatus);
		}

		if (searchQuery) {
			filtered = filtered.filter(
				(item) =>
					item.hostname?.toLowerCase().includes(searchQuery.toLowerCase()) ||
					item.type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
					item.description?.toLowerCase().includes(searchQuery.toLowerCase()),
			);
		}

		return filtered;
	};

	const tabs = [
		{
			id: "server",
			name: "Server Queue",
			icon: Server,
			data: serverQueueData,
			count: serverQueueData.length,
		},
		{
			id: "agent",
			name: "Agent Queue",
			icon: Download,
			data: agentQueueData,
			count: agentQueueData.length,
		},
		{
			id: "patch",
			name: "Patch Management",
			icon: Package,
			data: patchQueueData,
			count: patchQueueData.length,
		},
	];

	const renderServerQueueItem = (item) => (
		<div
			key={item.id}
			className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow"
		>
			<div className="flex items-start justify-between">
				<div className="flex-1">
					<div className="flex items-center gap-3 mb-2">
						{getStatusIcon(item.status)}
						<h3 className="font-medium text-gray-900 dark:text-white">
							{item.type}
						</h3>
						<span
							className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(item.status)}`}
						>
							{item.status}
						</span>
						<span
							className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(item.priority)}`}
						>
							{item.priority}
						</span>
					</div>
					<p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
						{item.description}
					</p>

					{item.status === "running" && (
						<div className="mb-3">
							<div className="flex justify-between text-xs text-gray-500 mb-1">
								<span>Progress</span>
								<span>{item.progress}%</span>
							</div>
							<div className="w-full bg-gray-200 rounded-full h-2">
								<div
									className="bg-blue-600 h-2 rounded-full transition-all duration-300"
									style={{ width: `${item.progress}%` }}
								></div>
							</div>
						</div>
					)}

					<div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
						<div>
							<span className="font-medium">Created:</span> {item.createdAt}
						</div>
						{item.status === "running" && (
							<div>
								<span className="font-medium">ETA:</span>{" "}
								{item.estimatedCompletion}
							</div>
						)}
						{item.status === "completed" && (
							<div>
								<span className="font-medium">Completed:</span>{" "}
								{item.completedAt}
							</div>
						)}
						{item.status === "failed" && (
							<div className="col-span-2">
								<span className="font-medium">Error:</span> {item.errorMessage}
							</div>
						)}
					</div>

					{item.retryCount > 0 && (
						<div className="mt-2 text-xs text-orange-600">
							Retries: {item.retryCount}/{item.maxRetries}
						</div>
					)}
				</div>

				<div className="flex gap-2 ml-4">
					{item.status === "running" && (
						<button
							type="button"
							className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
						>
							<Pause className="h-4 w-4" />
						</button>
					)}
					{item.status === "paused" && (
						<button
							type="button"
							className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
						>
							<Play className="h-4 w-4" />
						</button>
					)}
					{item.status === "failed" && (
						<button
							type="button"
							className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
						>
							<RefreshCw className="h-4 w-4" />
						</button>
					)}
					<button
						type="button"
						className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
					>
						<Eye className="h-4 w-4" />
					</button>
				</div>
			</div>
		</div>
	);

	const renderAgentQueueItem = (item) => (
		<div
			key={item.id}
			className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow"
		>
			<div className="flex items-start justify-between">
				<div className="flex-1">
					<div className="flex items-center gap-3 mb-2">
						{getStatusIcon(item.status)}
						<h3 className="font-medium text-gray-900 dark:text-white">
							{item.hostname}
						</h3>
						<span
							className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(item.status)}`}
						>
							{item.status}
						</span>
						<span
							className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(item.priority)}`}
						>
							{item.priority}
						</span>
					</div>
					<p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
						{item.type}
					</p>
					<p className="text-sm text-gray-500 mb-3">{item.description}</p>

					{item.type === "Agent Update Collection" && (
						<div className="mb-3 p-2 bg-gray-50 dark:bg-gray-700 rounded">
							<div className="text-xs text-gray-600 dark:text-gray-400">
								<span className="font-medium">Version:</span>{" "}
								{item.currentVersion} → {item.targetVersion}
							</div>
						</div>
					)}

					<div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
						<div>
							<span className="font-medium">IP:</span> {item.ip}
						</div>
						<div>
							<span className="font-medium">Last Comm:</span>{" "}
							{item.lastCommunication}
						</div>
						<div>
							<span className="font-medium">Next Expected:</span>{" "}
							{item.nextExpectedCommunication}
						</div>
						{item.status === "completed" && (
							<div>
								<span className="font-medium">Completed:</span>{" "}
								{item.completedAt}
							</div>
						)}
						{item.status === "failed" && (
							<div className="col-span-2">
								<span className="font-medium">Error:</span> {item.errorMessage}
							</div>
						)}
					</div>

					{item.retryCount > 0 && (
						<div className="mt-2 text-xs text-orange-600">
							Retries: {item.retryCount}/{item.maxRetries}
						</div>
					)}
				</div>

				<div className="flex gap-2 ml-4">
					{item.status === "failed" && (
						<button
							type="button"
							className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
						>
							<RefreshCw className="h-4 w-4" />
						</button>
					)}
					<button
						type="button"
						className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
					>
						<Eye className="h-4 w-4" />
					</button>
				</div>
			</div>
		</div>
	);

	const renderPatchQueueItem = (item) => (
		<div
			key={item.id}
			className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow"
		>
			<div className="flex items-start justify-between">
				<div className="flex-1">
					<div className="flex items-center gap-3 mb-2">
						{getStatusIcon(item.status)}
						<h3 className="font-medium text-gray-900 dark:text-white">
							{item.hostname}
						</h3>
						<span
							className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(item.status)}`}
						>
							{item.status}
						</span>
						<span
							className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(item.priority)}`}
						>
							{item.priority}
						</span>
					</div>
					<p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
						{item.type}
					</p>
					<p className="text-sm text-gray-500 mb-3">{item.description}</p>

					<div className="mb-3">
						<div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
							<span className="font-medium">Packages:</span>
						</div>
						<div className="flex flex-wrap gap-1">
							{item.packages.map((pkg) => (
								<span
									key={pkg}
									className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
								>
									{pkg}
								</span>
							))}
						</div>
					</div>

					<div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
						<div>
							<span className="font-medium">IP:</span> {item.ip}
						</div>
						<div>
							<span className="font-medium">Scheduled:</span>{" "}
							{item.scheduledFor}
						</div>
						<div>
							<span className="font-medium">Last Comm:</span>{" "}
							{item.lastCommunication}
						</div>
						<div>
							<span className="font-medium">Next Expected:</span>{" "}
							{item.nextExpectedCommunication}
						</div>
						{item.status === "completed" && (
							<div>
								<span className="font-medium">Completed:</span>{" "}
								{item.completedAt}
							</div>
						)}
						{item.status === "failed" && (
							<div className="col-span-2">
								<span className="font-medium">Error:</span> {item.errorMessage}
							</div>
						)}
					</div>

					{item.retryCount > 0 && (
						<div className="mt-2 text-xs text-orange-600">
							Retries: {item.retryCount}/{item.maxRetries}
						</div>
					)}
				</div>

				<div className="flex gap-2 ml-4">
					{item.status === "failed" && (
						<button
							type="button"
							className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
						>
							<RefreshCw className="h-4 w-4" />
						</button>
					)}
					<button
						type="button"
						className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
					>
						<Eye className="h-4 w-4" />
					</button>
				</div>
			</div>
		</div>
	);

	const currentTab = tabs.find((tab) => tab.id === activeTab);
	const filteredItems = filteredData(currentTab?.data || []);

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-900">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				{/* Header */}
				<div className="mb-8">
					<h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
						Queue Management
					</h1>
					<p className="text-gray-600 dark:text-gray-400">
						Monitor and manage server operations, agent communications, and
						patch deployments
					</p>
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
									<span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full text-xs">
										{tab.count}
									</span>
								</button>
							))}
						</nav>
					</div>
				</div>

				{/* Filters and Search */}
				<div className="mb-6 flex flex-col sm:flex-row gap-4">
					<div className="flex-1">
						<div className="relative">
							<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
							<input
								type="text"
								placeholder="Search queues..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							/>
						</div>
					</div>
					<div className="flex gap-2">
						<select
							value={filterStatus}
							onChange={(e) => setFilterStatus(e.target.value)}
							className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						>
							<option value="all">All Status</option>
							<option value="pending">Pending</option>
							<option value="running">Running</option>
							<option value="completed">Completed</option>
							<option value="failed">Failed</option>
							<option value="paused">Paused</option>
						</select>
						<button
							type="button"
							className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
						>
							<Filter className="h-4 w-4" />
							More Filters
						</button>
					</div>
				</div>

				{/* Queue Items */}
				<div className="space-y-4">
					{filteredItems.length === 0 ? (
						<div className="text-center py-12">
							<Activity className="mx-auto h-12 w-12 text-gray-400" />
							<h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
								No queue items found
							</h3>
							<p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
								{searchQuery
									? "Try adjusting your search criteria"
									: "No items match the current filters"}
							</p>
						</div>
					) : (
						filteredItems.map((item) => {
							switch (activeTab) {
								case "server":
									return renderServerQueueItem(item);
								case "agent":
									return renderAgentQueueItem(item);
								case "patch":
									return renderPatchQueueItem(item);
								default:
									return null;
							}
						})
					)}
				</div>
			</div>
		</div>
	);
};

export default Queue;
