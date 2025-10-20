import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle, Clock, RefreshCw } from "lucide-react";
import api from "../../utils/api";

const AgentManagementTab = () => {
	const _queryClient = useQueryClient();

	// Agent version queries
	const {
		data: versionInfo,
		isLoading: versionLoading,
		error: versionError,
		refetch: refetchVersion,
	} = useQuery({
		queryKey: ["agentVersion"],
		queryFn: async () => {
			try {
				const response = await api.get("/agent/version");
				console.log("🔍 Frontend received version info:", response.data);
				return response.data;
			} catch (error) {
				console.error("Failed to fetch version info:", error);
				throw error;
			}
		},
		refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
		enabled: true, // Always enabled
		retry: 3, // Retry failed requests
	});

	const {
		data: _availableVersions,
		isLoading: _versionsLoading,
		error: _versionsError,
	} = useQuery({
		queryKey: ["agentVersions"],
		queryFn: async () => {
			try {
				const response = await api.get("/agent/versions");
				console.log("🔍 Frontend received available versions:", response.data);
				return response.data;
			} catch (error) {
				console.error("Failed to fetch available versions:", error);
				throw error;
			}
		},
		enabled: true,
		retry: 3,
	});

	const checkUpdatesMutation = useMutation({
		mutationFn: async () => {
			// First check GitHub for updates
			await api.post("/agent/version/check");
			// Then refresh current agent version detection
			await api.post("/agent/version/refresh");
		},
		onSuccess: () => {
			refetchVersion();
		},
		onError: (error) => {
			console.error("Check updates error:", error);
		},
	});

	const downloadUpdateMutation = useMutation({
		mutationFn: async () => {
			// Download the latest binaries
			const downloadResult = await api.post("/agent/version/download");
			// Refresh current agent version detection after download
			await api.post("/agent/version/refresh");
			// Return the download result for success handling
			return downloadResult;
		},
		onSuccess: (data) => {
			console.log("Download completed:", data);
			console.log("Download response data:", data.data);
			refetchVersion();
			// Show success message
			const message =
				data.data?.message || "Agent binaries downloaded successfully";
			alert(`✅ ${message}`);
		},
		onError: (error) => {
			console.error("Download update error:", error);
			alert(`❌ Download failed: ${error.message}`);
		},
	});

	const getVersionStatus = () => {
		console.log("🔍 getVersionStatus called with:", {
			versionError,
			versionInfo,
			versionLoading,
		});

		if (versionError) {
			console.log("❌ Version error detected:", versionError);
			return {
				status: "error",
				message: "Failed to load version info",
				Icon: AlertCircle,
				color: "text-red-600",
			};
		}

		if (!versionInfo || versionLoading) {
			console.log("⏳ Loading state:", { versionInfo, versionLoading });
			return {
				status: "loading",
				message: "Loading version info...",
				Icon: RefreshCw,
				color: "text-gray-600",
			};
		}

		// Use the backend's updateStatus for proper semver comparison
		switch (versionInfo.updateStatus) {
			case "update-available":
				return {
					status: "update-available",
					message: `Update available: ${versionInfo.latestVersion}`,
					Icon: Clock,
					color: "text-yellow-600",
				};
			case "newer-version":
				return {
					status: "newer-version",
					message: `Newer version running: ${versionInfo.currentVersion}`,
					Icon: CheckCircle,
					color: "text-blue-600",
				};
			case "up-to-date":
				return {
					status: "up-to-date",
					message: `Up to date: ${versionInfo.latestVersion}`,
					Icon: CheckCircle,
					color: "text-green-600",
				};
			case "no-agent":
				return {
					status: "no-agent",
					message: "No agent binary found",
					Icon: AlertCircle,
					color: "text-orange-600",
				};
			case "github-unavailable":
				return {
					status: "github-unavailable",
					message: `Agent running: ${versionInfo.currentVersion} (GitHub API unavailable)`,
					Icon: CheckCircle,
					color: "text-purple-600",
				};
			case "no-data":
				return {
					status: "no-data",
					message: "No version data available",
					Icon: AlertCircle,
					color: "text-gray-600",
				};
			default:
				return {
					status: "unknown",
					message: "Version status unknown",
					Icon: AlertCircle,
					color: "text-gray-600",
				};
		}
	};

	const versionStatus = getVersionStatus();
	const StatusIcon = versionStatus.Icon;

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between mb-6">
				<div>
					<h2 className="text-2xl font-bold text-secondary-900 dark:text-white">
						Agent Version Management
					</h2>
					<p className="text-secondary-600 dark:text-secondary-300">
						Monitor agent versions and download updates
					</p>
				</div>
				<div className="flex space-x-3">
					<button
						type="button"
						onClick={() => checkUpdatesMutation.mutate()}
						disabled={checkUpdatesMutation.isPending}
						className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
					>
						<RefreshCw
							className={`h-4 w-4 mr-2 ${checkUpdatesMutation.isPending ? "animate-spin" : ""}`}
						/>
						Check Updates
					</button>
				</div>
			</div>

			{/* Download Updates Button */}
			<div className="bg-white dark:bg-secondary-800 rounded-lg shadow p-6 border border-secondary-200 dark:border-secondary-600">
				<div className="flex items-center justify-between">
					<div>
						<h3 className="text-lg font-semibold text-secondary-900 dark:text-white">
							{versionInfo?.currentVersion
								? "Download Agent Updates"
								: "Download Agent Binaries"}
						</h3>
						<p className="text-secondary-600 dark:text-secondary-300">
							{versionInfo?.currentVersion
								? "Download the latest agent binaries from GitHub"
								: "No agent binaries found. Download from GitHub to get started."}
						</p>
					</div>
					<button
						type="button"
						onClick={() => downloadUpdateMutation.mutate()}
						disabled={downloadUpdateMutation.isPending}
						className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
					>
						<RefreshCw
							className={`h-4 w-4 mr-2 ${downloadUpdateMutation.isPending ? "animate-spin" : ""}`}
						/>
						{downloadUpdateMutation.isPending
							? "Downloading..."
							: versionInfo?.currentVersion
								? "Download Updates"
								: "Download Agent Binaries"}
					</button>
				</div>
			</div>

			{/* Version Status Card */}
			<div className="bg-white dark:bg-secondary-800 rounded-lg shadow p-6 border border-secondary-200 dark:border-secondary-600">
				<div className="flex items-center justify-between mb-4">
					<h3 className="text-lg font-semibold text-secondary-900 dark:text-white">
						Agent Version Status
					</h3>
					<div className="flex items-center space-x-2">
						{StatusIcon && (
							<StatusIcon className={`h-5 w-5 ${versionStatus.color}`} />
						)}
						<span className={`text-sm font-medium ${versionStatus.color}`}>
							{versionStatus.message}
						</span>
					</div>
				</div>

				{versionInfo && (
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
						<div>
							<span className="text-secondary-500 dark:text-secondary-400">
								Current Version:
							</span>
							<span className="ml-2 font-medium text-secondary-900 dark:text-white">
								{versionInfo.currentVersion || "Unknown"}
							</span>
						</div>
						<div>
							<span className="text-secondary-500 dark:text-secondary-400">
								Latest Version:
							</span>
							<span className="ml-2 font-medium text-secondary-900 dark:text-white">
								{versionInfo.latestVersion || "Unknown"}
							</span>
						</div>
						<div>
							<span className="text-secondary-500 dark:text-secondary-400">
								Last Checked:
							</span>
							<span className="ml-2 font-medium text-secondary-900 dark:text-white">
								{versionInfo.lastChecked
									? new Date(versionInfo.lastChecked).toLocaleString()
									: "Never"}
							</span>
						</div>
					</div>
				)}
			</div>
		</div>
	);
};

export default AgentManagementTab;
