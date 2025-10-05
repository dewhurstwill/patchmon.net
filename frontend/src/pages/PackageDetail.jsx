import { useQuery } from "@tanstack/react-query";
import {
	AlertTriangle,
	ArrowLeft,
	Calendar,
	ChartColumnBig,
	ChevronRight,
	Download,
	Package,
	RefreshCw,
	Search,
	Server,
	Shield,
	Tag,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { formatRelativeTime, packagesAPI } from "../utils/api";

const PackageDetail = () => {
	const { packageId } = useParams();
	const decodedPackageId = decodeURIComponent(packageId || "");
	const navigate = useNavigate();
	const [searchTerm, setSearchTerm] = useState("");
	const [currentPage, setCurrentPage] = useState(1);
	const [pageSize, setPageSize] = useState(25);

	// Fetch package details
	const {
		data: packageData,
		isLoading: isLoadingPackage,
		error: packageError,
		refetch: refetchPackage,
	} = useQuery({
		queryKey: ["package", decodedPackageId],
		queryFn: () =>
			packagesAPI.getById(decodedPackageId).then((res) => res.data),
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false,
		enabled: !!decodedPackageId,
	});

	// Fetch hosts that have this package
	const {
		data: hostsData,
		isLoading: isLoadingHosts,
		error: hostsError,
		refetch: refetchHosts,
	} = useQuery({
		queryKey: ["package-hosts", decodedPackageId, searchTerm],
		queryFn: () =>
			packagesAPI
				.getHosts(decodedPackageId, { search: searchTerm, limit: 1000 })
				.then((res) => res.data),
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false,
		enabled: !!decodedPackageId,
	});

	const hosts = hostsData?.hosts || [];

	// Filter and paginate hosts
	const filteredAndPaginatedHosts = useMemo(() => {
		let filtered = hosts;

		if (searchTerm) {
			filtered = hosts.filter(
				(host) =>
					host.friendlyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
					host.hostname?.toLowerCase().includes(searchTerm.toLowerCase()),
			);
		}

		const startIndex = (currentPage - 1) * pageSize;
		const endIndex = startIndex + pageSize;
		return filtered.slice(startIndex, endIndex);
	}, [hosts, searchTerm, currentPage, pageSize]);

	const totalPages = Math.ceil(
		(searchTerm
			? hosts.filter(
					(host) =>
						host.friendlyName
							?.toLowerCase()
							.includes(searchTerm.toLowerCase()) ||
						host.hostname?.toLowerCase().includes(searchTerm.toLowerCase()),
				).length
			: hosts.length) / pageSize,
	);

	const handleHostClick = (hostId) => {
		navigate(`/hosts/${hostId}`);
	};

	const handleRefresh = () => {
		refetchPackage();
		refetchHosts();
	};

	if (isLoadingPackage) {
		return (
			<div className="flex items-center justify-center h-64">
				<RefreshCw className="h-8 w-8 animate-spin text-primary-600" />
			</div>
		);
	}

	if (packageError) {
		return (
			<div className="space-y-6">
				<div className="bg-danger-50 border border-danger-200 rounded-md p-4">
					<div className="flex">
						<AlertTriangle className="h-5 w-5 text-danger-400" />
						<div className="ml-3">
							<h3 className="text-sm font-medium text-danger-800">
								Error loading package
							</h3>
							<p className="text-sm text-danger-700 mt-1">
								{packageError.message || "Failed to load package details"}
							</p>
							<button
								type="button"
								onClick={() => refetchPackage()}
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

	if (!packageData) {
		return (
			<div className="space-y-6">
				<div className="text-center py-8">
					<Package className="h-12 w-12 text-secondary-400 mx-auto mb-4" />
					<p className="text-secondary-500 dark:text-secondary-300">
						Package not found
					</p>
				</div>
			</div>
		);
	}

	const pkg = packageData;
	const stats = packageData.stats || {};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-4">
					<button
						type="button"
						onClick={() => navigate("/packages")}
						className="flex items-center gap-2 text-secondary-600 hover:text-secondary-900 dark:text-secondary-400 dark:hover:text-white transition-colors"
					>
						<ArrowLeft className="h-4 w-4" />
						Back to Packages
					</button>
					<ChevronRight className="h-4 w-4 text-secondary-400" />
					<h1 className="text-2xl font-semibold text-secondary-900 dark:text-white">
						{pkg.name}
					</h1>
				</div>
				<button
					type="button"
					onClick={handleRefresh}
					disabled={isLoadingPackage || isLoadingHosts}
					className="btn-outline flex items-center gap-2"
				>
					<RefreshCw
						className={`h-4 w-4 ${
							isLoadingPackage || isLoadingHosts ? "animate-spin" : ""
						}`}
					/>
					Refresh
				</button>
			</div>

			{/* Package Overview */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* Main Package Info */}
				<div className="lg:col-span-2">
					<div className="card p-6">
						<div className="flex items-start gap-4 mb-4">
							<Package className="h-8 w-8 text-primary-600 flex-shrink-0 mt-1" />
							<div className="flex-1">
								<h2 className="text-xl font-semibold text-secondary-900 dark:text-white mb-2">
									{pkg.name}
								</h2>
								{pkg.description && (
									<p className="text-secondary-600 dark:text-secondary-300 mb-4">
										{pkg.description}
									</p>
								)}
								<div className="flex flex-wrap gap-4 text-sm">
									{pkg.category && (
										<div className="flex items-center gap-2">
											<Tag className="h-4 w-4 text-secondary-400" />
											<span className="text-secondary-600 dark:text-secondary-300">
												Category: {pkg.category}
											</span>
										</div>
									)}
									{pkg.latest_version && (
										<div className="flex items-center gap-2">
											<Download className="h-4 w-4 text-secondary-400" />
											<span className="text-secondary-600 dark:text-secondary-300">
												Latest: {pkg.latest_version}
											</span>
										</div>
									)}
									{pkg.updated_at && (
										<div className="flex items-center gap-2">
											<Calendar className="h-4 w-4 text-secondary-400" />
											<span className="text-secondary-600 dark:text-secondary-300">
												Updated: {formatRelativeTime(pkg.updated_at)}
											</span>
										</div>
									)}
								</div>
							</div>
						</div>

						{/* Status Badge */}
						<div className="mb-4">
							{stats.updatesNeeded > 0 ? (
								stats.securityUpdates > 0 ? (
									<span className="badge-danger flex items-center gap-1 w-fit">
										<Shield className="h-3 w-3" />
										Security Update Available
									</span>
								) : (
									<span className="badge-warning w-fit">Update Available</span>
								)
							) : (
								<span className="badge-success w-fit">Up to Date</span>
							)}
						</div>
					</div>
				</div>

				{/* Statistics */}
				<div className="space-y-4">
					<div className="card p-4">
						<div className="flex items-center gap-3 mb-3">
							<ChartColumnBig className="h-5 w-5 text-primary-600" />
							<h3 className="font-medium text-secondary-900 dark:text-white">
								Installation Stats
							</h3>
						</div>
						<div className="space-y-3">
							<div className="flex justify-between">
								<span className="text-secondary-600 dark:text-secondary-300">
									Total Installations
								</span>
								<span className="font-semibold text-secondary-900 dark:text-white">
									{stats.totalInstalls || 0}
								</span>
							</div>
							{stats.updatesNeeded > 0 && (
								<div className="flex justify-between">
									<span className="text-secondary-600 dark:text-secondary-300">
										Hosts Needing Updates
									</span>
									<span className="font-semibold text-warning-600">
										{stats.updatesNeeded}
									</span>
								</div>
							)}
							{stats.securityUpdates > 0 && (
								<div className="flex justify-between">
									<span className="text-secondary-600 dark:text-secondary-300">
										Security Updates
									</span>
									<span className="font-semibold text-danger-600">
										{stats.securityUpdates}
									</span>
								</div>
							)}
							<div className="flex justify-between">
								<span className="text-secondary-600 dark:text-secondary-300">
									Up to Date
								</span>
								<span className="font-semibold text-success-600">
									{(stats.totalInstalls || 0) - (stats.updatesNeeded || 0)}
								</span>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Hosts List */}
			<div className="card">
				<div className="px-6 py-4 border-b border-secondary-200 dark:border-secondary-600">
					<div className="flex items-center justify-between mb-4">
						<div className="flex items-center gap-3">
							<Server className="h-5 w-5 text-primary-600" />
							<h3 className="text-lg font-medium text-secondary-900 dark:text-white">
								Installed On Hosts ({hosts.length})
							</h3>
						</div>
					</div>

					{/* Search */}
					<div className="relative max-w-sm">
						<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-secondary-400" />
						<input
							type="text"
							placeholder="Search hosts..."
							value={searchTerm}
							onChange={(e) => {
								setSearchTerm(e.target.value);
								setCurrentPage(1);
							}}
							className="w-full pl-10 pr-4 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-secondary-800 text-secondary-900 dark:text-white placeholder-secondary-500 dark:placeholder-secondary-400"
						/>
					</div>
				</div>

				<div className="overflow-x-auto">
					{isLoadingHosts ? (
						<div className="flex items-center justify-center h-32">
							<RefreshCw className="h-6 w-6 animate-spin text-primary-600" />
						</div>
					) : hostsError ? (
						<div className="p-6">
							<div className="bg-danger-50 border border-danger-200 rounded-md p-4">
								<div className="flex">
									<AlertTriangle className="h-5 w-5 text-danger-400" />
									<div className="ml-3">
										<h3 className="text-sm font-medium text-danger-800">
											Error loading hosts
										</h3>
										<p className="text-sm text-danger-700 mt-1">
											{hostsError.message || "Failed to load hosts"}
										</p>
									</div>
								</div>
							</div>
						</div>
					) : filteredAndPaginatedHosts.length === 0 ? (
						<div className="text-center py-8">
							<Server className="h-12 w-12 text-secondary-400 mx-auto mb-4" />
							<p className="text-secondary-500 dark:text-secondary-300">
								{searchTerm
									? "No hosts match your search"
									: "No hosts have this package installed"}
							</p>
						</div>
					) : (
						<>
							<table className="min-w-full divide-y divide-secondary-200 dark:divide-secondary-600">
								<thead className="bg-secondary-50 dark:bg-secondary-700">
									<tr>
										<th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 dark:text-secondary-300 uppercase tracking-wider">
											Host
										</th>
										<th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 dark:text-secondary-300 uppercase tracking-wider">
											Current Version
										</th>
										<th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 dark:text-secondary-300 uppercase tracking-wider">
											Status
										</th>
										<th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 dark:text-secondary-300 uppercase tracking-wider">
											Last Updated
										</th>
									</tr>
								</thead>
								<tbody className="bg-white dark:bg-secondary-800 divide-y divide-secondary-200 dark:divide-secondary-600">
									{filteredAndPaginatedHosts.map((host) => (
										<tr
											key={host.hostId}
											className="hover:bg-secondary-50 dark:hover:bg-secondary-700 cursor-pointer transition-colors"
											onClick={() => handleHostClick(host.hostId)}
										>
											<td className="px-6 py-4 whitespace-nowrap">
												<div className="flex items-center">
													<Server className="h-5 w-5 text-secondary-400 mr-3" />
													<div>
														<div className="text-sm font-medium text-secondary-900 dark:text-white">
															{host.friendlyName || host.hostname}
														</div>
														{host.friendlyName && host.hostname && (
															<div className="text-sm text-secondary-500 dark:text-secondary-300">
																{host.hostname}
															</div>
														)}
													</div>
												</div>
											</td>
											<td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-900 dark:text-white">
												{host.currentVersion || "Unknown"}
											</td>
											<td className="px-6 py-4 whitespace-nowrap">
												{host.needsUpdate ? (
													host.isSecurityUpdate ? (
														<span className="badge-danger flex items-center gap-1 w-fit">
															<Shield className="h-3 w-3" />
															Security Update
														</span>
													) : (
														<span className="badge-warning w-fit">
															Update Available
														</span>
													)
												) : (
													<span className="badge-success w-fit">
														Up to Date
													</span>
												)}
											</td>
											<td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500 dark:text-secondary-300">
												{host.lastUpdate
													? formatRelativeTime(host.lastUpdate)
													: "Never"}
											</td>
										</tr>
									))}
								</tbody>
							</table>

							{/* Pagination */}
							{totalPages > 1 && (
								<div className="px-6 py-3 bg-white dark:bg-secondary-800 border-t border-secondary-200 dark:border-secondary-600 flex items-center justify-between">
									<div className="flex items-center gap-2">
										<span className="text-sm text-secondary-700 dark:text-secondary-300">
											Rows per page:
										</span>
										<select
											value={pageSize}
											onChange={(e) => {
												setPageSize(Number(e.target.value));
												setCurrentPage(1);
											}}
											className="text-sm border border-secondary-300 dark:border-secondary-600 rounded px-2 py-1 bg-white dark:bg-secondary-700 text-secondary-900 dark:text-white"
										>
											<option value={25}>25</option>
											<option value={50}>50</option>
											<option value={100}>100</option>
										</select>
									</div>
									<div className="flex items-center gap-2">
										<button
											type="button"
											onClick={() => setCurrentPage(currentPage - 1)}
											disabled={currentPage === 1}
											className="px-3 py-1 text-sm border border-secondary-300 dark:border-secondary-600 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-secondary-50 dark:hover:bg-secondary-700"
										>
											Previous
										</button>
										<span className="text-sm text-secondary-700 dark:text-secondary-300">
											Page {currentPage} of {totalPages}
										</span>
										<button
											type="button"
											onClick={() => setCurrentPage(currentPage + 1)}
											disabled={currentPage === totalPages}
											className="px-3 py-1 text-sm border border-secondary-300 dark:border-secondary-600 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-secondary-50 dark:hover:bg-secondary-700"
										>
											Next
										</button>
									</div>
								</div>
							)}
						</>
					)}
				</div>
			</div>
		</div>
	);
};

export default PackageDetail;
