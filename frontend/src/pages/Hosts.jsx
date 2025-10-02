import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertTriangle,
	ArrowDown,
	ArrowUp,
	ArrowUpDown,
	CheckCircle,
	CheckSquare,
	ChevronDown,
	Clock,
	Columns,
	ExternalLink,
	Eye as EyeIcon,
	EyeOff as EyeOffIcon,
	Filter,
	GripVertical,
	Plus,
	RefreshCw,
	Search,
	Server,
	Square,
	Trash2,
	Users,
	X,
} from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import InlineEdit from "../components/InlineEdit";
import InlineGroupEdit from "../components/InlineGroupEdit";
import InlineToggle from "../components/InlineToggle";
import {
	adminHostsAPI,
	dashboardAPI,
	formatRelativeTime,
	hostGroupsAPI,
} from "../utils/api";
import { OSIcon } from "../utils/osIcons.jsx";

// Add Host Modal Component
const AddHostModal = ({ isOpen, onClose, onSuccess }) => {
	const friendlyNameId = useId();
	const [formData, setFormData] = useState({
		friendly_name: "",
		hostGroupId: "",
	});
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState("");

	// Fetch host groups for selection
	const { data: hostGroups } = useQuery({
		queryKey: ["hostGroups"],
		queryFn: () => hostGroupsAPI.list().then((res) => res.data),
		enabled: isOpen,
	});

	const handleSubmit = async (e) => {
		e.preventDefault();
		setIsSubmitting(true);
		setError("");

		console.log("Creating host:", formData.friendly_name);

		try {
			const response = await adminHostsAPI.create(formData);
			console.log("Host created successfully:", formData.friendly_name);
			onSuccess(response.data);
			setFormData({ friendly_name: "", hostGroupId: "" });
			onClose();
		} catch (err) {
			console.error("Full error object:", err);
			console.error("Error response:", err.response);

			let errorMessage = "Failed to create host";

			if (err.response?.data?.errors) {
				// Validation errors
				errorMessage = err.response.data.errors.map((e) => e.msg).join(", ");
			} else if (err.response?.data?.error) {
				// Single error message
				errorMessage = err.response.data.error;
			} else if (err.message) {
				// Network or other error
				errorMessage = err.message;
			}

			setError(errorMessage);
		} finally {
			setIsSubmitting(false);
		}
	};

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
			<div className="bg-white dark:bg-secondary-800 rounded-lg p-6 w-full max-w-md">
				<div className="flex justify-between items-center mb-4">
					<h3 className="text-lg font-medium text-secondary-900 dark:text-white">
						Add New Host
					</h3>
					<button
						type="button"
						onClick={onClose}
						className="text-secondary-400 hover:text-secondary-600 dark:text-secondary-500 dark:hover:text-secondary-300"
					>
						<X className="h-5 w-5" />
					</button>
				</div>

				<form onSubmit={handleSubmit} className="space-y-6">
					<div>
						<label
							htmlFor={friendlyNameId}
							className="block text-sm font-medium text-secondary-700 dark:text-secondary-200 mb-2"
						>
							Friendly Name *
						</label>
						<input
							type="text"
							id={friendlyNameId}
							required
							value={formData.friendly_name}
							onChange={(e) =>
								setFormData({ ...formData, friendly_name: e.target.value })
							}
							className="block w-full px-3 py-2.5 text-base border-2 border-secondary-300 dark:border-secondary-600 rounded-lg shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-secondary-700 text-secondary-900 dark:text-white transition-all duration-200"
							placeholder="server.example.com"
						/>
						<p className="mt-2 text-sm text-secondary-500 dark:text-secondary-400">
							System information (OS, IP, architecture) will be automatically
							detected when the agent connects.
						</p>
					</div>

					<div>
						<span className="block text-sm font-medium text-secondary-700 dark:text-secondary-200 mb-3">
							Host Group
						</span>
						<div className="grid grid-cols-3 gap-2">
							{/* No Group Option */}
							<button
								type="button"
								onClick={() => setFormData({ ...formData, hostGroupId: "" })}
								className={`flex flex-col items-center justify-center px-2 py-3 text-center border-2 rounded-lg transition-all duration-200 relative min-h-[80px] ${
									formData.hostGroupId === ""
										? "border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
										: "border-secondary-300 dark:border-secondary-600 bg-white dark:bg-secondary-700 text-secondary-700 dark:text-secondary-200 hover:border-secondary-400 dark:hover:border-secondary-500"
								}`}
							>
								<div className="text-xs font-medium">No Group</div>
								<div className="text-xs text-secondary-500 dark:text-secondary-400 mt-1">
									Ungrouped
								</div>
								{formData.hostGroupId === "" && (
									<div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-primary-500 flex items-center justify-center">
										<div className="w-1.5 h-1.5 rounded-full bg-white"></div>
									</div>
								)}
							</button>

							{/* Host Group Options */}
							{hostGroups?.map((group) => (
								<button
									key={group.id}
									type="button"
									onClick={() =>
										setFormData({ ...formData, hostGroupId: group.id })
									}
									className={`flex flex-col items-center justify-center px-2 py-3 text-center border-2 rounded-lg transition-all duration-200 relative min-h-[80px] ${
										formData.hostGroupId === group.id
											? "border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
											: "border-secondary-300 dark:border-secondary-600 bg-white dark:bg-secondary-700 text-secondary-700 dark:text-secondary-200 hover:border-secondary-400 dark:hover:border-secondary-500"
									}`}
								>
									<div className="flex items-center gap-1 mb-1 w-full justify-center">
										{group.color && (
											<div
												className="w-3 h-3 rounded-full border border-secondary-300 dark:border-secondary-500 flex-shrink-0"
												style={{ backgroundColor: group.color }}
											></div>
										)}
										<div className="text-xs font-medium truncate max-w-full">
											{group.name}
										</div>
									</div>
									<div className="text-xs text-secondary-500 dark:text-secondary-400">
										Group
									</div>
									{formData.hostGroupId === group.id && (
										<div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-primary-500 flex items-center justify-center">
											<div className="w-1.5 h-1.5 rounded-full bg-white"></div>
										</div>
									)}
								</button>
							))}
						</div>
						<p className="mt-2 text-sm text-secondary-500 dark:text-secondary-400">
							Optional: Assign this host to a group for better organization.
						</p>
					</div>

					{error && (
						<div className="bg-danger-50 dark:bg-danger-900 border border-danger-200 dark:border-danger-700 rounded-md p-3">
							<p className="text-sm text-danger-700 dark:text-danger-300">
								{error}
							</p>
						</div>
					)}

					<div className="flex justify-end space-x-3 pt-2">
						<button
							type="button"
							onClick={onClose}
							className="px-6 py-3 text-sm font-medium text-secondary-700 dark:text-secondary-200 bg-white dark:bg-secondary-700 border-2 border-secondary-300 dark:border-secondary-600 rounded-lg hover:bg-secondary-50 dark:hover:bg-secondary-600 transition-all duration-200"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={isSubmitting}
							className="px-6 py-3 text-sm font-medium text-white bg-primary-600 border-2 border-transparent rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-all duration-200"
						>
							{isSubmitting ? "Creating..." : "Create Host"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
};

const Hosts = () => {
	const hostGroupFilterId = useId();
	const statusFilterId = useId();
	const osFilterId = useId();
	const [showAddModal, setShowAddModal] = useState(false);
	const [selectedHosts, setSelectedHosts] = useState([]);
	const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
	const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
	const [searchParams] = useSearchParams();
	const navigate = useNavigate();

	// Table state
	const [searchTerm, setSearchTerm] = useState("");
	const [sortField, setSortField] = useState("hostname");
	const [sortDirection, setSortDirection] = useState("asc");
	const [groupFilter, setGroupFilter] = useState("all");
	const [statusFilter, setStatusFilter] = useState("all");
	const [osFilter, setOsFilter] = useState("all");
	const [showFilters, setShowFilters] = useState(false);
	const [groupBy, setGroupBy] = useState("none");
	const [showColumnSettings, setShowColumnSettings] = useState(false);
	const [hideStale, setHideStale] = useState(false);

	// Handle URL filter parameters
	useEffect(() => {
		const filter = searchParams.get("filter");
		const showFiltersParam = searchParams.get("showFilters");
		const osFilterParam = searchParams.get("osFilter");
		const groupParam = searchParams.get("group");

		if (filter === "needsUpdates") {
			setShowFilters(true);
			setStatusFilter("all");
			// We'll filter hosts with updates > 0 in the filtering logic
		} else if (filter === "inactive") {
			setShowFilters(true);
			setStatusFilter("inactive");
			// We'll filter hosts with inactive status in the filtering logic
		} else if (filter === "upToDate") {
			setShowFilters(true);
			setStatusFilter("active");
			// We'll filter hosts that are up to date in the filtering logic
		} else if (filter === "stale") {
			setShowFilters(true);
			setStatusFilter("all");
			// We'll filter hosts that are stale in the filtering logic
		} else if (showFiltersParam === "true") {
			setShowFilters(true);
		}

		// Handle OS filter parameter
		if (osFilterParam) {
			setShowFilters(true);
			setOsFilter(osFilterParam);
		}

		// Handle group filter parameter
		if (groupParam) {
			setShowFilters(true);
			setGroupFilter(groupParam);
		}

		// Handle add host action from navigation
		const action = searchParams.get("action");
		if (action === "add") {
			setShowAddModal(true);
			// Remove the action parameter from URL without triggering a page reload
			const newSearchParams = new URLSearchParams(searchParams);
			newSearchParams.delete("action");
			navigate(
				`/hosts${newSearchParams.toString() ? `?${newSearchParams.toString()}` : ""}`,
				{
					replace: true,
				},
			);
		}

		// Handle selected hosts from packages page
		const selected = searchParams.get("selected");
		if (selected) {
			const hostIds = selected.split(",").filter(Boolean);
			setSelectedHosts(hostIds);
			// Remove the selected parameter from URL without triggering a page reload
			const newSearchParams = new URLSearchParams(searchParams);
			newSearchParams.delete("selected");
			navigate(
				`/hosts${newSearchParams.toString() ? `?${newSearchParams.toString()}` : ""}`,
				{
					replace: true,
				},
			);
		}
	}, [searchParams, navigate]);

	// Column configuration
	const [columnConfig, setColumnConfig] = useState(() => {
		const defaultConfig = [
			{ id: "select", label: "Select", visible: true, order: 0 },
			{ id: "host", label: "Friendly Name", visible: true, order: 1 },
			{ id: "ip", label: "IP Address", visible: false, order: 2 },
			{ id: "group", label: "Group", visible: true, order: 3 },
			{ id: "os", label: "OS", visible: true, order: 4 },
			{ id: "os_version", label: "OS Version", visible: false, order: 5 },
			{ id: "agent_version", label: "Agent Version", visible: true, order: 6 },
			{
				id: "auto_update",
				label: "Agent Auto-Update",
				visible: true,
				order: 7,
			},
			{ id: "status", label: "Status", visible: true, order: 8 },
			{ id: "updates", label: "Updates", visible: true, order: 9 },
			{ id: "notes", label: "Notes", visible: false, order: 10 },
			{ id: "last_update", label: "Last Update", visible: true, order: 11 },
			{ id: "actions", label: "Actions", visible: true, order: 12 },
		];

		const saved = localStorage.getItem("hosts-column-config");
		if (saved) {
			try {
				const savedConfig = JSON.parse(saved);

				// Check if we have old camelCase column IDs that need to be migrated
				const hasOldColumns = savedConfig.some(
					(col) =>
						col.id === "agentVersion" ||
						col.id === "autoUpdate" ||
						col.id === "osVersion" ||
						col.id === "lastUpdate",
				);

				if (hasOldColumns) {
					// Clear the old configuration and use the default snake_case configuration
					localStorage.removeItem("hosts-column-config");
					return defaultConfig;
				} else {
					// Use the existing configuration
					return savedConfig;
				}
			} catch {
				// If there's an error parsing the config, clear it and use default
				localStorage.removeItem("hosts-column-config");
				return defaultConfig;
			}
		}

		return defaultConfig;
	});

	const queryClient = useQueryClient();

	const {
		data: hosts,
		isLoading,
		error,
		refetch,
		isFetching,
	} = useQuery({
		queryKey: ["hosts"],
		queryFn: () => dashboardAPI.getHosts().then((res) => res.data),
		staleTime: 5 * 60 * 1000, // Data stays fresh for 5 minutes
		refetchOnWindowFocus: false, // Don't refetch when window regains focus
	});

	const { data: hostGroups } = useQuery({
		queryKey: ["hostGroups"],
		queryFn: () => hostGroupsAPI.list().then((res) => res.data),
	});

	const bulkUpdateGroupMutation = useMutation({
		mutationFn: ({ hostIds, hostGroupId }) =>
			adminHostsAPI.bulkUpdateGroup(hostIds, hostGroupId),
		onSuccess: (data) => {
			console.log("bulkUpdateGroupMutation success:", data);

			// Update the cache with the new host data
			if (data?.hosts) {
				queryClient.setQueryData(["hosts"], (oldData) => {
					if (!oldData) return oldData;
					return oldData.map((host) => {
						const updatedHost = data.hosts.find((h) => h.id === host.id);
						if (updatedHost) {
							// Ensure hostGroupId is set correctly
							return {
								...updatedHost,
								hostGroupId: updatedHost.host_groups?.id || null,
							};
						}
						return host;
					});
				});
			}

			// Also invalidate to ensure consistency
			queryClient.invalidateQueries(["hosts"]);
			setSelectedHosts([]);
			setShowBulkAssignModal(false);
		},
	});

	const updateFriendlyNameMutation = useMutation({
		mutationFn: ({ hostId, friendlyName }) =>
			adminHostsAPI
				.updateFriendlyName(hostId, friendlyName)
				.then((res) => res.data),
		onSuccess: () => {
			queryClient.invalidateQueries(["hosts"]);
		},
	});

	const updateHostGroupMutation = useMutation({
		mutationFn: ({ hostId, hostGroupId }) => {
			console.log("updateHostGroupMutation called with:", {
				hostId,
				hostGroupId,
			});
			return adminHostsAPI.updateGroup(hostId, hostGroupId).then((res) => {
				console.log("updateGroup API response:", res);
				return res.data;
			});
		},
		onSuccess: (data) => {
			// Update the cache with the new host data
			queryClient.setQueryData(["hosts"], (oldData) => {
				console.log("Old cache data before update:", oldData);
				if (!oldData) return oldData;
				const updatedData = oldData.map((host) => {
					if (host.id === data.host.id) {
						console.log(
							"Updating host in cache:",
							host.id,
							"with new data:",
							data.host,
						);
						// Ensure hostGroupId is set correctly
						const updatedHost = {
							...data.host,
							hostGroupId: data.host.host_groups?.id || null,
						};
						console.log("Updated host with hostGroupId:", updatedHost);
						return updatedHost;
					}
					return host;
				});
				console.log("New cache data after update:", updatedData);
				return updatedData;
			});

			// Also invalidate to ensure consistency
			queryClient.invalidateQueries(["hosts"]);
		},
		onError: (error) => {
			console.error("updateHostGroupMutation error:", error);
		},
	});

	const toggleAutoUpdateMutation = useMutation({
		mutationFn: ({ hostId, autoUpdate }) =>
			adminHostsAPI
				.toggleAutoUpdate(hostId, autoUpdate)
				.then((res) => res.data),
		onSuccess: () => {
			queryClient.invalidateQueries(["hosts"]);
		},
	});

	const bulkDeleteMutation = useMutation({
		mutationFn: (hostIds) => adminHostsAPI.deleteBulk(hostIds),
		onSuccess: (data) => {
			console.log("Bulk delete success:", data);
			queryClient.invalidateQueries(["hosts"]);
			setSelectedHosts([]);
			setShowBulkDeleteModal(false);
		},
		onError: (error) => {
			console.error("Bulk delete error:", error);
		},
	});

	// Helper functions for bulk selection
	const handleSelectHost = (hostId) => {
		setSelectedHosts((prev) =>
			prev.includes(hostId)
				? prev.filter((id) => id !== hostId)
				: [...prev, hostId],
		);
	};

	const handleSelectAll = () => {
		if (selectedHosts.length === hosts.length) {
			setSelectedHosts([]);
		} else {
			setSelectedHosts(hosts.map((host) => host.id));
		}
	};

	const handleBulkAssign = (hostGroupId) => {
		bulkUpdateGroupMutation.mutate({ hostIds: selectedHosts, hostGroupId });
	};

	const handleBulkDelete = () => {
		bulkDeleteMutation.mutate(selectedHosts);
	};

	// Table filtering and sorting logic
	const filteredAndSortedHosts = useMemo(() => {
		if (!hosts) return [];

		const filtered = hosts.filter((host) => {
			// Search filter
			const matchesSearch =
				searchTerm === "" ||
				host.friendly_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
				host.ip?.toLowerCase().includes(searchTerm.toLowerCase()) ||
				host.os_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
				host.notes?.toLowerCase().includes(searchTerm.toLowerCase());

			// Group filter
			const matchesGroup =
				groupFilter === "all" ||
				(groupFilter === "ungrouped" && !host.host_groups) ||
				(groupFilter !== "ungrouped" && host.host_groups?.id === groupFilter);

			// Status filter
			const matchesStatus =
				statusFilter === "all" ||
				(host.effectiveStatus || host.status) === statusFilter;

			// OS filter
			const matchesOs =
				osFilter === "all" ||
				host.os_type?.toLowerCase() === osFilter.toLowerCase();

			// URL filter for hosts needing updates, inactive hosts, up-to-date hosts, or stale hosts
			const filter = searchParams.get("filter");
			const matchesUrlFilter =
				(filter !== "needsUpdates" ||
					(host.updatesCount && host.updatesCount > 0)) &&
				(filter !== "inactive" ||
					(host.effectiveStatus || host.status) === "inactive") &&
				(filter !== "upToDate" || (!host.isStale && host.updatesCount === 0)) &&
				(filter !== "stale" || host.isStale);

			// Hide stale filter
			const matchesHideStale = !hideStale || !host.isStale;

			return (
				matchesSearch &&
				matchesGroup &&
				matchesStatus &&
				matchesOs &&
				matchesUrlFilter &&
				matchesHideStale
			);
		});

		// Sorting
		filtered.sort((a, b) => {
			let aValue, bValue;

			switch (sortField) {
				case "friendlyName":
					aValue = a.friendly_name.toLowerCase();
					bValue = b.friendly_name.toLowerCase();
					break;
				case "hostname":
					aValue = a.hostname?.toLowerCase() || "zzz_no_hostname";
					bValue = b.hostname?.toLowerCase() || "zzz_no_hostname";
					break;
				case "ip":
					aValue = a.ip?.toLowerCase() || "zzz_no_ip";
					bValue = b.ip?.toLowerCase() || "zzz_no_ip";
					break;
				case "group":
					aValue = a.host_groups?.name || "zzz_ungrouped";
					bValue = b.host_groups?.name || "zzz_ungrouped";
					break;
				case "os":
					aValue = a.os_type?.toLowerCase() || "zzz_unknown";
					bValue = b.os_type?.toLowerCase() || "zzz_unknown";
					break;
				case "os_version":
					aValue = a.os_version?.toLowerCase() || "zzz_unknown";
					bValue = b.os_version?.toLowerCase() || "zzz_unknown";
					break;
				case "agent_version":
					aValue = a.agent_version?.toLowerCase() || "zzz_no_version";
					bValue = b.agent_version?.toLowerCase() || "zzz_no_version";
					break;
				case "status":
					aValue = a.effectiveStatus || a.status;
					bValue = b.effectiveStatus || b.status;
					break;
				case "updates":
					aValue = a.updatesCount || 0;
					bValue = b.updatesCount || 0;
					break;
				case "last_update":
					aValue = new Date(a.last_update);
					bValue = new Date(b.last_update);
					break;
				case "notes":
					aValue = (a.notes || "").toLowerCase();
					bValue = (b.notes || "").toLowerCase();
					break;
				default:
					aValue = a[sortField];
					bValue = b[sortField];
			}

			if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
			if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
			return 0;
		});

		return filtered;
	}, [
		hosts,
		searchTerm,
		groupFilter,
		statusFilter,
		osFilter,
		sortField,
		sortDirection,
		searchParams,
		hideStale,
	]);

	// Group hosts by selected field
	const groupedHosts = useMemo(() => {
		if (groupBy === "none") {
			return { "All Hosts": filteredAndSortedHosts };
		}

		const groups = {};
		filteredAndSortedHosts.forEach((host) => {
			let groupKey;
			switch (groupBy) {
				case "group":
					groupKey = host.host_groups?.name || "Ungrouped";
					break;
				case "status":
					groupKey =
						(host.effectiveStatus || host.status).charAt(0).toUpperCase() +
						(host.effectiveStatus || host.status).slice(1);
					break;
				case "os":
					groupKey = host.os_type || "Unknown";
					break;
				default:
					groupKey = "All Hosts";
			}

			if (!groups[groupKey]) {
				groups[groupKey] = [];
			}
			groups[groupKey].push(host);
		});

		return groups;
	}, [filteredAndSortedHosts, groupBy]);

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

	// Column management functions
	const updateColumnConfig = (newConfig) => {
		setColumnConfig(newConfig);
		localStorage.setItem("hosts-column-config", JSON.stringify(newConfig));
	};

	const toggleColumnVisibility = (columnId) => {
		const newConfig = columnConfig.map((col) =>
			col.id === columnId ? { ...col, visible: !col.visible } : col,
		);
		updateColumnConfig(newConfig);
	};

	const reorderColumns = (fromIndex, toIndex) => {
		const newConfig = [...columnConfig];
		const [movedColumn] = newConfig.splice(fromIndex, 1);
		newConfig.splice(toIndex, 0, movedColumn);

		// Update order values
		const updatedConfig = newConfig.map((col, index) => ({
			...col,
			order: index,
		}));
		updateColumnConfig(updatedConfig);
	};

	const resetColumns = () => {
		const defaultConfig = [
			{ id: "select", label: "Select", visible: true, order: 0 },
			{ id: "host", label: "Friendly Name", visible: true, order: 1 },
			{ id: "hostname", label: "System Hostname", visible: true, order: 2 },
			{ id: "ip", label: "IP Address", visible: false, order: 3 },
			{ id: "group", label: "Group", visible: true, order: 4 },
			{ id: "os", label: "OS", visible: true, order: 5 },
			{ id: "os_version", label: "OS Version", visible: false, order: 6 },
			{ id: "status", label: "Status", visible: true, order: 7 },
			{ id: "updates", label: "Updates", visible: true, order: 8 },
			{ id: "last_update", label: "Last Update", visible: true, order: 9 },
			{ id: "actions", label: "Actions", visible: true, order: 10 },
		];
		updateColumnConfig(defaultConfig);
	};

	// Get visible columns in order
	const visibleColumns = columnConfig
		.filter((col) => col.visible)
		.sort((a, b) => a.order - b.order);

	// Helper function to render table cell content
	const renderCellContent = (column, host) => {
		switch (column.id) {
			case "select":
				return (
					<button
						type="button"
						onClick={() => handleSelectHost(host.id)}
						className="flex items-center gap-2 hover:text-secondary-700"
					>
						{selectedHosts.includes(host.id) ? (
							<CheckSquare className="h-4 w-4 text-primary-600" />
						) : (
							<Square className="h-4 w-4 text-secondary-400" />
						)}
					</button>
				);
			case "host":
				return (
					<InlineEdit
						value={host.friendly_name}
						onSave={(newName) =>
							updateFriendlyNameMutation.mutate({
								hostId: host.id,
								friendlyName: newName,
							})
						}
						placeholder="Enter friendly name..."
						maxLength={100}
						linkTo={`/hosts/${host.id}`}
						validate={(value) => {
							if (!value.trim()) return "Friendly name is required";
							if (value.trim().length < 1)
								return "Friendly name must be at least 1 character";
							if (value.trim().length > 100)
								return "Friendly name must be less than 100 characters";
							return null;
						}}
						className="w-full"
					/>
				);
			case "hostname":
				return (
					<div className="text-sm text-secondary-900 dark:text-white font-mono">
						{host.hostname || "N/A"}
					</div>
				);
			case "ip":
				return (
					<div className="text-sm text-secondary-900 dark:text-white">
						{host.ip || "N/A"}
					</div>
				);
			case "group":
				return (
					<InlineGroupEdit
						key={`${host.id}-${host.host_groups?.id || "ungrouped"}-${host.host_groups?.name || "ungrouped"}`}
						value={host.host_groups?.id}
						onSave={(newGroupId) =>
							updateHostGroupMutation.mutate({
								hostId: host.id,
								hostGroupId: newGroupId,
							})
						}
						options={hostGroups || []}
						placeholder="Select group..."
						className="w-full"
					/>
				);
			case "os":
				return (
					<div className="flex items-center gap-2 text-sm text-secondary-900 dark:text-white">
						<OSIcon osType={host.os_type} className="h-4 w-4" />
						<span>{host.os_type}</span>
					</div>
				);
			case "os_version":
				return (
					<div className="text-sm text-secondary-900 dark:text-white">
						{host.os_version || "N/A"}
					</div>
				);
			case "agent_version":
				return (
					<div className="text-sm text-secondary-900 dark:text-white">
						{host.agent_version || "N/A"}
					</div>
				);
			case "auto_update":
				return (
					<InlineToggle
						value={host.auto_update}
						onSave={(autoUpdate) =>
							toggleAutoUpdateMutation.mutate({
								hostId: host.id,
								autoUpdate: autoUpdate,
							})
						}
						trueLabel="Yes"
						falseLabel="No"
					/>
				);
			case "status":
				return (
					<div className="text-sm text-secondary-900 dark:text-white">
						{(host.effectiveStatus || host.status).charAt(0).toUpperCase() +
							(host.effectiveStatus || host.status).slice(1)}
					</div>
				);
			case "updates":
				return (
					<button
						type="button"
						onClick={() => navigate(`/packages?host=${host.id}`)}
						className="text-sm text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300 font-medium hover:underline"
						title="View packages for this host"
					>
						{host.updatesCount || 0}
					</button>
				);
			case "last_update":
				return (
					<div className="text-sm text-secondary-500 dark:text-secondary-300">
						{formatRelativeTime(host.last_update)}
					</div>
				);
			case "notes":
				return (
					<div className="text-sm text-secondary-900 dark:text-white max-w-xs">
						{host.notes ? (
							<div className="truncate" title={host.notes}>
								{host.notes}
							</div>
						) : (
							<span className="text-secondary-400 dark:text-secondary-500 italic">
								No notes
							</span>
						)}
					</div>
				);
			case "actions":
				return (
					<Link
						to={`/hosts/${host.id}`}
						className="text-primary-600 hover:text-primary-900 flex items-center gap-1"
					>
						View
						<ExternalLink className="h-3 w-3" />
					</Link>
				);
			default:
				return null;
		}
	};

	const handleHostCreated = (newHost) => {
		queryClient.invalidateQueries(["hosts"]);
		// Navigate to host detail page to show credentials and setup instructions
		navigate(`/hosts/${newHost.hostId}`);
	};

	// Stats card click handlers
	const handleTotalHostsClick = () => {
		// Clear all filters to show all hosts
		setSearchTerm("");
		setGroupFilter("all");
		setStatusFilter("all");
		setOsFilter("all");
		setGroupBy("none");
		setHideStale(false);
		setShowFilters(false);
		// Clear URL parameters to ensure no filters are applied
		navigate("/hosts", { replace: true });
	};

	const handleUpToDateClick = () => {
		// Filter to show only up-to-date hosts
		setStatusFilter("active");
		setShowFilters(true);
		// Use the upToDate URL filter
		const newSearchParams = new URLSearchParams(window.location.search);
		newSearchParams.set("filter", "upToDate");
		navigate(`/hosts?${newSearchParams.toString()}`, { replace: true });
	};

	const handleNeedsUpdatesClick = () => {
		// Filter to show hosts needing updates (regardless of status)
		setStatusFilter("all");
		setShowFilters(true);
		// We'll use the existing needsUpdates URL filter logic
		const newSearchParams = new URLSearchParams(window.location.search);
		newSearchParams.set("filter", "needsUpdates");
		navigate(`/hosts?${newSearchParams.toString()}`, { replace: true });
	};

	const handleStaleClick = () => {
		// Filter to show stale/inactive hosts
		setStatusFilter("inactive");
		setShowFilters(true);
		// We'll use the existing inactive URL filter logic
		const newSearchParams = new URLSearchParams(window.location.search);
		newSearchParams.set("filter", "inactive");
		navigate(`/hosts?${newSearchParams.toString()}`, { replace: true });
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
							Error loading hosts
						</h3>
						<p className="text-sm text-danger-700 mt-1">
							{error.message || "Failed to load hosts"}
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

	return (
		<div className="h-[calc(100vh-7rem)] flex flex-col overflow-hidden">
			{/* Page Header */}
			<div className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-2xl font-semibold text-secondary-900 dark:text-white">
						Hosts
					</h1>
					<p className="text-sm text-secondary-600 dark:text-secondary-400 mt-1">
						Manage and monitor your connected hosts
					</p>
				</div>
				<div className="flex items-center gap-3">
					<button
						type="button"
						onClick={() => refetch()}
						disabled={isFetching}
						className="btn-outline flex items-center gap-2"
						title="Refresh hosts data"
					>
						<RefreshCw
							className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
						/>
						{isFetching ? "Refreshing..." : "Refresh"}
					</button>
					<button
						type="button"
						onClick={() => setShowAddModal(true)}
						className="btn-primary flex items-center gap-2"
					>
						<Plus className="h-4 w-4" />
						Add Host
					</button>
				</div>
			</div>

			{/* Stats Summary */}
			<div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
				<button
					type="button"
					className="card p-4 cursor-pointer hover:shadow-card-hover dark:hover:shadow-card-hover-dark transition-shadow duration-200 text-left w-full"
					onClick={handleTotalHostsClick}
				>
					<div className="flex items-center">
						<Server className="h-5 w-5 text-primary-600 mr-2" />
						<div>
							<p className="text-sm text-secondary-500 dark:text-white">
								Total Hosts
							</p>
							<p className="text-xl font-semibold text-secondary-900 dark:text-white">
								{hosts?.length || 0}
							</p>
						</div>
					</div>
				</button>
				<button
					type="button"
					className="card p-4 cursor-pointer hover:shadow-card-hover dark:hover:shadow-card-hover-dark transition-shadow duration-200 text-left w-full"
					onClick={handleUpToDateClick}
				>
					<div className="flex items-center">
						<CheckCircle className="h-5 w-5 text-success-600 mr-2" />
						<div>
							<p className="text-sm text-secondary-500 dark:text-white">
								Up to Date
							</p>
							<p className="text-xl font-semibold text-secondary-900 dark:text-white">
								{hosts?.filter((h) => !h.isStale && h.updatesCount === 0)
									.length || 0}
							</p>
						</div>
					</div>
				</button>
				<button
					type="button"
					className="card p-4 cursor-pointer hover:shadow-card-hover dark:hover:shadow-card-hover-dark transition-shadow duration-200 text-left w-full"
					onClick={handleNeedsUpdatesClick}
				>
					<div className="flex items-center">
						<Clock className="h-5 w-5 text-warning-600 mr-2" />
						<div>
							<p className="text-sm text-secondary-500 dark:text-white">
								Needs Updates
							</p>
							<p className="text-xl font-semibold text-secondary-900 dark:text-white">
								{hosts?.filter((h) => h.updatesCount > 0).length || 0}
							</p>
						</div>
					</div>
				</button>
				<button
					type="button"
					className="card p-4 cursor-pointer hover:shadow-card-hover dark:hover:shadow-card-hover-dark transition-shadow duration-200 text-left w-full"
					onClick={handleStaleClick}
				>
					<div className="flex items-center">
						<AlertTriangle className="h-5 w-5 text-danger-600 mr-2" />
						<div>
							<p className="text-sm text-secondary-500 dark:text-white">
								Stale
							</p>
							<p className="text-xl font-semibold text-secondary-900 dark:text-white">
								{hosts?.filter((h) => h.isStale).length || 0}
							</p>
						</div>
					</div>
				</button>
			</div>

			{/* Hosts List */}
			<div className="card flex-1 flex flex-col overflow-hidden min-h-0">
				<div className="px-4 py-4 sm:p-4 flex-1 flex flex-col overflow-hidden min-h-0">
					<div className="flex items-center justify-end mb-4">
						{selectedHosts.length > 0 && (
							<div className="flex items-center gap-3">
								<span className="text-sm text-secondary-600">
									{selectedHosts.length} host
									{selectedHosts.length !== 1 ? "s" : ""} selected
								</span>
								<button
									type="button"
									onClick={() => setShowBulkAssignModal(true)}
									className="btn-outline flex items-center gap-2"
								>
									<Users className="h-4 w-4" />
									Assign to Group
								</button>
								<button
									type="button"
									onClick={() => setShowBulkDeleteModal(true)}
									className="btn-danger flex items-center gap-2"
								>
									<Trash2 className="h-4 w-4" />
									Delete
								</button>
								<button
									type="button"
									onClick={() => setSelectedHosts([])}
									className="text-sm text-secondary-500 hover:text-secondary-700"
								>
									Clear Selection
								</button>
							</div>
						)}
					</div>

					{/* Table Controls */}
					<div className="mb-4 space-y-4">
						{/* Search and Filter Bar */}
						<div className="flex flex-col sm:flex-row gap-4">
							<div className="flex-1">
								<div className="relative">
									<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-secondary-400 dark:text-secondary-500" />
									<input
										type="text"
										placeholder="Search hosts, IP addresses, or OS..."
										value={searchTerm}
										onChange={(e) => setSearchTerm(e.target.value)}
										className="pl-10 pr-4 py-2 w-full border border-secondary-300 dark:border-secondary-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-secondary-800 text-secondary-900 dark:text-white placeholder-secondary-500 dark:placeholder-secondary-400"
									/>
								</div>
							</div>
							<div className="flex gap-2">
								<button
									type="button"
									onClick={() => setShowFilters(!showFilters)}
									className={`btn-outline flex items-center gap-2 ${showFilters ? "bg-primary-50 border-primary-300" : ""}`}
								>
									<Filter className="h-4 w-4" />
									Filters
								</button>
								<button
									type="button"
									onClick={() => setShowColumnSettings(true)}
									className="btn-outline flex items-center gap-2"
								>
									<Columns className="h-4 w-4" />
									Columns
								</button>
								<div className="relative">
									<select
										value={groupBy}
										onChange={(e) => setGroupBy(e.target.value)}
										className="appearance-none bg-white dark:bg-secondary-800 border-2 border-secondary-300 dark:border-secondary-600 rounded-lg px-2 py-2 pr-6 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-secondary-900 dark:text-white hover:border-secondary-400 dark:hover:border-secondary-500 transition-colors min-w-[120px]"
									>
										<option value="none">No Grouping</option>
										<option value="group">By Group</option>
										<option value="status">By Status</option>
										<option value="os">By OS</option>
									</select>
									<ChevronDown className="absolute right-1 top-1/2 transform -translate-y-1/2 h-4 w-4 text-secondary-400 dark:text-secondary-500 pointer-events-none" />
								</div>
								<button
									type="button"
									onClick={() => setHideStale(!hideStale)}
									className={`btn-outline flex items-center gap-2 ${hideStale ? "bg-primary-50 border-primary-300" : ""}`}
								>
									<AlertTriangle className="h-4 w-4" />
									Hide Stale
								</button>
								<button
									type="button"
									onClick={() => setShowAddModal(true)}
									className="btn-primary flex items-center gap-2"
								>
									<Plus className="h-4 w-4" />
									Add Host
								</button>
							</div>
						</div>

						{/* Advanced Filters */}
						{showFilters && (
							<div className="bg-secondary-50 dark:bg-secondary-700 p-4 rounded-lg border dark:border-secondary-600">
								<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
									<div>
										<label
											htmlFor={hostGroupFilterId}
											className="block text-sm font-medium text-secondary-700 dark:text-secondary-200 mb-1"
										>
											Host Group
										</label>
										<select
											id={hostGroupFilterId}
											value={groupFilter}
											onChange={(e) => setGroupFilter(e.target.value)}
											className="w-full border border-secondary-300 dark:border-secondary-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-secondary-800 text-secondary-900 dark:text-white"
										>
											<option value="all">All Groups</option>
											<option value="ungrouped">Ungrouped</option>
											{hostGroups?.map((group) => (
												<option key={group.id} value={group.id}>
													{group.name}
												</option>
											))}
										</select>
									</div>
									<div>
										<label
											htmlFor={statusFilterId}
											className="block text-sm font-medium text-secondary-700 dark:text-secondary-200 mb-1"
										>
											Status
										</label>
										<select
											id={statusFilterId}
											value={statusFilter}
											onChange={(e) => setStatusFilter(e.target.value)}
											className="w-full border border-secondary-300 dark:border-secondary-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-secondary-800 text-secondary-900 dark:text-white"
										>
											<option value="all">All Status</option>
											<option value="active">Active</option>
											<option value="pending">Pending</option>
											<option value="inactive">Inactive</option>
											<option value="error">Error</option>
										</select>
									</div>
									<div>
										<label
											htmlFor={osFilterId}
											className="block text-sm font-medium text-secondary-700 dark:text-secondary-200 mb-1"
										>
											Operating System
										</label>
										<select
											id={osFilterId}
											value={osFilter}
											onChange={(e) => setOsFilter(e.target.value)}
											className="w-full border border-secondary-300 dark:border-secondary-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-secondary-800 text-secondary-900 dark:text-white"
										>
											<option value="all">All OS</option>
											<option value="linux">Linux</option>
											<option value="windows">Windows</option>
											<option value="macos">macOS</option>
										</select>
									</div>
									<div className="flex items-end">
										<button
											type="button"
											onClick={() => {
												setSearchTerm("");
												setGroupFilter("all");
												setStatusFilter("all");
												setOsFilter("all");
												setGroupBy("none");
												setHideStale(false);
											}}
											className="btn-outline w-full"
										>
											Clear Filters
										</button>
									</div>
								</div>
							</div>
						)}
					</div>

					<div className="flex-1 overflow-hidden">
						{!hosts || hosts.length === 0 ? (
							<div className="text-center py-8">
								<Server className="h-12 w-12 text-secondary-400 mx-auto mb-4" />
								<p className="text-secondary-500">No hosts registered yet</p>
								<p className="text-sm text-secondary-400 mt-2">
									Click "Add Host" to manually register a new host and get API
									credentials
								</p>
							</div>
						) : filteredAndSortedHosts.length === 0 ? (
							<div className="text-center py-8">
								<Search className="h-12 w-12 text-secondary-400 mx-auto mb-4" />
								<p className="text-secondary-500">
									No hosts match your current filters
								</p>
								<p className="text-sm text-secondary-400 mt-2">
									Try adjusting your search terms or filters to see more results
								</p>
							</div>
						) : (
							<div className="h-full overflow-auto">
								<div className="space-y-6">
									{Object.entries(groupedHosts).map(
										([groupName, groupHosts]) => (
											<div key={groupName} className="space-y-3">
												{/* Group Header */}
												{groupBy !== "none" && (
													<div className="flex items-center justify-between bg-secondary-100 dark:bg-secondary-700 px-4 py-2 rounded-lg">
														<h3 className="text-sm font-medium text-secondary-900 dark:text-white">
															{groupName} ({groupHosts.length})
														</h3>
													</div>
												)}

												{/* Table for this group */}
												<div className="overflow-x-auto">
													<table className="min-w-full divide-y divide-secondary-200 dark:divide-secondary-600">
														<thead className="bg-secondary-50 dark:bg-secondary-700">
															<tr>
																{visibleColumns.map((column) => (
																	<th
																		key={column.id}
																		className="px-4 py-2 text-center text-xs font-medium text-secondary-500 dark:text-secondary-300 uppercase tracking-wider"
																	>
																		{column.id === "select" ? (
																			<button
																				type="button"
																				onClick={handleSelectAll}
																				className="flex items-center gap-2 hover:text-secondary-700"
																			>
																				{selectedHosts.length ===
																				groupHosts.length ? (
																					<CheckSquare className="h-4 w-4" />
																				) : (
																					<Square className="h-4 w-4" />
																				)}
																			</button>
																		) : column.id === "host" ? (
																			<button
																				type="button"
																				onClick={() =>
																					handleSort("friendlyName")
																				}
																				className="flex items-center gap-2 hover:text-secondary-700"
																			>
																				{column.label}
																				{getSortIcon("friendlyName")}
																			</button>
																		) : column.id === "hostname" ? (
																			<button
																				type="button"
																				onClick={() => handleSort("hostname")}
																				className="flex items-center gap-2 hover:text-secondary-700"
																			>
																				{column.label}
																				{getSortIcon("hostname")}
																			</button>
																		) : column.id === "ip" ? (
																			<button
																				type="button"
																				onClick={() => handleSort("ip")}
																				className="flex items-center gap-2 hover:text-secondary-700"
																			>
																				{column.label}
																				{getSortIcon("ip")}
																			</button>
																		) : column.id === "group" ? (
																			<button
																				type="button"
																				onClick={() => handleSort("group")}
																				className="flex items-center gap-2 hover:text-secondary-700"
																			>
																				{column.label}
																				{getSortIcon("group")}
																			</button>
																		) : column.id === "os" ? (
																			<button
																				type="button"
																				onClick={() => handleSort("os")}
																				className="flex items-center gap-2 hover:text-secondary-700"
																			>
																				{column.label}
																				{getSortIcon("os")}
																			</button>
																		) : column.id === "os_version" ? (
																			<button
																				type="button"
																				onClick={() => handleSort("os_version")}
																				className="flex items-center gap-2 hover:text-secondary-700"
																			>
																				{column.label}
																				{getSortIcon("os_version")}
																			</button>
																		) : column.id === "agent_version" ? (
																			<button
																				type="button"
																				onClick={() =>
																					handleSort("agent_version")
																				}
																				className="flex items-center gap-2 hover:text-secondary-700"
																			>
																				{column.label}
																				{getSortIcon("agent_version")}
																			</button>
																		) : column.id === "auto_update" ? (
																			<div className="flex items-center gap-2 font-normal text-xs text-secondary-500 dark:text-secondary-300 normal-case tracking-wider">
																				{column.label}
																			</div>
																		) : column.id === "status" ? (
																			<button
																				type="button"
																				onClick={() => handleSort("status")}
																				className="flex items-center gap-2 hover:text-secondary-700"
																			>
																				{column.label}
																				{getSortIcon("status")}
																			</button>
																		) : column.id === "updates" ? (
																			<button
																				type="button"
																				onClick={() => handleSort("updates")}
																				className="flex items-center gap-2 hover:text-secondary-700"
																			>
																				{column.label}
																				{getSortIcon("updates")}
																			</button>
																		) : column.id === "last_update" ? (
																			<button
																				type="button"
																				onClick={() =>
																					handleSort("last_update")
																				}
																				className="flex items-center gap-2 hover:text-secondary-700"
																			>
																				{column.label}
																				{getSortIcon("last_update")}
																			</button>
																		) : (
																			column.label
																		)}
																	</th>
																))}
															</tr>
														</thead>
														<tbody className="bg-white dark:bg-secondary-800 divide-y divide-secondary-200 dark:divide-secondary-600">
															{groupHosts.map((host) => {
																const isInactive =
																	(host.effectiveStatus || host.status) ===
																	"inactive";
																const isSelected = selectedHosts.includes(
																	host.id,
																);

																let rowClasses =
																	"hover:bg-secondary-50 dark:hover:bg-secondary-700";

																if (isSelected) {
																	rowClasses +=
																		" bg-primary-50 dark:bg-primary-600";
																} else if (isInactive) {
																	rowClasses += " bg-red-50 dark:bg-red-900/20";
																}

																return (
																	<tr key={host.id} className={rowClasses}>
																		{visibleColumns.map((column) => (
																			<td
																				key={column.id}
																				className="px-4 py-2 whitespace-nowrap text-center"
																			>
																				{renderCellContent(column, host)}
																			</td>
																		))}
																	</tr>
																);
															})}
														</tbody>
													</table>
												</div>
											</div>
										),
									)}
								</div>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Modals */}
			<AddHostModal
				isOpen={showAddModal}
				onClose={() => setShowAddModal(false)}
				onSuccess={handleHostCreated}
			/>

			{/* Bulk Assign Modal */}
			{showBulkAssignModal && (
				<BulkAssignModal
					selectedHosts={selectedHosts}
					hosts={hosts}
					onClose={() => setShowBulkAssignModal(false)}
					onAssign={handleBulkAssign}
					isLoading={bulkUpdateGroupMutation.isPending}
				/>
			)}

			{/* Bulk Delete Modal */}
			{showBulkDeleteModal && (
				<BulkDeleteModal
					selectedHosts={selectedHosts}
					hosts={hosts}
					onClose={() => setShowBulkDeleteModal(false)}
					onDelete={handleBulkDelete}
					isLoading={bulkDeleteMutation.isPending}
				/>
			)}

			{/* Column Settings Modal */}
			{showColumnSettings && (
				<ColumnSettingsModal
					columnConfig={columnConfig}
					onClose={() => setShowColumnSettings(false)}
					onToggleVisibility={toggleColumnVisibility}
					onReorder={reorderColumns}
					onReset={resetColumns}
				/>
			)}
		</div>
	);
};

// Bulk Assign Modal Component
const BulkAssignModal = ({
	selectedHosts,
	hosts,
	onClose,
	onAssign,
	isLoading,
}) => {
	const [selectedGroupId, setSelectedGroupId] = useState("");

	// Fetch host groups for selection
	const { data: hostGroups } = useQuery({
		queryKey: ["hostGroups"],
		queryFn: () => hostGroupsAPI.list().then((res) => res.data),
	});

	const selectedHostNames = hosts
		.filter((host) => selectedHosts.includes(host.id))
		.map((host) => host.friendly_name);

	const handleSubmit = (e) => {
		e.preventDefault();
		onAssign(selectedGroupId || null);
	};

	return (
		<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
			<div className="bg-white rounded-lg p-6 w-full max-w-md">
				<div className="flex justify-between items-center mb-4">
					<h3 className="text-lg font-semibold text-secondary-900">
						Assign to Host Group
					</h3>
					<button
						type="button"
						onClick={onClose}
						className="text-secondary-400 hover:text-secondary-600"
					>
						<X className="h-5 w-5" />
					</button>
				</div>

				<div className="mb-4">
					<p className="text-sm text-secondary-600 mb-2">
						Assigning {selectedHosts.length} host
						{selectedHosts.length !== 1 ? "s" : ""}:
					</p>
					<div className="max-h-32 overflow-y-auto bg-secondary-50 rounded-md p-3">
						{selectedHostNames.map((friendlyName) => (
							<div key={friendlyName} className="text-sm text-secondary-700">
								• {friendlyName}
							</div>
						))}
					</div>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<label
							htmlFor={bulkHostGroupId}
							className="block text-sm font-medium text-secondary-700 mb-1"
						>
							Host Group
						</label>
						<select
							id={bulkHostGroupId}
							value={selectedGroupId}
							onChange={(e) => setSelectedGroupId(e.target.value)}
							className="w-full px-3 py-2 border border-secondary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
						>
							<option value="">No group (ungrouped)</option>
							{hostGroups?.map((group) => (
								<option key={group.id} value={group.id}>
									{group.name}
								</option>
							))}
						</select>
						<p className="mt-1 text-sm text-secondary-500">
							Select a group to assign these hosts to, or leave ungrouped.
						</p>
					</div>

					<div className="flex justify-end gap-3 pt-4">
						<button
							type="button"
							onClick={onClose}
							className="btn-outline"
							disabled={isLoading}
						>
							Cancel
						</button>
						<button type="submit" className="btn-primary" disabled={isLoading}>
							{isLoading ? "Assigning..." : "Assign to Group"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
};

// Bulk Delete Modal Component
const BulkDeleteModal = ({
	selectedHosts,
	hosts,
	onClose,
	onDelete,
	isLoading,
}) => {
	const selectedHostNames = hosts
		.filter((host) => selectedHosts.includes(host.id))
		.map((host) => host.friendly_name || host.hostname || host.id);

	const handleSubmit = (e) => {
		e.preventDefault();
		onDelete();
	};

	return (
		<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
			<div className="bg-white dark:bg-secondary-800 rounded-lg shadow-xl max-w-md w-full mx-4">
				<div className="px-6 py-4 border-b border-secondary-200 dark:border-secondary-600">
					<div className="flex items-center justify-between">
						<h3 className="text-lg font-medium text-secondary-900 dark:text-white">
							Delete Hosts
						</h3>
						<button
							type="button"
							onClick={onClose}
							className="text-secondary-400 hover:text-secondary-600 dark:text-secondary-500 dark:hover:text-secondary-300"
							disabled={isLoading}
						>
							<X className="h-5 w-5" />
						</button>
					</div>
				</div>

				<div className="px-6 py-4">
					<div className="mb-4">
						<div className="flex items-center gap-2 mb-3">
							<AlertTriangle className="h-5 w-5 text-danger-600" />
							<h4 className="text-sm font-medium text-danger-800 dark:text-danger-200">
								Warning: This action cannot be undone
							</h4>
						</div>
						<p className="text-sm text-secondary-600 dark:text-secondary-400 mb-4">
							You are about to permanently delete {selectedHosts.length} host
							{selectedHosts.length !== 1 ? "s" : ""}. This will remove all host
							data, including package information, update history, and API
							credentials.
						</p>
					</div>

					<div className="mb-4">
						<p className="text-sm text-secondary-600 dark:text-secondary-400 mb-2">
							Hosts to be deleted:
						</p>
						<div className="max-h-32 overflow-y-auto bg-secondary-50 dark:bg-secondary-700 rounded-md p-3">
							{selectedHostNames.map((friendlyName) => (
								<div
									key={friendlyName}
									className="text-sm text-secondary-700 dark:text-secondary-300"
								>
									• {friendlyName}
								</div>
							))}
						</div>
					</div>

					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="flex justify-end gap-3 pt-4">
							<button
								type="button"
								onClick={onClose}
								className="btn-outline"
								disabled={isLoading}
							>
								Cancel
							</button>
							<button type="submit" className="btn-danger" disabled={isLoading}>
								{isLoading
									? "Deleting..."
									: `Delete ${selectedHosts.length} Host${selectedHosts.length !== 1 ? "s" : ""}`}
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	);
};

// Column Settings Modal Component
const ColumnSettingsModal = ({
	columnConfig,
	onClose,
	onToggleVisibility,
	onReorder,
	onReset,
}) => {
	const [draggedIndex, setDraggedIndex] = useState(null);

	const handleDragStart = (e, index) => {
		setDraggedIndex(index);
		e.dataTransfer.effectAllowed = "move";
	};

	const handleDragOver = (e) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
	};

	const handleDrop = (e, dropIndex) => {
		e.preventDefault();
		if (draggedIndex !== null && draggedIndex !== dropIndex) {
			onReorder(draggedIndex, dropIndex);
		}
		setDraggedIndex(null);
	};

	return (
		<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
			<div className="bg-white dark:bg-secondary-800 rounded-lg shadow-xl max-w-md w-full mx-4">
				<div className="px-6 py-4 border-b border-secondary-200 dark:border-secondary-600">
					<div className="flex items-center justify-between">
						<h3 className="text-lg font-medium text-secondary-900 dark:text-white">
							Column Settings
						</h3>
						<button
							type="button"
							onClick={onClose}
							className="text-secondary-400 hover:text-secondary-600 dark:text-secondary-500 dark:hover:text-secondary-300"
						>
							<X className="h-5 w-5" />
						</button>
					</div>
				</div>

				<div className="px-6 py-4">
					<p className="text-sm text-secondary-600 dark:text-secondary-300 mb-4">
						Drag to reorder columns or toggle visibility
					</p>

					<div className="space-y-2">
						{columnConfig.map((column, index) => (
							<button
								key={column.id}
								type="button"
								draggable
								tabIndex={0}
								aria-label={`Drag to reorder ${column.label} column`}
								onDragStart={(e) => handleDragStart(e, index)}
								onDragOver={handleDragOver}
								onDrop={(e) => handleDrop(e, index)}
								onKeyDown={(e) => {
									if (e.key === "Enter" || e.key === " ") {
										e.preventDefault();
										// Focus handling for keyboard users
									}
								}}
								className={`flex items-center justify-between p-3 border rounded-lg cursor-move w-full text-left ${
									draggedIndex === index
										? "opacity-50"
										: "hover:bg-secondary-50 dark:hover:bg-secondary-700"
								} border-secondary-200 dark:border-secondary-600`}
							>
								<div className="flex items-center gap-3">
									<GripVertical className="h-4 w-4 text-secondary-400 dark:text-secondary-500" />
									<span className="text-sm font-medium text-secondary-900 dark:text-white">
										{column.label}
									</span>
								</div>
								<button
									type="button"
									onClick={() => onToggleVisibility(column.id)}
									className={`p-1 rounded ${
										column.visible
											? "text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
											: "text-secondary-400 hover:text-secondary-600 dark:text-secondary-500 dark:hover:text-secondary-300"
									}`}
								>
									{column.visible ? (
										<EyeIcon className="h-4 w-4" />
									) : (
										<EyeOffIcon className="h-4 w-4" />
									)}
								</button>
							</button>
						))}
					</div>

					<div className="flex justify-between mt-6">
						<button type="button" onClick={onReset} className="btn-outline">
							Reset to Default
						</button>
						<button type="button" onClick={onClose} className="btn-primary">
							Done
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};

export default Hosts;
