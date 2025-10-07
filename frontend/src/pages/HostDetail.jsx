import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Activity,
	AlertTriangle,
	ArrowLeft,
	Calendar,
	CheckCircle,
	ChevronDown,
	ChevronUp,
	Clock,
	Copy,
	Cpu,
	Eye,
	EyeOff,
	HardDrive,
	Key,
	MemoryStick,
	Monitor,
	Package,
	RefreshCw,
	Server,
	Shield,
	Terminal,
	Trash2,
	Wifi,
	X,
} from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import InlineEdit from "../components/InlineEdit";
import {
	adminHostsAPI,
	dashboardAPI,
	formatDate,
	formatRelativeTime,
	settingsAPI,
} from "../utils/api";
import { OSIcon } from "../utils/osIcons.jsx";

const HostDetail = () => {
	const { hostId } = useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [showCredentialsModal, setShowCredentialsModal] = useState(false);
	const [showDeleteModal, setShowDeleteModal] = useState(false);
	const [activeTab, setActiveTab] = useState("host");
	const [_forceInstall, _setForceInstall] = useState(false);
	const [historyPage, setHistoryPage] = useState(0);
	const [historyLimit] = useState(10);

	const {
		data: host,
		isLoading,
		error,
		refetch,
		isFetching,
	} = useQuery({
		queryKey: ["host", hostId, historyPage, historyLimit],
		queryFn: () =>
			dashboardAPI
				.getHostDetail(hostId, {
					limit: historyLimit,
					offset: historyPage * historyLimit,
				})
				.then((res) => res.data),
		staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh longer
		refetchOnWindowFocus: false, // Don't refetch when window regains focus
	});

	// Tab change handler
	const handleTabChange = (tabName) => {
		setActiveTab(tabName);
	};

	// Auto-show credentials modal for new/pending hosts
	useEffect(() => {
		if (host && host.status === "pending") {
			setShowCredentialsModal(true);
		}
	}, [host]);

	const deleteHostMutation = useMutation({
		mutationFn: (hostId) => adminHostsAPI.delete(hostId),
		onSuccess: () => {
			queryClient.invalidateQueries(["hosts"]);
			navigate("/hosts");
		},
	});

	// Toggle agent auto-update mutation (updates PatchMon agent script, not system packages)
	const toggleAutoUpdateMutation = useMutation({
		mutationFn: (auto_update) =>
			adminHostsAPI
				.toggleAutoUpdate(hostId, auto_update)
				.then((res) => res.data),
		onSuccess: () => {
			queryClient.invalidateQueries(["host", hostId]);
			queryClient.invalidateQueries(["hosts"]);
		},
	});

	const updateFriendlyNameMutation = useMutation({
		mutationFn: (friendlyName) =>
			adminHostsAPI
				.updateFriendlyName(hostId, friendlyName)
				.then((res) => res.data),
		onSuccess: () => {
			queryClient.invalidateQueries(["host", hostId]);
			queryClient.invalidateQueries(["hosts"]);
		},
	});

	const updateNotesMutation = useMutation({
		mutationFn: ({ hostId, notes }) =>
			adminHostsAPI.updateNotes(hostId, notes).then((res) => res.data),
		onSuccess: () => {
			queryClient.invalidateQueries(["host", hostId]);
			queryClient.invalidateQueries(["hosts"]);
		},
	});

	const handleDeleteHost = async () => {
		if (
			window.confirm(
				`Are you sure you want to delete host "${host.friendly_name}"? This action cannot be undone.`,
			)
		) {
			try {
				await deleteHostMutation.mutateAsync(hostId);
			} catch (error) {
				console.error("Failed to delete host:", error);
				alert("Failed to delete host");
			}
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
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<Link
							to="/hosts"
							className="text-secondary-500 hover:text-secondary-700"
						>
							<ArrowLeft className="h-5 w-5" />
						</Link>
					</div>
				</div>

				<div className="bg-danger-50 border border-danger-200 rounded-md p-4">
					<div className="flex">
						<AlertTriangle className="h-5 w-5 text-danger-400" />
						<div className="ml-3">
							<h3 className="text-sm font-medium text-danger-800">
								Error loading host
							</h3>
							<p className="text-sm text-danger-700 mt-1">
								{error.message || "Failed to load host details"}
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
			</div>
		);
	}

	if (!host) {
		return (
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<Link
							to="/hosts"
							className="text-secondary-500 hover:text-secondary-700"
						>
							<ArrowLeft className="h-5 w-5" />
						</Link>
					</div>
				</div>

				<div className="card p-8 text-center">
					<Server className="h-12 w-12 text-secondary-400 mx-auto mb-4" />
					<h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-2">
						Host Not Found
					</h3>
					<p className="text-secondary-600 dark:text-secondary-300">
						The requested host could not be found.
					</p>
				</div>
			</div>
		);
	}

	const getStatusColor = (isStale, needsUpdate) => {
		if (isStale) return "text-danger-600";
		if (needsUpdate) return "text-warning-600";
		return "text-success-600";
	};

	const getStatusIcon = (isStale, needsUpdate) => {
		if (isStale) return <AlertTriangle className="h-5 w-5" />;
		if (needsUpdate) return <Clock className="h-5 w-5" />;
		return <CheckCircle className="h-5 w-5" />;
	};

	const getStatusText = (isStale, needsUpdate) => {
		if (isStale) return "Stale";
		if (needsUpdate) return "Needs Updates";
		return "Up to Date";
	};

	const isStale = Date.now() - new Date(host.last_update) > 24 * 60 * 60 * 1000;

	return (
		<div className="h-screen flex flex-col">
			{/* Header */}
			<div className="flex items-center justify-between mb-4 pb-4 border-b border-secondary-200 dark:border-secondary-600">
				<div className="flex items-center gap-3">
					<Link
						to="/hosts"
						className="text-secondary-500 hover:text-secondary-700 dark:text-secondary-400 dark:hover:text-secondary-200"
					>
						<ArrowLeft className="h-5 w-5" />
					</Link>
					<h1 className="text-xl font-semibold text-secondary-900 dark:text-white">
						{host.friendly_name}
					</h1>
					{host.system_uptime && (
						<div className="flex items-center gap-1 text-sm text-secondary-600 dark:text-secondary-400">
							<Clock className="h-4 w-4" />
							<span className="text-xs font-medium">Uptime:</span>
							<span>{host.system_uptime}</span>
						</div>
					)}
					<div className="flex items-center gap-1 text-sm text-secondary-600 dark:text-secondary-400">
						<Clock className="h-4 w-4" />
						<span className="text-xs font-medium">Last updated:</span>
						<span>{formatRelativeTime(host.last_update)}</span>
					</div>
					<div
						className={`flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(isStale, host.stats.outdated_packages > 0)}`}
					>
						{getStatusIcon(isStale, host.stats.outdated_packages > 0)}
						{getStatusText(isStale, host.stats.outdated_packages > 0)}
					</div>
				</div>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => refetch()}
						disabled={isFetching}
						className="btn-outline flex items-center gap-2 text-sm"
						title="Refresh host data"
					>
						<RefreshCw
							className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
						/>
						{isFetching ? "Refreshing..." : "Refresh"}
					</button>
					<button
						type="button"
						onClick={() => setShowCredentialsModal(true)}
						className="btn-outline flex items-center gap-2 text-sm"
					>
						<Key className="h-4 w-4" />
						Deploy Agent
					</button>
					<button
						type="button"
						onClick={() => setShowDeleteModal(true)}
						className="btn-danger flex items-center gap-2 text-sm"
					>
						<Trash2 className="h-4 w-4" />
						Delete
					</button>
				</div>
			</div>

			{/* Package Statistics Cards */}
			<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
				<button
					type="button"
					onClick={() => navigate(`/packages?host=${hostId}`)}
					className="card p-4 cursor-pointer hover:shadow-card-hover dark:hover:shadow-card-hover-dark transition-shadow duration-200 text-left w-full"
					title="View all packages for this host"
				>
					<div className="flex items-center">
						<Package className="h-5 w-5 text-primary-600 mr-2" />
						<div>
							<p className="text-sm text-secondary-500 dark:text-white">
								Total Installed
							</p>
							<p className="text-xl font-semibold text-secondary-900 dark:text-white">
								{host.stats.total_packages}
							</p>
						</div>
					</div>
				</button>

				<button
					type="button"
					onClick={() => navigate(`/packages?host=${hostId}&filter=outdated`)}
					className="card p-4 cursor-pointer hover:shadow-card-hover dark:hover:shadow-card-hover-dark transition-shadow duration-200 text-left w-full"
					title="View outdated packages for this host"
				>
					<div className="flex items-center">
						<Clock className="h-5 w-5 text-warning-600 mr-2" />
						<div>
							<p className="text-sm text-secondary-500 dark:text-white">
								Outdated Packages
							</p>
							<p className="text-xl font-semibold text-secondary-900 dark:text-white">
								{host.stats.outdated_packages}
							</p>
						</div>
					</div>
				</button>

				<button
					type="button"
					onClick={() => navigate(`/packages?host=${hostId}&filter=security`)}
					className="card p-4 cursor-pointer hover:shadow-card-hover dark:hover:shadow-card-hover-dark transition-shadow duration-200 text-left w-full"
					title="View security packages for this host"
				>
					<div className="flex items-center">
						<Shield className="h-5 w-5 text-danger-600 mr-2" />
						<div>
							<p className="text-sm text-secondary-500 dark:text-white">
								Security Updates
							</p>
							<p className="text-xl font-semibold text-secondary-900 dark:text-white">
								{host.stats.security_updates}
							</p>
						</div>
					</div>
				</button>
			</div>

			{/* Main Content - Full Width */}
			<div className="flex-1 overflow-hidden">
				{/* Host Info, Hardware, Network, System Info in Tabs */}
				<div className="card">
					<div className="flex border-b border-secondary-200 dark:border-secondary-600">
						<button
							type="button"
							onClick={() => handleTabChange("host")}
							className={`px-4 py-2 text-sm font-medium ${
								activeTab === "host"
									? "text-primary-600 dark:text-primary-400 border-b-2 border-primary-500"
									: "text-secondary-500 dark:text-secondary-400 hover:text-secondary-700 dark:hover:text-secondary-300"
							}`}
						>
							Host Info
						</button>
						<button
							type="button"
							onClick={() => handleTabChange("network")}
							className={`px-4 py-2 text-sm font-medium ${
								activeTab === "network"
									? "text-primary-600 dark:text-primary-400 border-b-2 border-primary-500"
									: "text-secondary-500 dark:text-secondary-400 hover:text-secondary-700 dark:hover:text-secondary-300"
							}`}
						>
							Network
						</button>
						<button
							type="button"
							onClick={() => handleTabChange("system")}
							className={`px-4 py-2 text-sm font-medium ${
								activeTab === "system"
									? "text-primary-600 dark:text-primary-400 border-b-2 border-primary-500"
									: "text-secondary-500 dark:text-secondary-400 hover:text-secondary-700 dark:hover:text-secondary-300"
							}`}
						>
							System
						</button>
						<button
							type="button"
							onClick={() => handleTabChange("history")}
							className={`px-4 py-2 text-sm font-medium ${
								activeTab === "history"
									? "text-primary-600 dark:text-primary-400 border-b-2 border-primary-500"
									: "text-secondary-500 dark:text-secondary-400 hover:text-secondary-700 dark:hover:text-secondary-300"
							}`}
						>
							Agent History
						</button>
						<button
							type="button"
							onClick={() => handleTabChange("notes")}
							className={`px-4 py-2 text-sm font-medium ${
								activeTab === "notes"
									? "text-primary-600 dark:text-primary-400 border-b-2 border-primary-500"
									: "text-secondary-500 dark:text-secondary-400 hover:text-secondary-700 dark:hover:text-secondary-300"
							}`}
						>
							Notes
						</button>
					</div>

					<div className="p-4">
						{/* Host Information */}
						{activeTab === "host" && (
							<div className="space-y-4">
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div>
										<p className="text-xs text-secondary-500 dark:text-secondary-300 mb-1.5">
											Friendly Name
										</p>
										<InlineEdit
											value={host.friendly_name}
											onSave={(newName) =>
												updateFriendlyNameMutation.mutate(newName)
											}
											placeholder="Enter friendly name..."
											maxLength={100}
											validate={(value) => {
												if (!value.trim()) return "Friendly name is required";
												if (value.trim().length < 1)
													return "Friendly name must be at least 1 character";
												if (value.trim().length > 100)
													return "Friendly name must be less than 100 characters";
												return null;
											}}
											className="w-full text-sm"
										/>
									</div>

									{host.hostname && (
										<div>
											<p className="text-xs text-secondary-500 dark:text-secondary-300 mb-1.5">
												System Hostname
											</p>
											<p className="font-medium text-secondary-900 dark:text-white font-mono text-sm">
												{host.hostname}
											</p>
										</div>
									)}

									{host.machine_id && (
										<div>
											<p className="text-xs text-secondary-500 dark:text-secondary-300 mb-1.5">
												Machine ID
											</p>
											<p className="font-medium text-secondary-900 dark:text-white font-mono text-sm break-all">
												{host.machine_id}
											</p>
										</div>
									)}

									<div>
										<p className="text-xs text-secondary-500 dark:text-secondary-300 mb-1.5">
											Host Group
										</p>
										{host.host_groups ? (
											<span
												className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
												style={{ backgroundColor: host.host_groups.color }}
											>
												{host.host_groups.name}
											</span>
										) : (
											<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-secondary-100 dark:bg-secondary-700 text-secondary-800 dark:text-secondary-200">
												Ungrouped
											</span>
										)}
									</div>

									<div>
										<p className="text-xs text-secondary-500 dark:text-secondary-300 mb-1.5">
											Operating System
										</p>
										<div className="flex items-center gap-2">
											<OSIcon osType={host.os_type} className="h-4 w-4" />
											<p className="font-medium text-secondary-900 dark:text-white text-sm">
												{host.os_type} {host.os_version}
											</p>
										</div>
									</div>

									<div>
										<p className="text-xs text-secondary-500 dark:text-secondary-300 mb-1.5">
											Agent Version
										</p>
										<p className="font-medium text-secondary-900 dark:text-white text-sm">
											{host.agent_version || "Unknown"}
										</p>
									</div>

									<div>
										<p className="text-xs text-secondary-500 dark:text-secondary-300 mb-1.5">
											Agent Auto-update
										</p>
										<button
											type="button"
											onClick={() =>
												toggleAutoUpdateMutation.mutate(!host.auto_update)
											}
											disabled={toggleAutoUpdateMutation.isPending}
											className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
												host.auto_update
													? "bg-primary-600 dark:bg-primary-500"
													: "bg-secondary-200 dark:bg-secondary-600"
											}`}
										>
											<span
												className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
													host.auto_update ? "translate-x-5" : "translate-x-1"
												}`}
											/>
										</button>
									</div>
								</div>
							</div>
						)}

						{/* Network Information */}
						{activeTab === "network" &&
							(host.ip ||
								host.gateway_ip ||
								host.dns_servers ||
								host.network_interfaces) && (
								<div className="space-y-4">
									<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
										{host.ip && (
											<div>
												<p className="text-xs text-secondary-500 dark:text-secondary-300">
													IP Address
												</p>
												<p className="font-medium text-secondary-900 dark:text-white font-mono text-sm">
													{host.ip}
												</p>
											</div>
										)}

										{host.gateway_ip && (
											<div>
												<p className="text-xs text-secondary-500 dark:text-secondary-300">
													Gateway IP
												</p>
												<p className="font-medium text-secondary-900 dark:text-white font-mono text-sm">
													{host.gateway_ip}
												</p>
											</div>
										)}

										{host.dns_servers &&
											Array.isArray(host.dns_servers) &&
											host.dns_servers.length > 0 && (
												<div>
													<p className="text-xs text-secondary-500 dark:text-secondary-300">
														DNS Servers
													</p>
													<div className="space-y-1">
														{host.dns_servers.map((dns) => (
															<p
																key={dns}
																className="font-medium text-secondary-900 dark:text-white font-mono text-sm"
															>
																{dns}
															</p>
														))}
													</div>
												</div>
											)}

										{host.network_interfaces &&
											Array.isArray(host.network_interfaces) &&
											host.network_interfaces.length > 0 && (
												<div>
													<p className="text-xs text-secondary-500 dark:text-secondary-300">
														Network Interfaces
													</p>
													<div className="space-y-1">
														{host.network_interfaces.map((iface) => (
															<p
																key={iface.name}
																className="font-medium text-secondary-900 dark:text-white text-sm"
															>
																{iface.name}
															</p>
														))}
													</div>
												</div>
											)}
									</div>
								</div>
							)}

						{/* System Information */}
						{activeTab === "system" && (
							<div className="space-y-6">
								{/* Basic System Information */}
								{(host.kernel_version ||
									host.selinux_status ||
									host.architecture) && (
									<div>
										<h4 className="text-sm font-medium text-secondary-900 dark:text-white mb-3 flex items-center gap-2">
											<Terminal className="h-4 w-4 text-primary-600 dark:text-primary-400" />
											System Information
										</h4>
										<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
											{host.architecture && (
												<div>
													<p className="text-xs text-secondary-500 dark:text-secondary-300">
														Architecture
													</p>
													<p className="font-medium text-secondary-900 dark:text-white text-sm">
														{host.architecture}
													</p>
												</div>
											)}

											{host.kernel_version && (
												<div>
													<p className="text-xs text-secondary-500 dark:text-secondary-300">
														Kernel Version
													</p>
													<p className="font-medium text-secondary-900 dark:text-white font-mono text-sm">
														{host.kernel_version}
													</p>
												</div>
											)}

											{/* Empty div to push SELinux status to the right */}
											<div></div>

											{host.selinux_status && (
												<div>
													<p className="text-xs text-secondary-500 dark:text-secondary-300">
														SELinux Status
													</p>
													<span
														className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
															host.selinux_status === "enabled"
																? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
																: host.selinux_status === "permissive"
																	? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
																	: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
														}`}
													>
														{host.selinux_status}
													</span>
												</div>
											)}
										</div>
									</div>
								)}

								{/* Resource Information */}
								{(host.system_uptime ||
									host.cpu_model ||
									host.cpu_cores ||
									host.ram_installed ||
									host.swap_size !== undefined ||
									(host.load_average &&
										Array.isArray(host.load_average) &&
										host.load_average.length > 0 &&
										host.load_average.some((load) => load != null)) ||
									(host.disk_details &&
										Array.isArray(host.disk_details) &&
										host.disk_details.length > 0)) && (
									<div className="pt-4 border-t border-secondary-200 dark:border-secondary-600">
										<h4 className="text-sm font-medium text-secondary-900 dark:text-white mb-3 flex items-center gap-2">
											<Monitor className="h-4 w-4 text-primary-600 dark:text-primary-400" />
											Resource Information
										</h4>

										{/* System Overview */}
										<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
											{/* System Uptime */}
											{host.system_uptime && (
												<div className="bg-secondary-50 dark:bg-secondary-700 p-4 rounded-lg">
													<div className="flex items-center gap-2 mb-2">
														<Clock className="h-4 w-4 text-primary-600 dark:text-primary-400" />
														<p className="text-xs text-secondary-500 dark:text-secondary-300">
															System Uptime
														</p>
													</div>
													<p className="font-medium text-secondary-900 dark:text-white text-sm">
														{host.system_uptime}
													</p>
												</div>
											)}

											{/* CPU Model */}
											{host.cpu_model && (
												<div className="bg-secondary-50 dark:bg-secondary-700 p-4 rounded-lg">
													<div className="flex items-center gap-2 mb-2">
														<Cpu className="h-4 w-4 text-primary-600 dark:text-primary-400" />
														<p className="text-xs text-secondary-500 dark:text-secondary-300">
															CPU Model
														</p>
													</div>
													<p className="font-medium text-secondary-900 dark:text-white text-sm">
														{host.cpu_model}
													</p>
												</div>
											)}

											{/* CPU Cores */}
											{host.cpu_cores && (
												<div className="bg-secondary-50 dark:bg-secondary-700 p-4 rounded-lg">
													<div className="flex items-center gap-2 mb-2">
														<Cpu className="h-4 w-4 text-primary-600 dark:text-primary-400" />
														<p className="text-xs text-secondary-500 dark:text-secondary-300">
															CPU Cores
														</p>
													</div>
													<p className="font-medium text-secondary-900 dark:text-white text-sm">
														{host.cpu_cores}
													</p>
												</div>
											)}

											{/* RAM Installed */}
											{host.ram_installed && (
												<div className="bg-secondary-50 dark:bg-secondary-700 p-4 rounded-lg">
													<div className="flex items-center gap-2 mb-2">
														<MemoryStick className="h-4 w-4 text-primary-600 dark:text-primary-400" />
														<p className="text-xs text-secondary-500 dark:text-secondary-300">
															RAM Installed
														</p>
													</div>
													<p className="font-medium text-secondary-900 dark:text-white text-sm">
														{host.ram_installed} GB
													</p>
												</div>
											)}

											{/* Swap Size */}
											{host.swap_size !== undefined &&
												host.swap_size !== null && (
													<div className="bg-secondary-50 dark:bg-secondary-700 p-4 rounded-lg">
														<div className="flex items-center gap-2 mb-2">
															<MemoryStick className="h-4 w-4 text-primary-600 dark:text-primary-400" />
															<p className="text-xs text-secondary-500 dark:text-secondary-300">
																Swap Size
															</p>
														</div>
														<p className="font-medium text-secondary-900 dark:text-white text-sm">
															{host.swap_size} GB
														</p>
													</div>
												)}

											{/* Load Average */}
											{host.load_average &&
												Array.isArray(host.load_average) &&
												host.load_average.length > 0 &&
												host.load_average.some((load) => load != null) && (
													<div className="bg-secondary-50 dark:bg-secondary-700 p-4 rounded-lg">
														<div className="flex items-center gap-2 mb-2">
															<Activity className="h-4 w-4 text-primary-600 dark:text-primary-400" />
															<p className="text-xs text-secondary-500 dark:text-secondary-300">
																Load Average
															</p>
														</div>
														<p className="font-medium text-secondary-900 dark:text-white text-sm">
															{host.load_average
																.filter((load) => load != null)
																.map((load, index) => (
																	<span key={`load-${index}-${load}`}>
																		{typeof load === "number"
																			? load.toFixed(2)
																			: String(load)}
																		{index <
																			host.load_average.filter(
																				(load) => load != null,
																			).length -
																				1 && ", "}
																	</span>
																))}
														</p>
													</div>
												)}
										</div>

										{/* Disk Information */}
										{host.disk_details &&
											Array.isArray(host.disk_details) &&
											host.disk_details.length > 0 && (
												<div className="pt-4 border-t border-secondary-200 dark:border-secondary-600">
													<h5 className="text-sm font-medium text-secondary-900 dark:text-white mb-3 flex items-center gap-2">
														<HardDrive className="h-4 w-4 text-primary-600 dark:text-primary-400" />
														Disk Usage
													</h5>
													<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
														{host.disk_details.map((disk, index) => (
															<div
																key={disk.name || `disk-${index}`}
																className="bg-secondary-50 dark:bg-secondary-700 p-3 rounded-lg"
															>
																<div className="flex items-center gap-2 mb-2">
																	<HardDrive className="h-4 w-4 text-secondary-500" />
																	<span className="font-medium text-secondary-900 dark:text-white text-sm">
																		{disk.name || `Disk ${index + 1}`}
																	</span>
																</div>
																{disk.size && (
																	<p className="text-xs text-secondary-600 dark:text-secondary-300 mb-1">
																		Size: {disk.size}
																	</p>
																)}
																{disk.mountpoint && (
																	<p className="text-xs text-secondary-600 dark:text-secondary-300 mb-1">
																		Mount: {disk.mountpoint}
																	</p>
																)}
																{disk.usage &&
																	typeof disk.usage === "number" && (
																		<div className="mt-2">
																			<div className="flex justify-between text-xs text-secondary-600 dark:text-secondary-300 mb-1">
																				<span>Usage</span>
																				<span>{disk.usage}%</span>
																			</div>
																			<div className="w-full bg-secondary-200 dark:bg-secondary-600 rounded-full h-2">
																				<div
																					className="bg-primary-600 dark:bg-primary-400 h-2 rounded-full transition-all duration-300"
																					style={{
																						width: `${Math.min(Math.max(disk.usage, 0), 100)}%`,
																					}}
																				></div>
																			</div>
																		</div>
																	)}
															</div>
														))}
													</div>
												</div>
											)}
									</div>
								)}

								{/* No Data State */}
								{!host.kernel_version &&
									!host.selinux_status &&
									!host.architecture &&
									!host.system_uptime &&
									!host.cpu_model &&
									!host.cpu_cores &&
									!host.ram_installed &&
									host.swap_size === undefined &&
									(!host.load_average ||
										!Array.isArray(host.load_average) ||
										host.load_average.length === 0 ||
										!host.load_average.some((load) => load != null)) &&
									(!host.disk_details ||
										!Array.isArray(host.disk_details) ||
										host.disk_details.length === 0) && (
										<div className="text-center py-8">
											<Terminal className="h-8 w-8 text-secondary-400 mx-auto mb-2" />
											<p className="text-sm text-secondary-500 dark:text-secondary-300">
												No system information available
											</p>
											<p className="text-xs text-secondary-400 dark:text-secondary-400 mt-1">
												System information will appear once the agent collects
												data from this host
											</p>
										</div>
									)}
							</div>
						)}

						{activeTab === "network" &&
							!(
								host.ip ||
								host.gateway_ip ||
								host.dns_servers ||
								host.network_interfaces
							) && (
								<div className="text-center py-8">
									<Wifi className="h-8 w-8 text-secondary-400 mx-auto mb-2" />
									<p className="text-sm text-secondary-500 dark:text-secondary-300">
										No network information available
									</p>
								</div>
							)}

						{/* Update History */}
						{activeTab === "history" && (
							<div className="space-y-4">
								{host.update_history?.length > 0 ? (
									<>
										<div className="overflow-x-auto">
											<table className="min-w-full divide-y divide-secondary-200 dark:divide-secondary-600">
												<thead className="bg-secondary-50 dark:bg-secondary-700">
													<tr>
														<th className="px-4 py-2 text-left text-xs font-medium text-secondary-500 dark:text-secondary-300 uppercase tracking-wider">
															Status
														</th>
														<th className="px-4 py-2 text-left text-xs font-medium text-secondary-500 dark:text-secondary-300 uppercase tracking-wider">
															Date
														</th>
														<th className="px-4 py-2 text-left text-xs font-medium text-secondary-500 dark:text-secondary-300 uppercase tracking-wider">
															Total Packages
														</th>
														<th className="px-4 py-2 text-left text-xs font-medium text-secondary-500 dark:text-secondary-300 uppercase tracking-wider">
															Outdated Packages
														</th>
														<th className="px-4 py-2 text-left text-xs font-medium text-secondary-500 dark:text-secondary-300 uppercase tracking-wider">
															Security
														</th>
														<th className="px-4 py-2 text-left text-xs font-medium text-secondary-500 dark:text-secondary-300 uppercase tracking-wider">
															Payload (KB)
														</th>
														<th className="px-4 py-2 text-left text-xs font-medium text-secondary-500 dark:text-secondary-300 uppercase tracking-wider">
															Exec Time (s)
														</th>
													</tr>
												</thead>
												<tbody className="bg-white dark:bg-secondary-800 divide-y divide-secondary-200 dark:divide-secondary-600">
													{host.update_history.map((update) => (
														<tr
															key={update.id}
															className="hover:bg-secondary-50 dark:hover:bg-secondary-700"
														>
															<td className="px-4 py-2 whitespace-nowrap">
																<div className="flex items-center gap-1.5">
																	<div
																		className={`w-1.5 h-1.5 rounded-full ${update.status === "success" ? "bg-success-500" : "bg-danger-500"}`}
																	/>
																	<span
																		className={`text-xs font-medium ${
																			update.status === "success"
																				? "text-success-700 dark:text-success-300"
																				: "text-danger-700 dark:text-danger-300"
																		}`}
																	>
																		{update.status === "success"
																			? "Success"
																			: "Failed"}
																	</span>
																</div>
															</td>
															<td className="px-4 py-2 whitespace-nowrap text-xs text-secondary-900 dark:text-white">
																{formatDate(update.timestamp)}
															</td>
															<td className="px-4 py-2 whitespace-nowrap text-xs text-secondary-900 dark:text-white">
																{update.total_packages || "-"}
															</td>
															<td className="px-4 py-2 whitespace-nowrap text-xs text-secondary-900 dark:text-white">
																{update.packages_count}
															</td>
															<td className="px-4 py-2 whitespace-nowrap">
																{update.security_count > 0 ? (
																	<div className="flex items-center gap-1">
																		<Shield className="h-3 w-3 text-danger-600" />
																		<span className="text-xs text-danger-600 font-medium">
																			{update.security_count}
																		</span>
																	</div>
																) : (
																	<span className="text-xs text-secondary-500 dark:text-secondary-400">
																		-
																	</span>
																)}
															</td>
															<td className="px-4 py-2 whitespace-nowrap text-xs text-secondary-900 dark:text-white">
																{update.payload_size_kb
																	? `${update.payload_size_kb.toFixed(2)}`
																	: "-"}
															</td>
															<td className="px-4 py-2 whitespace-nowrap text-xs text-secondary-900 dark:text-white">
																{update.execution_time
																	? `${update.execution_time.toFixed(2)}`
																	: "-"}
															</td>
														</tr>
													))}
												</tbody>
											</table>
										</div>

										{/* Pagination Controls */}
										{host.pagination &&
											host.pagination.total > historyLimit && (
												<div className="flex items-center justify-between px-4 py-3 border-t border-secondary-200 dark:border-secondary-600 bg-secondary-50 dark:bg-secondary-700">
													<div className="flex items-center gap-2 text-sm text-secondary-600 dark:text-secondary-300">
														<span>
															Showing {historyPage * historyLimit + 1} to{" "}
															{Math.min(
																(historyPage + 1) * historyLimit,
																host.pagination.total,
															)}{" "}
															of {host.pagination.total} entries
														</span>
													</div>
													<div className="flex items-center gap-2">
														<button
															type="button"
															onClick={() => setHistoryPage(0)}
															disabled={historyPage === 0}
															className="px-3 py-1 text-xs font-medium text-secondary-600 dark:text-secondary-300 hover:text-secondary-800 dark:hover:text-secondary-100 disabled:opacity-50 disabled:cursor-not-allowed"
														>
															First
														</button>
														<button
															type="button"
															onClick={() => setHistoryPage(historyPage - 1)}
															disabled={historyPage === 0}
															className="px-3 py-1 text-xs font-medium text-secondary-600 dark:text-secondary-300 hover:text-secondary-800 dark:hover:text-secondary-100 disabled:opacity-50 disabled:cursor-not-allowed"
														>
															Previous
														</button>
														<span className="px-3 py-1 text-xs font-medium text-secondary-900 dark:text-white">
															Page {historyPage + 1} of{" "}
															{Math.ceil(host.pagination.total / historyLimit)}
														</span>
														<button
															type="button"
															onClick={() => setHistoryPage(historyPage + 1)}
															disabled={!host.pagination.hasMore}
															className="px-3 py-1 text-xs font-medium text-secondary-600 dark:text-secondary-300 hover:text-secondary-800 dark:hover:text-secondary-100 disabled:opacity-50 disabled:cursor-not-allowed"
														>
															Next
														</button>
														<button
															type="button"
															onClick={() =>
																setHistoryPage(
																	Math.ceil(
																		host.pagination.total / historyLimit,
																	) - 1,
																)
															}
															disabled={!host.pagination.hasMore}
															className="px-3 py-1 text-xs font-medium text-secondary-600 dark:text-secondary-300 hover:text-secondary-800 dark:hover:text-secondary-100 disabled:opacity-50 disabled:cursor-not-allowed"
														>
															Last
														</button>
													</div>
												</div>
											)}
									</>
								) : (
									<div className="text-center py-8">
										<Calendar className="h-8 w-8 text-secondary-400 mx-auto mb-2" />
										<p className="text-sm text-secondary-500 dark:text-secondary-300">
											No update history available
										</p>
									</div>
								)}
							</div>
						)}

						{/* Notes */}
						{activeTab === "notes" && (
							<div className="space-y-4">
								<div className="flex items-center justify-between">
									<h3 className="text-lg font-medium text-secondary-900 dark:text-white">
										Host Notes
									</h3>
								</div>
								<div className="bg-secondary-50 dark:bg-secondary-700 rounded-lg p-4">
									<textarea
										value={host.notes || ""}
										onChange={(e) => {
											// Update local state immediately for better UX
											const updatedHost = { ...host, notes: e.target.value };
											queryClient.setQueryData(["host", hostId], updatedHost);
										}}
										placeholder="Add notes about this host... (e.g., purpose, special configurations, maintenance notes)"
										className="w-full h-32 p-3 border border-secondary-200 dark:border-secondary-600 rounded-lg bg-white dark:bg-secondary-800 text-secondary-900 dark:text-white placeholder-secondary-500 dark:placeholder-secondary-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
										maxLength={1000}
									/>
									<div className="flex justify-between items-center mt-3">
										<p className="text-xs text-secondary-500 dark:text-secondary-400">
											Use this space to add important information about this
											host for your team
										</p>
										<div className="flex items-center gap-2">
											<span className="text-xs text-secondary-400 dark:text-secondary-500">
												{(host.notes || "").length}/1000
											</span>
											<button
												type="button"
												onClick={() => {
													updateNotesMutation.mutate({
														hostId: host.id,
														notes: host.notes || "",
													});
												}}
												disabled={updateNotesMutation.isPending}
												className="px-3 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 rounded-md transition-colors"
											>
												{updateNotesMutation.isPending
													? "Saving..."
													: "Save Notes"}
											</button>
										</div>
									</div>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Credentials Modal */}
			{showCredentialsModal && (
				<CredentialsModal
					host={host}
					isOpen={showCredentialsModal}
					onClose={() => setShowCredentialsModal(false)}
				/>
			)}

			{/* Delete Confirmation Modal */}
			{showDeleteModal && (
				<DeleteConfirmationModal
					host={host}
					isOpen={showDeleteModal}
					onClose={() => setShowDeleteModal(false)}
					onConfirm={handleDeleteHost}
					isLoading={deleteHostMutation.isPending}
				/>
			)}
		</div>
	);
};

// Credentials Modal Component
const CredentialsModal = ({ host, isOpen, onClose }) => {
	const [showApiKey, setShowApiKey] = useState(false);
	const [activeTab, setActiveTab] = useState("quick-install");
	const [forceInstall, setForceInstall] = useState(false);
	const apiIdInputId = useId();
	const apiKeyInputId = useId();

	const { data: serverUrlData } = useQuery({
		queryKey: ["serverUrl"],
		queryFn: () => settingsAPI.getServerUrl().then((res) => res.data),
	});

	const serverUrl = serverUrlData?.server_url || "http://localhost:3001";

	// Fetch settings for dynamic curl flags (local to modal)
	const { data: settings } = useQuery({
		queryKey: ["settings"],
		queryFn: () => settingsAPI.get().then((res) => res.data),
	});

	// Helper function to get curl flags based on settings
	const getCurlFlags = () => {
		return settings?.ignore_ssl_self_signed ? "-sk" : "-s";
	};

	// Helper function to build installation URL with optional force flag
	const getInstallUrl = () => {
		const baseUrl = `${serverUrl}/api/v1/hosts/install`;
		return forceInstall ? `${baseUrl}?force=true` : baseUrl;
	};

	const copyToClipboard = async (text) => {
		try {
			// Try modern clipboard API first
			if (navigator.clipboard && window.isSecureContext) {
				await navigator.clipboard.writeText(text);
				return;
			}

			// Fallback for older browsers or non-secure contexts
			const textArea = document.createElement("textarea");
			textArea.value = text;
			textArea.style.position = "fixed";
			textArea.style.left = "-999999px";
			textArea.style.top = "-999999px";
			document.body.appendChild(textArea);
			textArea.focus();
			textArea.select();

			try {
				const successful = document.execCommand("copy");
				if (!successful) {
					throw new Error("Copy command failed");
				}
			} catch {
				// If all else fails, show the text in a prompt
				prompt("Copy this command:", text);
			} finally {
				document.body.removeChild(textArea);
			}
		} catch (err) {
			console.error("Failed to copy to clipboard:", err);
			// Show the text in a prompt as last resort
			prompt("Copy this command:", text);
		}
	};

	if (!isOpen || !host) return null;

	return (
		<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
			<div className="bg-white dark:bg-secondary-800 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
				<div className="flex justify-between items-center mb-4">
					<h3 className="text-lg font-medium text-secondary-900 dark:text-white">
						Host Setup - {host.friendly_name}
					</h3>
					<button
						type="button"
						onClick={onClose}
						className="text-secondary-400 hover:text-secondary-600 dark:text-secondary-500 dark:hover:text-secondary-300"
					>
						<X className="h-5 w-5" />
					</button>
				</div>

				{/* Tabs */}
				<div className="border-b border-secondary-200 dark:border-secondary-600 mb-6">
					<nav className="-mb-px flex space-x-8">
						<button
							type="button"
							onClick={() => setActiveTab("quick-install")}
							className={`py-2 px-1 border-b-2 font-medium text-sm ${
								activeTab === "quick-install"
									? "border-primary-500 text-primary-600 dark:text-primary-400"
									: "border-transparent text-secondary-500 dark:text-secondary-400 hover:text-secondary-700 dark:hover:text-secondary-300 hover:border-secondary-300 dark:hover:border-secondary-500"
							}`}
						>
							Quick Install
						</button>
						<button
							type="button"
							onClick={() => setActiveTab("credentials")}
							className={`py-2 px-1 border-b-2 font-medium text-sm ${
								activeTab === "credentials"
									? "border-primary-500 text-primary-600 dark:text-primary-400"
									: "border-transparent text-secondary-500 dark:text-secondary-400 hover:text-secondary-700 dark:hover:text-secondary-300 hover:border-secondary-300 dark:hover:border-secondary-500"
							}`}
						>
							API Credentials
						</button>
					</nav>
				</div>

				{/* Tab Content */}
				{activeTab === "quick-install" && (
					<div className="space-y-4">
						<div className="bg-primary-50 dark:bg-primary-900 border border-primary-200 dark:border-primary-700 rounded-lg p-4">
							<h4 className="text-sm font-medium text-primary-900 dark:text-primary-200 mb-2">
								One-Line Installation
							</h4>
							<p className="text-sm text-primary-700 dark:text-primary-300 mb-3">
								Copy and run this command on the target host to securely install
								and configure the PatchMon agent:
							</p>

							{/* Force Install Toggle */}
							<div className="mb-3">
								<label className="flex items-center gap-2 text-sm">
									<input
										type="checkbox"
										checked={forceInstall}
										onChange={(e) => setForceInstall(e.target.checked)}
										className="rounded border-secondary-300 dark:border-secondary-600 text-primary-600 focus:ring-primary-500 dark:focus:ring-primary-400 dark:bg-secondary-700"
									/>
									<span className="text-primary-800 dark:text-primary-200">
										Force install (bypass broken packages)
									</span>
								</label>
								<p className="text-xs text-primary-600 dark:text-primary-400 mt-1">
									Enable this if the target host has broken packages
									(CloudPanel, WHM, etc.) that block apt-get operations
								</p>
							</div>

							<div className="flex items-center gap-2">
								<input
									type="text"
									value={`curl ${getCurlFlags()} ${getInstallUrl()} -H "X-API-ID: ${host.api_id}" -H "X-API-KEY: ${host.api_key}" | bash`}
									readOnly
									className="flex-1 px-3 py-2 border border-primary-300 dark:border-primary-600 rounded-md bg-white dark:bg-secondary-800 text-sm font-mono text-secondary-900 dark:text-white"
								/>
								<button
									type="button"
									onClick={() =>
										copyToClipboard(
											`curl ${getCurlFlags()} ${getInstallUrl()} -H "X-API-ID: ${host.api_id}" -H "X-API-KEY: ${host.api_key}" | bash`,
										)
									}
									className="btn-primary flex items-center gap-1"
								>
									<Copy className="h-4 w-4" />
									Copy
								</button>
							</div>
						</div>

						<div className="bg-secondary-50 dark:bg-secondary-700 rounded-lg p-4">
							<h4 className="text-sm font-medium text-secondary-900 dark:text-white mb-2">
								Manual Installation
							</h4>
							<p className="text-sm text-secondary-600 dark:text-secondary-300 mb-3">
								If you prefer to install manually, follow these steps:
							</p>
							<div className="space-y-3">
								<div className="bg-white dark:bg-secondary-800 rounded-md p-3 border border-secondary-200 dark:border-secondary-600">
									<h5 className="text-sm font-medium text-secondary-900 dark:text-white mb-2">
										1. Create Configuration Directory
									</h5>
									<div className="flex items-center gap-2">
										<input
											type="text"
											value="sudo mkdir -p /etc/patchmon"
											readOnly
											className="flex-1 px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md bg-white dark:bg-secondary-800 text-sm font-mono text-secondary-900 dark:text-white"
										/>
										<button
											type="button"
											onClick={() =>
												copyToClipboard("sudo mkdir -p /etc/patchmon")
											}
											className="btn-secondary flex items-center gap-1"
										>
											<Copy className="h-4 w-4" />
											Copy
										</button>
									</div>
								</div>

								<div className="bg-white dark:bg-secondary-800 rounded-md p-3 border border-secondary-200 dark:border-secondary-600">
									<h5 className="text-sm font-medium text-secondary-900 dark:text-white mb-2">
										2. Download and Install Agent Script
									</h5>
									<div className="flex items-center gap-2">
										<input
											type="text"
											value={`curl ${getCurlFlags()} -o /usr/local/bin/patchmon-agent.sh ${serverUrl}/api/v1/hosts/agent/download -H "X-API-ID: ${host.api_id}" -H "X-API-KEY: ${host.api_key}" && sudo chmod +x /usr/local/bin/patchmon-agent.sh`}
											readOnly
											className="flex-1 px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md bg-white dark:bg-secondary-800 text-sm font-mono text-secondary-900 dark:text-white"
										/>
										<button
											type="button"
											onClick={() =>
												copyToClipboard(
													`curl ${getCurlFlags()} -o /usr/local/bin/patchmon-agent.sh ${serverUrl}/api/v1/hosts/agent/download -H "X-API-ID: ${host.api_id}" -H "X-API-KEY: ${host.api_key}" && sudo chmod +x /usr/local/bin/patchmon-agent.sh`,
												)
											}
											className="btn-secondary flex items-center gap-1"
										>
											<Copy className="h-4 w-4" />
											Copy
										</button>
									</div>
								</div>

								<div className="bg-white dark:bg-secondary-800 rounded-md p-3 border border-secondary-200 dark:border-secondary-600">
									<h5 className="text-sm font-medium text-secondary-900 dark:text-white mb-2">
										3. Configure Credentials
									</h5>
									<div className="flex items-center gap-2">
										<input
											type="text"
											value={`sudo /usr/local/bin/patchmon-agent.sh configure "${host.api_id}" "${host.api_key}" "${serverUrl}"`}
											readOnly
											className="flex-1 px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md bg-white dark:bg-secondary-800 text-sm font-mono text-secondary-900 dark:text-white"
										/>
										<button
											type="button"
											onClick={() =>
												copyToClipboard(
													`sudo /usr/local/bin/patchmon-agent.sh configure "${host.api_id}" "${host.api_key}" "${serverUrl}"`,
												)
											}
											className="btn-secondary flex items-center gap-1"
										>
											<Copy className="h-4 w-4" />
											Copy
										</button>
									</div>
								</div>

								<div className="bg-white dark:bg-secondary-800 rounded-md p-3 border border-secondary-200 dark:border-secondary-600">
									<h5 className="text-sm font-medium text-secondary-900 dark:text-white mb-2">
										4. Test Configuration
									</h5>
									<div className="flex items-center gap-2">
										<input
											type="text"
											value="sudo /usr/local/bin/patchmon-agent.sh test"
											readOnly
											className="flex-1 px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md bg-white dark:bg-secondary-800 text-sm font-mono text-secondary-900 dark:text-white"
										/>
										<button
											type="button"
											onClick={() =>
												copyToClipboard(
													"sudo /usr/local/bin/patchmon-agent.sh test",
												)
											}
											className="btn-secondary flex items-center gap-1"
										>
											<Copy className="h-4 w-4" />
											Copy
										</button>
									</div>
								</div>

								<div className="bg-white dark:bg-secondary-800 rounded-md p-3 border border-secondary-200 dark:border-secondary-600">
									<h5 className="text-sm font-medium text-secondary-900 dark:text-white mb-2">
										5. Send Initial Data
									</h5>
									<div className="flex items-center gap-2">
										<input
											type="text"
											value="sudo /usr/local/bin/patchmon-agent.sh update"
											readOnly
											className="flex-1 px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md bg-white dark:bg-secondary-800 text-sm font-mono text-secondary-900 dark:text-white"
										/>
										<button
											type="button"
											onClick={() =>
												copyToClipboard(
													"sudo /usr/local/bin/patchmon-agent.sh update",
												)
											}
											className="btn-secondary flex items-center gap-1"
										>
											<Copy className="h-4 w-4" />
											Copy
										</button>
									</div>
								</div>

								<div className="bg-white dark:bg-secondary-800 rounded-md p-3 border border-secondary-200 dark:border-secondary-600">
									<h5 className="text-sm font-medium text-secondary-900 dark:text-white mb-2">
										6. Setup Crontab (Optional)
									</h5>
									<div className="flex items-center gap-2">
										<input
											type="text"
											value={`(sudo crontab -l 2>/dev/null | grep -v "patchmon-agent.sh update"; echo "${new Date().getMinutes()} * * * * /usr/local/bin/patchmon-agent.sh update >/dev/null 2>&1") | sudo crontab -`}
											readOnly
											className="flex-1 px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md bg-white dark:bg-secondary-800 text-sm font-mono text-secondary-900 dark:text-white"
										/>
										<button
											type="button"
											onClick={() =>
												copyToClipboard(
													`(sudo crontab -l 2>/dev/null | grep -v "patchmon-agent.sh update"; echo "${new Date().getMinutes()} * * * * /usr/local/bin/patchmon-agent.sh update >/dev/null 2>&1") | sudo crontab -`,
												)
											}
											className="btn-secondary flex items-center gap-1"
										>
											<Copy className="h-4 w-4" />
											Copy
										</button>
									</div>
								</div>
							</div>
						</div>
					</div>
				)}

				{activeTab === "credentials" && (
					<div className="space-y-6">
						<div className="bg-secondary-50 dark:bg-secondary-700 rounded-lg p-4">
							<h4 className="text-sm font-medium text-secondary-900 dark:text-white mb-3">
								API Credentials
							</h4>
							<div className="space-y-4">
								<div>
									<label
										htmlFor={apiIdInputId}
										className="block text-sm font-medium text-secondary-700 dark:text-secondary-200 mb-1"
									>
										API ID
									</label>
									<div className="flex items-center gap-2">
										<input
											id={apiIdInputId}
											type="text"
											value={host.api_id}
											readOnly
											className="flex-1 px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md bg-secondary-50 dark:bg-secondary-800 text-sm font-mono text-secondary-900 dark:text-white"
										/>
										<button
											type="button"
											onClick={() => copyToClipboard(host.api_id)}
											className="btn-outline flex items-center gap-1"
										>
											<Copy className="h-4 w-4" />
											Copy
										</button>
									</div>
								</div>

								<div>
									<label
										htmlFor={apiKeyInputId}
										className="block text-sm font-medium text-secondary-700 dark:text-secondary-200 mb-1"
									>
										API Key
									</label>
									<div className="flex items-center gap-2">
										<input
											id={apiKeyInputId}
											type={showApiKey ? "text" : "password"}
											value={host.api_key}
											readOnly
											className="flex-1 px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md bg-secondary-50 dark:bg-secondary-800 text-sm font-mono text-secondary-900 dark:text-white"
										/>
										<button
											type="button"
											onClick={() => setShowApiKey(!showApiKey)}
											className="btn-outline flex items-center gap-1"
										>
											{showApiKey ? (
												<EyeOff className="h-4 w-4" />
											) : (
												<Eye className="h-4 w-4" />
											)}
										</button>
										<button
											type="button"
											onClick={() => copyToClipboard(host.api_key)}
											className="btn-outline flex items-center gap-1"
										>
											<Copy className="h-4 w-4" />
											Copy
										</button>
									</div>
								</div>
							</div>
						</div>

						<div className="bg-warning-50 dark:bg-warning-900 border border-warning-200 dark:border-warning-700 rounded-lg p-4">
							<div className="flex">
								<AlertTriangle className="h-5 w-5 text-warning-400 dark:text-warning-300" />
								<div className="ml-3">
									<h3 className="text-sm font-medium text-warning-800 dark:text-warning-200">
										Security Notice
									</h3>
									<p className="text-sm text-warning-700 dark:text-warning-300 mt-1">
										Keep these credentials secure. They provide full access to
										this host's monitoring data.
									</p>
								</div>
							</div>
						</div>
					</div>
				)}

				<div className="flex justify-end pt-6">
					<button type="button" onClick={onClose} className="btn-primary">
						Close
					</button>
				</div>
			</div>
		</div>
	);
};

// Delete Confirmation Modal Component
const DeleteConfirmationModal = ({
	host,
	isOpen,
	onClose,
	onConfirm,
	isLoading,
}) => {
	if (!isOpen || !host) return null;

	return (
		<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
			<div className="bg-white dark:bg-secondary-800 rounded-lg p-6 w-full max-w-md">
				<div className="flex items-center gap-3 mb-4">
					<div className="w-10 h-10 bg-danger-100 dark:bg-danger-900 rounded-full flex items-center justify-center">
						<AlertTriangle className="h-5 w-5 text-danger-600 dark:text-danger-400" />
					</div>
					<div>
						<h3 className="text-lg font-semibold text-secondary-900 dark:text-white">
							Delete Host
						</h3>
						<p className="text-sm text-secondary-600 dark:text-secondary-300">
							This action cannot be undone
						</p>
					</div>
				</div>

				<div className="mb-6">
					<p className="text-secondary-700 dark:text-secondary-300">
						Are you sure you want to delete the host{" "}
						<span className="font-semibold">"{host.friendly_name}"</span>?
					</p>
					<div className="mt-3 p-3 bg-danger-50 dark:bg-danger-900 border border-danger-200 dark:border-danger-700 rounded-md">
						<p className="text-sm text-danger-800 dark:text-danger-200">
							<strong>Warning:</strong> This will permanently remove the host
							and all its associated data, including package information and
							update history.
						</p>
					</div>
				</div>

				<div className="flex justify-end gap-3">
					<button
						type="button"
						onClick={onClose}
						className="btn-outline"
						disabled={isLoading}
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={onConfirm}
						className="btn-danger"
						disabled={isLoading}
					>
						{isLoading ? "Deleting..." : "Delete Host"}
					</button>
				</div>
			</div>
		</div>
	);
};

export default HostDetail;
