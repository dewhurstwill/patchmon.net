import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertTriangle,
	ArrowDown,
	ArrowUp,
	ArrowUpDown,
	Container,
	ExternalLink,
	Package,
	RefreshCw,
	Search,
	Server,
	Shield,
	Trash2,
	X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../utils/api";

const Docker = () => {
	const queryClient = useQueryClient();
	const [searchTerm, setSearchTerm] = useState("");
	const [activeTab, setActiveTab] = useState("containers");
	const [sortField, setSortField] = useState("status");
	const [sortDirection, setSortDirection] = useState("asc");
	const [statusFilter, setStatusFilter] = useState("all");
	const [sourceFilter, setSourceFilter] = useState("all");
	const [deleteContainerModal, setDeleteContainerModal] = useState(null);
	const [deleteImageModal, setDeleteImageModal] = useState(null);

	// Fetch Docker dashboard data
	const { data: dashboard, isLoading: dashboardLoading } = useQuery({
		queryKey: ["docker", "dashboard"],
		queryFn: async () => {
			const response = await api.get("/docker/dashboard");
			return response.data;
		},
		refetchInterval: 30000, // Refresh every 30 seconds
	});

	// Fetch containers
	const {
		data: containersData,
		isLoading: containersLoading,
		refetch: refetchContainers,
	} = useQuery({
		queryKey: ["docker", "containers", statusFilter],
		queryFn: async () => {
			const params = new URLSearchParams();
			if (statusFilter !== "all") params.set("status", statusFilter);
			params.set("limit", "1000");
			const response = await api.get(`/docker/containers?${params}`);
			return response.data;
		},
		enabled: activeTab === "containers",
	});

	// Fetch images
	const {
		data: imagesData,
		isLoading: imagesLoading,
		refetch: refetchImages,
	} = useQuery({
		queryKey: ["docker", "images", sourceFilter],
		queryFn: async () => {
			const params = new URLSearchParams();
			if (sourceFilter !== "all") params.set("source", sourceFilter);
			params.set("limit", "1000");
			const response = await api.get(`/docker/images?${params}`);
			return response.data;
		},
		enabled: activeTab === "images",
	});

	// Fetch hosts
	const { data: hostsData, isLoading: hostsLoading } = useQuery({
		queryKey: ["docker", "hosts"],
		queryFn: async () => {
			const response = await api.get("/docker/hosts?limit=1000");
			return response.data;
		},
		enabled: activeTab === "hosts",
	});

	// Fetch updates
	const { data: updatesData, isLoading: updatesLoading } = useQuery({
		queryKey: ["docker", "updates"],
		queryFn: async () => {
			const response = await api.get("/docker/updates?limit=1000");
			return response.data;
		},
		enabled: activeTab === "updates",
	});

	// Delete container mutation
	const deleteContainerMutation = useMutation({
		mutationFn: async (containerId) => {
			const response = await api.delete(`/docker/containers/${containerId}`);
			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries(["docker", "containers"]);
			queryClient.invalidateQueries(["docker", "dashboard"]);
			setDeleteContainerModal(null);
		},
		onError: (error) => {
			alert(
				`Failed to delete container: ${error.response?.data?.error || error.message}`,
			);
		},
	});

	// Delete image mutation
	const deleteImageMutation = useMutation({
		mutationFn: async (imageId) => {
			const response = await api.delete(`/docker/images/${imageId}`);
			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries(["docker", "images"]);
			queryClient.invalidateQueries(["docker", "dashboard"]);
			setDeleteImageModal(null);
		},
		onError: (error) => {
			alert(
				`Failed to delete image: ${error.response?.data?.error || error.message}`,
			);
		},
	});

	// Filter and sort containers
	const filteredContainers = useMemo(() => {
		if (!containersData?.containers) return [];
		let filtered = containersData.containers;

		if (searchTerm) {
			const term = searchTerm.toLowerCase();
			filtered = filtered.filter(
				(c) =>
					c.name.toLowerCase().includes(term) ||
					c.image_name.toLowerCase().includes(term) ||
					c.host?.friendly_name?.toLowerCase().includes(term),
			);
		}

		filtered.sort((a, b) => {
			let aValue, bValue;
			if (sortField === "name") {
				aValue = a.name?.toLowerCase() || "";
				bValue = b.name?.toLowerCase() || "";
			} else if (sortField === "image") {
				aValue = a.image_name?.toLowerCase() || "";
				bValue = b.image_name?.toLowerCase() || "";
			} else if (sortField === "status") {
				// Custom status priority: running first, then others alphabetically
				const statusPriority = {
					running: 1,
					created: 2,
					restarting: 3,
					paused: 4,
					exited: 5,
					dead: 6,
				};
				const aPriority = statusPriority[a.status] || 999;
				const bPriority = statusPriority[b.status] || 999;

				if (sortDirection === "asc") {
					if (aPriority !== bPriority) return aPriority - bPriority;
					// Secondary sort by name within same status
					return (a.name?.toLowerCase() || "").localeCompare(
						b.name?.toLowerCase() || "",
					);
				} else {
					if (aPriority !== bPriority) return bPriority - aPriority;
					// Secondary sort by name within same status
					return (b.name?.toLowerCase() || "").localeCompare(
						a.name?.toLowerCase() || "",
					);
				}
			} else if (sortField === "host") {
				aValue = a.host?.friendly_name?.toLowerCase() || "";
				bValue = b.host?.friendly_name?.toLowerCase() || "";
			}

			if (sortField !== "status") {
				if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
				if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
			}
			return 0;
		});

		return filtered;
	}, [containersData, searchTerm, sortField, sortDirection]);

	// Filter and sort images
	const filteredImages = useMemo(() => {
		if (!imagesData?.images) return [];
		let filtered = imagesData.images;

		if (searchTerm) {
			const term = searchTerm.toLowerCase();
			filtered = filtered.filter(
				(img) =>
					img.repository.toLowerCase().includes(term) ||
					img.tag.toLowerCase().includes(term),
			);
		}

		filtered.sort((a, b) => {
			let aValue, bValue;
			if (sortField === "repository") {
				aValue = a.repository?.toLowerCase() || "";
				bValue = b.repository?.toLowerCase() || "";
			} else if (sortField === "tag") {
				aValue = a.tag || "";
				bValue = b.tag || "";
			} else if (sortField === "containers") {
				aValue = a._count?.docker_containers || 0;
				bValue = b._count?.docker_containers || 0;
			}

			if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
			if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
			return 0;
		});

		return filtered;
	}, [imagesData, searchTerm, sortField, sortDirection]);

	// Filter and sort hosts
	const filteredHosts = useMemo(() => {
		if (!hostsData?.hosts) return [];
		let filtered = hostsData.hosts;

		if (searchTerm) {
			const term = searchTerm.toLowerCase();
			filtered = filtered.filter(
				(h) =>
					h.friendly_name?.toLowerCase().includes(term) ||
					h.hostname?.toLowerCase().includes(term),
			);
		}

		filtered.sort((a, b) => {
			let aValue, bValue;
			if (sortField === "name") {
				aValue = a.friendly_name?.toLowerCase() || "";
				bValue = b.friendly_name?.toLowerCase() || "";
			} else if (sortField === "containers") {
				aValue = a.dockerStats?.totalContainers || 0;
				bValue = b.dockerStats?.totalContainers || 0;
			} else if (sortField === "images") {
				aValue = a.dockerStats?.totalImages || 0;
				bValue = b.dockerStats?.totalImages || 0;
			}

			if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
			if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
			return 0;
		});

		return filtered;
	}, [hostsData, searchTerm, sortField, sortDirection]);

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

	const getStatusBadge = (status) => {
		const statusClasses = {
			running:
				"bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
			exited: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
			paused:
				"bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
			restarting:
				"bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
		};
		return (
			<span
				className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
					statusClasses[status] ||
					"bg-secondary-100 text-secondary-800 dark:bg-secondary-700 dark:text-secondary-200"
				}`}
			>
				{status}
			</span>
		);
	};

	const getSourceBadge = (source) => {
		const badges = {
			"docker-hub": (
				<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
					Docker Hub
				</span>
			),
			github: (
				<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary-100 text-secondary-900 dark:bg-secondary-700 dark:text-white">
					GitHub
				</span>
			),
			gitlab: (
				<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
					GitLab
				</span>
			),
			private: (
				<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
					Private
				</span>
			),
		};
		return (
			badges[source] || (
				<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary-100 text-secondary-800 dark:bg-secondary-700 dark:text-secondary-200">
					{source}
				</span>
			)
		);
	};

	return (
		<div className="h-[calc(100vh-7rem)] flex flex-col overflow-hidden">
			{/* Header */}
			<div className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-2xl font-semibold text-secondary-900 dark:text-white">
						Docker Inventory
					</h1>
					<p className="text-sm text-secondary-600 dark:text-secondary-400 mt-1">
						Monitor containers, images, and updates across your infrastructure
					</p>
				</div>
				<div className="flex items-center gap-3">
					<button
						type="button"
						onClick={() => {
							// Trigger refresh based on active tab
							if (activeTab === "containers") refetchContainers();
							else if (activeTab === "images") refetchImages();
							else window.location.reload();
						}}
						className="btn-outline flex items-center justify-center p-2"
						title="Refresh data"
					>
						<RefreshCw className="h-4 w-4" />
					</button>
				</div>
			</div>

			{/* Stats Summary */}
			<div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
				<div className="card p-4">
					<div className="flex items-center">
						<div className="flex-shrink-0">
							<Server className="h-5 w-5 text-primary-600 mr-2" />
						</div>
						<div className="w-0 flex-1">
							<p className="text-sm text-secondary-500 dark:text-white">
								Hosts with Docker
							</p>
							<p className="text-xl font-semibold text-secondary-900 dark:text-white">
								{dashboardLoading ? (
									<span className="animate-pulse">-</span>
								) : (
									dashboard?.stats?.totalHostsWithDocker || 0
								)}
							</p>
						</div>
					</div>
				</div>

				<div className="card p-4">
					<div className="flex items-center">
						<div className="flex-shrink-0">
							<Container className="h-5 w-5 text-green-600 mr-2" />
						</div>
						<div className="w-0 flex-1">
							<p className="text-sm text-secondary-500 dark:text-white">
								Running Containers
							</p>
							<p className="text-xl font-semibold text-secondary-900 dark:text-white">
								{dashboardLoading ? (
									<span className="animate-pulse">-</span>
								) : (
									<>
										{dashboard?.stats?.runningContainers || 0}
										<span className="ml-2 text-sm text-secondary-500 dark:text-secondary-400 font-normal">
											/ {dashboard?.stats?.totalContainers || 0} total
										</span>
									</>
								)}
							</p>
						</div>
					</div>
				</div>

				<div className="card p-4">
					<div className="flex items-center">
						<div className="flex-shrink-0">
							<Package className="h-5 w-5 text-blue-600 mr-2" />
						</div>
						<div className="w-0 flex-1">
							<p className="text-sm text-secondary-500 dark:text-white">
								Total Images
							</p>
							<p className="text-xl font-semibold text-secondary-900 dark:text-white">
								{dashboardLoading ? (
									<span className="animate-pulse">-</span>
								) : (
									dashboard?.stats?.totalImages || 0
								)}
							</p>
						</div>
					</div>
				</div>

				<div className="card p-4">
					<div className="flex items-center">
						<div className="flex-shrink-0">
							<AlertTriangle className="h-5 w-5 text-warning-600 mr-2" />
						</div>
						<div className="w-0 flex-1">
							<p className="text-sm text-secondary-500 dark:text-white">
								Updates Available
							</p>
							<p className="text-xl font-semibold text-secondary-900 dark:text-white">
								{dashboardLoading ? (
									<span className="animate-pulse">-</span>
								) : (
									dashboard?.stats?.availableUpdates || 0
								)}
							</p>
						</div>
					</div>
				</div>
			</div>

			{/* Docker List */}
			<div className="card flex-1 flex flex-col overflow-hidden min-h-0">
				{/* Tab Navigation */}
				<div className="border-b border-secondary-200 dark:border-secondary-600">
					<nav className="-mb-px flex space-x-8 px-4" aria-label="Tabs">
						{[
							{ id: "containers", label: "Containers", icon: Container },
							{ id: "images", label: "Images", icon: Package },
							{ id: "hosts", label: "Hosts", icon: Server },
							{ id: "updates", label: "Updates", icon: AlertTriangle },
						].map((tab) => {
							const Icon = tab.icon;
							return (
								<button
									key={tab.id}
									type="button"
									onClick={() => {
										setActiveTab(tab.id);
										setSearchTerm("");
										setSortField(
											tab.id === "containers"
												? "status"
												: tab.id === "images"
													? "repository"
													: "name",
										);
										setSortDirection("asc");
									}}
									className={`${
										activeTab === tab.id
											? "border-primary-500 text-primary-600 dark:text-primary-400"
											: "border-transparent text-secondary-500 hover:text-secondary-700 hover:border-secondary-300 dark:text-secondary-400 dark:hover:text-secondary-300"
									} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
								>
									<Icon className="h-4 w-4 mr-2" />
									{tab.label}
								</button>
							);
						})}
					</nav>
				</div>

				{/* Filters and Search */}
				<div className="p-4 border-b border-secondary-200 dark:border-secondary-600">
					<div className="flex flex-col sm:flex-row gap-4">
						<div className="flex-1">
							<div className="relative">
								<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
									<Search className="h-5 w-5 text-secondary-400" />
								</div>
								<input
									type="text"
									className="block w-full pl-10 pr-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md leading-5 bg-white dark:bg-secondary-700 text-secondary-900 dark:text-white placeholder-secondary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
									placeholder={`Search ${activeTab}...`}
									value={searchTerm}
									onChange={(e) => setSearchTerm(e.target.value)}
								/>
								{searchTerm && (
									<button
										type="button"
										onClick={() => setSearchTerm("")}
										className="absolute inset-y-0 right-0 pr-3 flex items-center"
									>
										<X className="h-5 w-5 text-secondary-400 hover:text-secondary-600" />
									</button>
								)}
							</div>
						</div>
						{activeTab === "containers" && (
							<select
								value={statusFilter}
								onChange={(e) => setStatusFilter(e.target.value)}
								className="block w-full sm:w-48 pl-3 pr-10 py-2 text-base border-secondary-300 dark:border-secondary-600 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md bg-white dark:bg-secondary-700 text-secondary-900 dark:text-white"
							>
								<option value="all">All Statuses</option>
								<option value="running">Running</option>
								<option value="exited">Exited</option>
								<option value="paused">Paused</option>
								<option value="restarting">Restarting</option>
							</select>
						)}
						{activeTab === "images" && (
							<select
								value={sourceFilter}
								onChange={(e) => setSourceFilter(e.target.value)}
								className="block w-full sm:w-48 pl-3 pr-10 py-2 text-base border-secondary-300 dark:border-secondary-600 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md bg-white dark:bg-secondary-700 text-secondary-900 dark:text-white"
							>
								<option value="all">All Sources</option>
								<option value="docker-hub">Docker Hub</option>
								<option value="github">GitHub</option>
								<option value="gitlab">GitLab</option>
								<option value="private">Private</option>
							</select>
						)}
					</div>
				</div>

				{/* Tab Content */}
				<div className="p-4 flex-1 overflow-auto">
					{/* Containers Tab */}
					{activeTab === "containers" && (
						<div className="overflow-x-auto">
							{containersLoading ? (
								<div className="text-center py-8">
									<RefreshCw className="h-8 w-8 animate-spin mx-auto text-secondary-400" />
									<p className="mt-2 text-sm text-secondary-500">
										Loading containers...
									</p>
								</div>
							) : filteredContainers.length === 0 ? (
								<div className="text-center py-8">
									<Container className="h-12 w-12 mx-auto text-secondary-400" />
									<h3 className="mt-2 text-sm font-medium text-secondary-900 dark:text-white">
										No containers found
									</h3>
									<p className="mt-1 text-sm text-secondary-500">
										{searchTerm
											? "Try adjusting your search filters"
											: "No Docker containers detected on any hosts"}
									</p>
								</div>
							) : (
								<table className="min-w-full divide-y divide-secondary-200 dark:divide-secondary-600">
									<thead className="bg-secondary-50 dark:bg-secondary-700">
										<tr>
											<th className="px-4 py-2 text-left text-xs font-medium text-secondary-500 dark:text-secondary-300 uppercase tracking-wider">
												<button
													type="button"
													onClick={() => handleSort("name")}
													className="flex items-center gap-2 hover:text-secondary-700"
												>
													Container Name
													{getSortIcon("name")}
												</button>
											</th>
											<th className="px-4 py-2 text-left text-xs font-medium text-secondary-500 dark:text-secondary-300 uppercase tracking-wider">
												<button
													type="button"
													onClick={() => handleSort("image")}
													className="flex items-center gap-2 hover:text-secondary-700"
												>
													Image
													{getSortIcon("image")}
												</button>
											</th>
											<th className="px-4 py-2 text-center text-xs font-medium text-secondary-500 dark:text-secondary-300 uppercase tracking-wider">
												<button
													type="button"
													onClick={() => handleSort("status")}
													className="flex items-center gap-2 hover:text-secondary-700"
												>
													Status
													{getSortIcon("status")}
												</button>
											</th>
											<th className="px-4 py-2 text-left text-xs font-medium text-secondary-500 dark:text-secondary-300 uppercase tracking-wider">
												<button
													type="button"
													onClick={() => handleSort("host")}
													className="flex items-center gap-2 hover:text-secondary-700"
												>
													Host
													{getSortIcon("host")}
												</button>
											</th>
											<th className="px-4 py-2 text-center text-xs font-medium text-secondary-500 dark:text-secondary-300 uppercase tracking-wider">
												Actions
											</th>
										</tr>
									</thead>
									<tbody className="bg-white dark:bg-secondary-800 divide-y divide-secondary-200 dark:divide-secondary-600">
										{filteredContainers.map((container) => (
											<tr
												key={container.id}
												className="hover:bg-secondary-50 dark:hover:bg-secondary-700 transition-colors"
											>
												<td className="px-4 py-2 whitespace-nowrap">
													<div className="flex items-center gap-2">
														<Container className="h-4 w-4 text-secondary-400 dark:text-secondary-500 flex-shrink-0" />
														<Link
															to={`/docker/containers/${container.id}`}
															className="text-sm font-medium text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300 truncate"
														>
															{container.name}
														</Link>
													</div>
												</td>
												<td className="px-4 py-2">
													<div className="text-sm text-secondary-900 dark:text-white">
														{container.image_name}:{container.image_tag}
													</div>
												</td>
												<td className="px-4 py-2 whitespace-nowrap text-center">
													{getStatusBadge(container.status)}
												</td>
												<td className="px-4 py-2 whitespace-nowrap">
													<Link
														to={`/hosts/${container.host_id}`}
														className="text-sm text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300"
													>
														{container.host?.friendly_name ||
															container.host?.hostname ||
															"Unknown"}
													</Link>
												</td>
												<td className="px-4 py-2 whitespace-nowrap text-center">
													<div className="flex items-center justify-center gap-3">
														<Link
															to={`/docker/containers/${container.id}`}
															className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300 inline-flex items-center gap-1"
															title="View details"
														>
															<ExternalLink className="h-4 w-4" />
														</Link>
														<button
															type="button"
															onClick={() => setDeleteContainerModal(container)}
															className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 inline-flex items-center"
															title="Delete container from inventory"
														>
															<Trash2 className="h-4 w-4" />
														</button>
													</div>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							)}
						</div>
					)}

					{/* Images Tab */}
					{activeTab === "images" && (
						<div className="overflow-x-auto">
							{imagesLoading ? (
								<div className="text-center py-8">
									<RefreshCw className="h-8 w-8 animate-spin mx-auto text-secondary-400" />
									<p className="mt-2 text-sm text-secondary-500">
										Loading images...
									</p>
								</div>
							) : filteredImages.length === 0 ? (
								<div className="text-center py-8">
									<Package className="h-12 w-12 mx-auto text-secondary-400" />
									<h3 className="mt-2 text-sm font-medium text-secondary-900 dark:text-white">
										No images found
									</h3>
									<p className="mt-1 text-sm text-secondary-500">
										{searchTerm
											? "Try adjusting your search filters"
											: "No Docker images detected"}
									</p>
								</div>
							) : (
								<table className="min-w-full divide-y divide-secondary-200 dark:divide-secondary-600">
									<thead className="bg-secondary-50 dark:bg-secondary-700">
										<tr>
											<th className="px-4 py-2 text-left text-xs font-medium text-secondary-500 dark:text-secondary-300 uppercase tracking-wider">
												<button
													type="button"
													onClick={() => handleSort("repository")}
													className="flex items-center gap-2 hover:text-secondary-700"
												>
													Repository
													{getSortIcon("repository")}
												</button>
											</th>
											<th className="px-4 py-2 text-left text-xs font-medium text-secondary-500 dark:text-secondary-300 uppercase tracking-wider">
												<button
													type="button"
													onClick={() => handleSort("tag")}
													className="flex items-center gap-2 hover:text-secondary-700"
												>
													Tag
													{getSortIcon("tag")}
												</button>
											</th>
											<th className="px-4 py-2 text-center text-xs font-medium text-secondary-500 dark:text-secondary-300 uppercase tracking-wider">
												Source
											</th>
											<th className="px-4 py-2 text-center text-xs font-medium text-secondary-500 dark:text-secondary-300 uppercase tracking-wider">
												<button
													type="button"
													onClick={() => handleSort("containers")}
													className="flex items-center gap-2 hover:text-secondary-700"
												>
													Containers
													{getSortIcon("containers")}
												</button>
											</th>
											<th className="px-4 py-2 text-center text-xs font-medium text-secondary-500 dark:text-secondary-300 uppercase tracking-wider">
												Updates
											</th>
											<th className="px-4 py-2 text-center text-xs font-medium text-secondary-500 dark:text-secondary-300 uppercase tracking-wider">
												Actions
											</th>
										</tr>
									</thead>
									<tbody className="bg-white dark:bg-secondary-800 divide-y divide-secondary-200 dark:divide-secondary-600">
										{filteredImages.map((image) => (
											<tr
												key={image.id}
												className="hover:bg-secondary-50 dark:hover:bg-secondary-700 transition-colors"
											>
												<td className="px-4 py-2 whitespace-nowrap">
													<div className="flex items-center gap-2">
														<Package className="h-4 w-4 text-secondary-400 dark:text-secondary-500 flex-shrink-0" />
														<Link
															to={`/docker/images/${image.id}`}
															className="text-sm font-medium text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300 truncate"
														>
															{image.repository}
														</Link>
													</div>
												</td>
												<td className="px-4 py-2 whitespace-nowrap">
													<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary-100 text-secondary-800 dark:bg-secondary-700 dark:text-secondary-200">
														{image.tag}
													</span>
												</td>
												<td className="px-4 py-2 whitespace-nowrap text-center">
													{getSourceBadge(image.source)}
												</td>
												<td className="px-4 py-2 whitespace-nowrap text-center text-sm text-secondary-900 dark:text-white">
													{image._count?.docker_containers || 0}
												</td>
												<td className="px-4 py-2 whitespace-nowrap text-center">
													{image.hasUpdates ? (
														<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
															<AlertTriangle className="h-3 w-3 mr-1" />
															Available
														</span>
													) : (
														<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
															Up to date
														</span>
													)}
												</td>
												<td className="px-4 py-2 whitespace-nowrap text-center">
													<div className="flex items-center justify-center gap-3">
														<Link
															to={`/docker/images/${image.id}`}
															className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300 inline-flex items-center"
															title="View details"
														>
															<ExternalLink className="h-4 w-4" />
														</Link>
														<button
															type="button"
															onClick={() => setDeleteImageModal(image)}
															className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 inline-flex items-center"
															title="Delete image from inventory"
														>
															<Trash2 className="h-4 w-4" />
														</button>
													</div>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							)}
						</div>
					)}

					{/* Hosts Tab */}
					{activeTab === "hosts" && (
						<div className="overflow-x-auto">
							{hostsLoading ? (
								<div className="text-center py-8">
									<RefreshCw className="h-8 w-8 animate-spin mx-auto text-secondary-400" />
									<p className="mt-2 text-sm text-secondary-500">
										Loading hosts...
									</p>
								</div>
							) : filteredHosts.length === 0 ? (
								<div className="text-center py-8">
									<Server className="h-12 w-12 mx-auto text-secondary-400" />
									<h3 className="mt-2 text-sm font-medium text-secondary-900 dark:text-white">
										No hosts found
									</h3>
									<p className="mt-1 text-sm text-secondary-500">
										{searchTerm
											? "Try adjusting your search filters"
											: "No hosts with Docker detected"}
									</p>
								</div>
							) : (
								<table className="min-w-full divide-y divide-secondary-200 dark:divide-secondary-600">
									<thead className="bg-secondary-50 dark:bg-secondary-700">
										<tr>
											<th className="px-4 py-2 text-left text-xs font-medium text-secondary-500 dark:text-secondary-300 uppercase tracking-wider">
												<button
													type="button"
													onClick={() => handleSort("name")}
													className="flex items-center gap-2 hover:text-secondary-700"
												>
													Host Name
													{getSortIcon("name")}
												</button>
											</th>
											<th className="px-4 py-2 text-center text-xs font-medium text-secondary-500 dark:text-secondary-300 uppercase tracking-wider">
												<button
													type="button"
													onClick={() => handleSort("containers")}
													className="flex items-center gap-2 hover:text-secondary-700"
												>
													Containers
													{getSortIcon("containers")}
												</button>
											</th>
											<th className="px-4 py-2 text-center text-xs font-medium text-secondary-500 dark:text-secondary-300 uppercase tracking-wider">
												Running
											</th>
											<th className="px-4 py-2 text-center text-xs font-medium text-secondary-500 dark:text-secondary-300 uppercase tracking-wider">
												<button
													type="button"
													onClick={() => handleSort("images")}
													className="flex items-center gap-2 hover:text-secondary-700"
												>
													Images
													{getSortIcon("images")}
												</button>
											</th>
											<th className="px-4 py-2 text-center text-xs font-medium text-secondary-500 dark:text-secondary-300 uppercase tracking-wider">
												Actions
											</th>
										</tr>
									</thead>
									<tbody className="bg-white dark:bg-secondary-800 divide-y divide-secondary-200 dark:divide-secondary-600">
										{filteredHosts.map((host) => (
											<tr
												key={host.id}
												className="hover:bg-secondary-50 dark:hover:bg-secondary-700 transition-colors"
											>
												<td className="px-4 py-2 whitespace-nowrap">
													<div className="flex items-center gap-2">
														<Server className="h-4 w-4 text-secondary-400 dark:text-secondary-500 flex-shrink-0" />
														<Link
															to={`/docker/hosts/${host.id}`}
															className="text-sm font-medium text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300 truncate"
														>
															{host.friendly_name || host.hostname}
														</Link>
													</div>
												</td>
												<td className="px-4 py-2 whitespace-nowrap text-center text-sm text-secondary-900 dark:text-white">
													{host.dockerStats?.totalContainers || 0}
												</td>
												<td className="px-4 py-2 whitespace-nowrap text-center text-sm text-green-600 dark:text-green-400 font-medium">
													{host.dockerStats?.runningContainers || 0}
												</td>
												<td className="px-4 py-2 whitespace-nowrap text-center text-sm text-secondary-900 dark:text-white">
													{host.dockerStats?.totalImages || 0}
												</td>
												<td className="px-4 py-2 whitespace-nowrap text-center">
													<Link
														to={`/docker/hosts/${host.id}`}
														className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300 inline-flex items-center gap-1"
														title="View details"
													>
														<ExternalLink className="h-4 w-4" />
													</Link>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							)}
						</div>
					)}

					{/* Updates Tab */}
					{activeTab === "updates" && (
						<div className="overflow-x-auto">
							{updatesLoading ? (
								<div className="text-center py-8">
									<RefreshCw className="h-8 w-8 animate-spin mx-auto text-secondary-400" />
									<p className="mt-2 text-sm text-secondary-500">
										Loading updates...
									</p>
								</div>
							) : !updatesData?.updates || updatesData.updates.length === 0 ? (
								<div className="text-center py-8">
									<Shield className="h-12 w-12 mx-auto text-green-400" />
									<h3 className="mt-2 text-sm font-medium text-secondary-900 dark:text-white">
										All images up to date!
									</h3>
									<p className="mt-1 text-sm text-secondary-500">
										No updates available for your Docker images
									</p>
								</div>
							) : (
								<table className="min-w-full divide-y divide-secondary-200 dark:divide-secondary-600">
									<thead className="bg-secondary-50 dark:bg-secondary-700">
										<tr>
											<th className="px-4 py-2 text-left text-xs font-medium text-secondary-500 dark:text-secondary-300 uppercase tracking-wider">
												Image
											</th>
											<th className="px-4 py-2 text-center text-xs font-medium text-secondary-500 dark:text-secondary-300 uppercase tracking-wider">
												Tag
											</th>
											<th className="px-4 py-2 text-center text-xs font-medium text-secondary-500 dark:text-secondary-300 uppercase tracking-wider">
												Detection Method
											</th>
											<th className="px-4 py-2 text-center text-xs font-medium text-secondary-500 dark:text-secondary-300 uppercase tracking-wider">
												Status
											</th>
											<th className="px-4 py-2 text-left text-xs font-medium text-secondary-500 dark:text-secondary-300 uppercase tracking-wider">
												Affected
											</th>
											<th className="px-4 py-2 text-center text-xs font-medium text-secondary-500 dark:text-secondary-300 uppercase tracking-wider">
												Actions
											</th>
										</tr>
									</thead>
									<tbody className="bg-white dark:bg-secondary-800 divide-y divide-secondary-200 dark:divide-secondary-600">
										{updatesData.updates.map((update) => (
											<tr
												key={update.id}
												className="hover:bg-secondary-50 dark:hover:bg-secondary-700 transition-colors"
											>
												<td className="px-4 py-2 whitespace-nowrap">
													<div className="flex items-center gap-2">
														<Package className="h-4 w-4 text-secondary-400 dark:text-secondary-500 flex-shrink-0" />
														<Link
															to={`/docker/images/${update.image_id}`}
															className="text-sm font-medium text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300 truncate"
														>
															{update.docker_images?.repository}
														</Link>
													</div>
												</td>
												<td className="px-4 py-2 whitespace-nowrap text-center">
													<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary-100 text-secondary-800 dark:bg-secondary-700 dark:text-secondary-200">
														{update.current_tag}
													</span>
												</td>
												<td className="px-4 py-2 whitespace-nowrap text-center">
													<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
														<Package className="h-3 w-3 mr-1" />
														Digest
													</span>
												</td>
												<td className="px-4 py-2 whitespace-nowrap text-center">
													<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
														<AlertTriangle className="h-3 w-3 mr-1" />
														Available
													</span>
												</td>
												<td className="px-4 py-2 whitespace-nowrap text-sm text-secondary-900 dark:text-white">
													{update.affectedContainersCount} container
													{update.affectedContainersCount !== 1 ? "s" : ""}
													{update.affectedHosts?.length > 0 && (
														<span className="text-secondary-500 dark:text-secondary-400">
															{" "}
															on {update.affectedHosts.length} host
															{update.affectedHosts.length !== 1 ? "s" : ""}
														</span>
													)}
												</td>
												<td className="px-4 py-2 whitespace-nowrap text-center">
													<Link
														to={`/docker/images/${update.image_id}`}
														className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300 inline-flex items-center gap-1"
														title="View details"
													>
														<ExternalLink className="h-4 w-4" />
													</Link>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							)}
						</div>
					)}
				</div>
			</div>

			{/* Delete Container Modal */}
			{deleteContainerModal && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
					<div className="bg-white dark:bg-secondary-800 rounded-lg p-6 max-w-md w-full mx-4">
						<div className="flex items-start mb-4">
							<div className="flex-shrink-0">
								<AlertTriangle className="h-6 w-6 text-red-600" />
							</div>
							<div className="ml-3 flex-1">
								<h3 className="text-lg font-medium text-secondary-900 dark:text-white">
									Delete Container
								</h3>
								<div className="mt-2 text-sm text-secondary-600 dark:text-secondary-300">
									<p className="mb-2">
										Are you sure you want to delete this container from the
										inventory?
									</p>
									<div className="bg-secondary-100 dark:bg-secondary-700 p-3 rounded-md">
										<p className="font-medium text-secondary-900 dark:text-white">
											{deleteContainerModal.name}
										</p>
										<p className="text-xs text-secondary-600 dark:text-secondary-400 mt-1">
											Image: {deleteContainerModal.image_name}:
											{deleteContainerModal.image_tag}
										</p>
										<p className="text-xs text-secondary-600 dark:text-secondary-400">
											Host:{" "}
											{deleteContainerModal.host?.friendly_name || "Unknown"}
										</p>
									</div>
									<p className="mt-3 text-red-600 dark:text-red-400 font-medium">
										⚠️ This only removes the container from PatchMon's inventory.
										It does NOT stop or delete the actual Docker container on
										the host.
									</p>
								</div>
							</div>
						</div>
						<div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-3">
							<button
								type="button"
								onClick={() =>
									deleteContainerMutation.mutate(deleteContainerModal.id)
								}
								disabled={deleteContainerMutation.isPending}
								className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{deleteContainerMutation.isPending
									? "Deleting..."
									: "Delete from Inventory"}
							</button>
							<button
								type="button"
								onClick={() => setDeleteContainerModal(null)}
								disabled={deleteContainerMutation.isPending}
								className="mt-3 w-full inline-flex justify-center rounded-md border border-secondary-300 dark:border-secondary-600 shadow-sm px-4 py-2 bg-white dark:bg-secondary-700 text-base font-medium text-secondary-700 dark:text-secondary-200 hover:bg-secondary-50 dark:hover:bg-secondary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
							>
								Cancel
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Delete Image Modal */}
			{deleteImageModal && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
					<div className="bg-white dark:bg-secondary-800 rounded-lg p-6 max-w-md w-full mx-4">
						<div className="flex items-start mb-4">
							<div className="flex-shrink-0">
								<AlertTriangle className="h-6 w-6 text-red-600" />
							</div>
							<div className="ml-3 flex-1">
								<h3 className="text-lg font-medium text-secondary-900 dark:text-white">
									Delete Image
								</h3>
								<div className="mt-2 text-sm text-secondary-600 dark:text-secondary-300">
									<p className="mb-2">
										Are you sure you want to delete this image from the
										inventory?
									</p>
									<div className="bg-secondary-100 dark:bg-secondary-700 p-3 rounded-md">
										<p className="font-medium text-secondary-900 dark:text-white">
											{deleteImageModal.repository}:{deleteImageModal.tag}
										</p>
										<p className="text-xs text-secondary-600 dark:text-secondary-400 mt-1">
											Source: {deleteImageModal.source}
										</p>
										<p className="text-xs text-secondary-600 dark:text-secondary-400">
											Containers using this:{" "}
											{deleteImageModal._count?.docker_containers || 0}
										</p>
									</div>
									{deleteImageModal._count?.docker_containers > 0 ? (
										<p className="mt-3 text-red-600 dark:text-red-400 font-medium">
											⚠️ Cannot delete: This image is in use by{" "}
											{deleteImageModal._count.docker_containers} container(s).
											Delete the containers first.
										</p>
									) : (
										<p className="mt-3 text-red-600 dark:text-red-400 font-medium">
											⚠️ This only removes the image from PatchMon's inventory.
											It does NOT delete the actual Docker image from hosts.
										</p>
									)}
								</div>
							</div>
						</div>
						<div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-3">
							<button
								type="button"
								onClick={() => deleteImageMutation.mutate(deleteImageModal.id)}
								disabled={
									deleteImageMutation.isPending ||
									deleteImageModal._count?.docker_containers > 0
								}
								className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{deleteImageMutation.isPending
									? "Deleting..."
									: "Delete from Inventory"}
							</button>
							<button
								type="button"
								onClick={() => setDeleteImageModal(null)}
								disabled={deleteImageMutation.isPending}
								className="mt-3 w-full inline-flex justify-center rounded-md border border-secondary-300 dark:border-secondary-600 shadow-sm px-4 py-2 bg-white dark:bg-secondary-700 text-base font-medium text-secondary-700 dark:text-secondary-200 hover:bg-secondary-50 dark:hover:bg-secondary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
							>
								Cancel
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default Docker;
