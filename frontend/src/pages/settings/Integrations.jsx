import {
	AlertCircle,
	CheckCircle,
	Copy,
	Eye,
	EyeOff,
	Plus,
	Server,
	Trash2,
	X,
} from "lucide-react";
import { useEffect, useState } from "react";
import SettingsLayout from "../../components/SettingsLayout";
import api from "../../utils/api";

const Integrations = () => {
	const [activeTab, setActiveTab] = useState("proxmox");
	const [tokens, setTokens] = useState([]);
	const [host_groups, setHostGroups] = useState([]);
	const [loading, setLoading] = useState(true);
	const [show_create_modal, setShowCreateModal] = useState(false);
	const [new_token, setNewToken] = useState(null);
	const [show_secret, setShowSecret] = useState(false);
	const [server_url, setServerUrl] = useState("");
	const [force_proxmox_install, setForceProxmoxInstall] = useState(false);

	// Form state
	const [form_data, setFormData] = useState({
		token_name: "",
		max_hosts_per_day: 100,
		default_host_group_id: "",
		allowed_ip_ranges: "",
		expires_at: "",
	});

	const [copy_success, setCopySuccess] = useState({});

	// Helper function to build Proxmox enrollment URL with optional force flag
	const getProxmoxUrl = () => {
		const baseUrl = `${server_url}/api/v1/auto-enrollment/proxmox-lxc?token_key=${new_token.token_key}&token_secret=${new_token.token_secret}`;
		return force_proxmox_install ? `${baseUrl}&force=true` : baseUrl;
	};

	const handleTabChange = (tabName) => {
		setActiveTab(tabName);
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: Only run on mount
	useEffect(() => {
		load_tokens();
		load_host_groups();
		load_server_url();
	}, []);

	const load_tokens = async () => {
		try {
			setLoading(true);
			const response = await api.get("/auto-enrollment/tokens");
			setTokens(response.data);
		} catch (error) {
			console.error("Failed to load tokens:", error);
		} finally {
			setLoading(false);
		}
	};

	const load_host_groups = async () => {
		try {
			const response = await api.get("/host-groups");
			setHostGroups(response.data);
		} catch (error) {
			console.error("Failed to load host groups:", error);
		}
	};

	const load_server_url = async () => {
		try {
			const response = await api.get("/settings");
			setServerUrl(response.data.server_url || window.location.origin);
		} catch (error) {
			console.error("Failed to load server URL:", error);
			setServerUrl(window.location.origin);
		}
	};

	const create_token = async (e) => {
		e.preventDefault();

		try {
			const data = {
				token_name: form_data.token_name,
				max_hosts_per_day: Number.parseInt(form_data.max_hosts_per_day, 10),
				allowed_ip_ranges: form_data.allowed_ip_ranges
					? form_data.allowed_ip_ranges.split(",").map((ip) => ip.trim())
					: [],
				metadata: {
					integration_type: "proxmox-lxc",
				},
			};

			// Only add optional fields if they have values
			if (form_data.default_host_group_id) {
				data.default_host_group_id = form_data.default_host_group_id;
			}
			if (form_data.expires_at) {
				data.expires_at = form_data.expires_at;
			}

			const response = await api.post("/auto-enrollment/tokens", data);
			setNewToken(response.data.token);
			setShowCreateModal(false);
			load_tokens();

			// Reset form
			setFormData({
				token_name: "",
				max_hosts_per_day: 100,
				default_host_group_id: "",
				allowed_ip_ranges: "",
				expires_at: "",
			});
		} catch (error) {
			console.error("Failed to create token:", error);
			const error_message = error.response?.data?.errors
				? error.response.data.errors.map((e) => e.msg).join(", ")
				: error.response?.data?.error || "Failed to create token";
			alert(error_message);
		}
	};

	const delete_token = async (id, name) => {
		if (
			!confirm(
				`Are you sure you want to delete the token "${name}"? This action cannot be undone.`,
			)
		) {
			return;
		}

		try {
			await api.delete(`/auto-enrollment/tokens/${id}`);
			load_tokens();
		} catch (error) {
			console.error("Failed to delete token:", error);
			alert(error.response?.data?.error || "Failed to delete token");
		}
	};

	const toggle_token_active = async (id, current_status) => {
		try {
			await api.patch(`/auto-enrollment/tokens/${id}`, {
				is_active: !current_status,
			});
			load_tokens();
		} catch (error) {
			console.error("Failed to toggle token:", error);
			alert(error.response?.data?.error || "Failed to toggle token");
		}
	};

	const copy_to_clipboard = (text, key) => {
		navigator.clipboard.writeText(text);
		setCopySuccess({ ...copy_success, [key]: true });
		setTimeout(() => {
			setCopySuccess({ ...copy_success, [key]: false });
		}, 2000);
	};

	const format_date = (date_string) => {
		if (!date_string) return "Never";
		return new Date(date_string).toLocaleString();
	};

	return (
		<SettingsLayout>
			<div className="space-y-6">
				{/* Header */}
				<div>
					<h1 className="text-2xl font-bold text-secondary-900 dark:text-white">
						Integrations
					</h1>
					<p className="mt-1 text-sm text-secondary-600 dark:text-secondary-400">
						Manage auto-enrollment tokens for Proxmox and other integrations
					</p>
				</div>

				{/* Tabs Navigation */}
				<div className="bg-white dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-600 rounded-lg overflow-hidden">
					<div className="border-b border-secondary-200 dark:border-secondary-600 flex">
						<button
							type="button"
							onClick={() => handleTabChange("proxmox")}
							className={`px-6 py-3 text-sm font-medium ${
								activeTab === "proxmox"
									? "text-primary-600 dark:text-primary-400 border-b-2 border-primary-500 bg-primary-50 dark:bg-primary-900/20"
									: "text-secondary-500 dark:text-secondary-400 hover:text-secondary-700 dark:hover:text-secondary-300 hover:bg-secondary-50 dark:hover:bg-secondary-700/50"
							}`}
						>
							Proxmox LXC
						</button>
						{/* Future tabs can be added here */}
					</div>

					{/* Tab Content */}
					<div className="p-6">
						{/* Proxmox Tab */}
						{activeTab === "proxmox" && (
							<div className="space-y-6">
								{/* Header with New Token Button */}
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-3">
										<div className="w-10 h-10 bg-primary-100 dark:bg-primary-900 rounded-lg flex items-center justify-center">
											<Server className="h-5 w-5 text-primary-600 dark:text-primary-400" />
										</div>
										<div>
											<h3 className="text-lg font-semibold text-secondary-900 dark:text-white">
												Proxmox LXC Auto-Enrollment
											</h3>
											<p className="text-sm text-secondary-600 dark:text-secondary-400">
												Automatically discover and enroll LXC containers from
												Proxmox hosts
											</p>
										</div>
									</div>
									<button
										type="button"
										onClick={() => setShowCreateModal(true)}
										className="btn-primary flex items-center gap-2"
									>
										<Plus className="h-4 w-4" />
										New Token
									</button>
								</div>

								{/* Token List */}
								{loading ? (
									<div className="text-center py-8">
										<div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
									</div>
								) : tokens.length === 0 ? (
									<div className="text-center py-8 text-secondary-600 dark:text-secondary-400">
										<p>No auto-enrollment tokens created yet.</p>
										<p className="text-sm mt-2">
											Create a token to enable automatic host enrollment from
											Proxmox.
										</p>
									</div>
								) : (
									<div className="space-y-3">
										{tokens.map((token) => (
											<div
												key={token.id}
												className="border border-secondary-200 dark:border-secondary-600 rounded-lg p-4 hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
											>
												<div className="flex justify-between items-start">
													<div className="flex-1">
														<div className="flex items-center gap-2 flex-wrap">
															<h4 className="font-medium text-secondary-900 dark:text-white">
																{token.token_name}
															</h4>
															<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
																Proxmox LXC
															</span>
															{token.is_active ? (
																<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
																	Active
																</span>
															) : (
																<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary-100 text-secondary-800 dark:bg-secondary-700 dark:text-secondary-200">
																	Inactive
																</span>
															)}
														</div>
														<div className="mt-2 space-y-1 text-sm text-secondary-600 dark:text-secondary-400">
															<div className="flex items-center gap-2">
																<span className="font-mono text-xs bg-secondary-100 dark:bg-secondary-700 px-2 py-1 rounded">
																	{token.token_key}
																</span>
																<button
																	type="button"
																	onClick={() =>
																		copy_to_clipboard(
																			token.token_key,
																			`key-${token.id}`,
																		)
																	}
																	className="text-primary-600 hover:text-primary-700 dark:text-primary-400"
																>
																	{copy_success[`key-${token.id}`] ? (
																		<CheckCircle className="h-4 w-4" />
																	) : (
																		<Copy className="h-4 w-4" />
																	)}
																</button>
															</div>
															<p>
																Usage: {token.hosts_created_today}/
																{token.max_hosts_per_day} hosts today
															</p>
															{token.host_groups && (
																<p>
																	Default Group:{" "}
																	<span
																		className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
																		style={{
																			backgroundColor: `${token.host_groups.color}20`,
																			color: token.host_groups.color,
																		}}
																	>
																		{token.host_groups.name}
																	</span>
																</p>
															)}
															{token.allowed_ip_ranges?.length > 0 && (
																<p>
																	Allowed IPs:{" "}
																	{token.allowed_ip_ranges.join(", ")}
																</p>
															)}
															<p>Created: {format_date(token.created_at)}</p>
															{token.last_used_at && (
																<p>
																	Last Used: {format_date(token.last_used_at)}
																</p>
															)}
															{token.expires_at && (
																<p>
																	Expires: {format_date(token.expires_at)}
																	{new Date(token.expires_at) < new Date() && (
																		<span className="ml-2 text-red-600 dark:text-red-400">
																			(Expired)
																		</span>
																	)}
																</p>
															)}
														</div>
													</div>
													<div className="flex items-center gap-2">
														<button
															type="button"
															onClick={() =>
																toggle_token_active(token.id, token.is_active)
															}
															className={`px-3 py-1 text-sm rounded ${
																token.is_active
																	? "bg-secondary-100 text-secondary-700 hover:bg-secondary-200 dark:bg-secondary-700 dark:text-secondary-300"
																	: "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300"
															}`}
														>
															{token.is_active ? "Disable" : "Enable"}
														</button>
														<button
															type="button"
															onClick={() =>
																delete_token(token.id, token.token_name)
															}
															className="text-red-600 hover:text-red-800 dark:text-red-400 p-2"
														>
															<Trash2 className="h-4 w-4" />
														</button>
													</div>
												</div>
											</div>
										))}
									</div>
								)}

								{/* Documentation Section */}
								<div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-6">
									<h3 className="text-lg font-semibold text-primary-900 dark:text-primary-200 mb-3">
										How to Use Auto-Enrollment
									</h3>
									<ol className="list-decimal list-inside space-y-2 text-sm text-primary-800 dark:text-primary-300">
										<li>
											Create a new auto-enrollment token using the button above
										</li>
										<li>
											Copy the one-line installation command shown in the
											success dialog
										</li>
										<li>SSH into your Proxmox host as root</li>
										<li>
											Paste and run the command - it will automatically discover
											and enroll all running LXC containers
										</li>
										<li>View enrolled containers in the Hosts page</li>
									</ol>
									<div className="mt-4 p-3 bg-primary-100 dark:bg-primary-900/40 rounded border border-primary-200 dark:border-primary-700">
										<p className="text-xs text-primary-800 dark:text-primary-300">
											<strong>💡 Tip:</strong> You can run the same command
											multiple times safely - already enrolled containers will
											be automatically skipped.
										</p>
									</div>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Create Token Modal */}
			{show_create_modal && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
					<div className="bg-white dark:bg-secondary-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
						<div className="p-6">
							<div className="flex items-center justify-between mb-6">
								<h2 className="text-xl font-bold text-secondary-900 dark:text-white">
									Create Auto-Enrollment Token
								</h2>
								<button
									type="button"
									onClick={() => setShowCreateModal(false)}
									className="text-secondary-400 hover:text-secondary-600 dark:hover:text-secondary-200"
								>
									<X className="h-6 w-6" />
								</button>
							</div>

							<form onSubmit={create_token} className="space-y-4">
								<label className="block">
									<span className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">
										Token Name *
									</span>
									<input
										type="text"
										required
										value={form_data.token_name}
										onChange={(e) =>
											setFormData({ ...form_data, token_name: e.target.value })
										}
										placeholder="e.g., Proxmox Production"
										className="w-full px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md bg-white dark:bg-secondary-700 text-secondary-900 dark:text-white"
									/>
								</label>

								<label className="block">
									<span className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">
										Max Hosts Per Day
									</span>
									<input
										type="number"
										min="1"
										max="1000"
										value={form_data.max_hosts_per_day}
										onChange={(e) =>
											setFormData({
												...form_data,
												max_hosts_per_day: e.target.value,
											})
										}
										className="w-full px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md bg-white dark:bg-secondary-700 text-secondary-900 dark:text-white"
									/>
									<p className="mt-1 text-xs text-secondary-500 dark:text-secondary-400">
										Maximum number of hosts that can be enrolled per day using
										this token
									</p>
								</label>

								<label className="block">
									<span className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">
										Default Host Group (Optional)
									</span>
									<select
										value={form_data.default_host_group_id}
										onChange={(e) =>
											setFormData({
												...form_data,
												default_host_group_id: e.target.value,
											})
										}
										className="w-full px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md bg-white dark:bg-secondary-700 text-secondary-900 dark:text-white"
									>
										<option value="">No default group</option>
										{host_groups.map((group) => (
											<option key={group.id} value={group.id}>
												{group.name}
											</option>
										))}
									</select>
									<p className="mt-1 text-xs text-secondary-500 dark:text-secondary-400">
										Auto-enrolled hosts will be assigned to this group
									</p>
								</label>

								<label className="block">
									<span className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">
										Allowed IP Addresses (Optional)
									</span>
									<input
										type="text"
										value={form_data.allowed_ip_ranges}
										onChange={(e) =>
											setFormData({
												...form_data,
												allowed_ip_ranges: e.target.value,
											})
										}
										placeholder="e.g., 192.168.1.100, 10.0.0.50"
										className="w-full px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md bg-white dark:bg-secondary-700 text-secondary-900 dark:text-white"
									/>
									<p className="mt-1 text-xs text-secondary-500 dark:text-secondary-400">
										Comma-separated list of IP addresses allowed to use this
										token
									</p>
								</label>

								<label className="block">
									<span className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">
										Expiration Date (Optional)
									</span>
									<input
										type="datetime-local"
										value={form_data.expires_at}
										onChange={(e) =>
											setFormData({ ...form_data, expires_at: e.target.value })
										}
										className="w-full px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md bg-white dark:bg-secondary-700 text-secondary-900 dark:text-white"
									/>
								</label>

								<div className="flex gap-3 pt-4">
									<button
										type="submit"
										className="flex-1 btn-primary py-2 px-4 rounded-md"
									>
										Create Token
									</button>
									<button
										type="button"
										onClick={() => setShowCreateModal(false)}
										className="flex-1 bg-secondary-100 dark:bg-secondary-700 text-secondary-700 dark:text-secondary-300 py-2 px-4 rounded-md hover:bg-secondary-200 dark:hover:bg-secondary-600"
									>
										Cancel
									</button>
								</div>
							</form>
						</div>
					</div>
				</div>
			)}

			{/* New Token Display Modal */}
			{new_token && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
					<div className="bg-white dark:bg-secondary-800 rounded-lg max-w-2xl w-full">
						<div className="p-6">
							<div className="flex items-start gap-3 mb-6">
								<div className="flex-shrink-0">
									<CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
								</div>
								<div>
									<h2 className="text-xl font-bold text-secondary-900 dark:text-white">
										Token Created Successfully
									</h2>
									<p className="mt-1 text-sm text-secondary-600 dark:text-secondary-400">
										Save these credentials now - the secret will not be shown
										again!
									</p>
								</div>
							</div>

							<div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
								<div className="flex items-start gap-2">
									<AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
									<p className="text-sm text-yellow-800 dark:text-yellow-200">
										<strong>Important:</strong> Store the token secret securely.
										You will not be able to view it again after closing this
										dialog.
									</p>
								</div>
							</div>

							<div className="space-y-4">
								<div>
									<div className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
										Token Name
									</div>
									<div className="flex items-center gap-2">
										<input
											type="text"
											value={new_token.token_name}
											readOnly
											className="flex-1 px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md bg-secondary-50 dark:bg-secondary-900 text-secondary-900 dark:text-white font-mono text-sm"
										/>
									</div>
								</div>

								<div>
									<div className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
										Token Key
									</div>
									<div className="flex items-center gap-2">
										<input
											type="text"
											value={new_token.token_key}
											readOnly
											className="flex-1 px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md bg-secondary-50 dark:bg-secondary-900 text-secondary-900 dark:text-white font-mono text-sm"
										/>
										<button
											type="button"
											onClick={() =>
												copy_to_clipboard(new_token.token_key, "new-key")
											}
											className="btn-primary flex items-center gap-1 px-3 py-2"
										>
											{copy_success["new-key"] ? (
												<>
													<CheckCircle className="h-4 w-4" />
													Copied
												</>
											) : (
												<>
													<Copy className="h-4 w-4" />
													Copy
												</>
											)}
										</button>
									</div>
								</div>

								<div>
									<div className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
										Token Secret
									</div>
									<div className="flex items-center gap-2">
										<input
											type={show_secret ? "text" : "password"}
											value={new_token.token_secret}
											readOnly
											className="flex-1 px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md bg-secondary-50 dark:bg-secondary-900 text-secondary-900 dark:text-white font-mono text-sm"
										/>
										<button
											type="button"
											onClick={() => setShowSecret(!show_secret)}
											className="p-2 text-secondary-600 hover:text-secondary-800 dark:text-secondary-400 dark:hover:text-secondary-200"
										>
											{show_secret ? (
												<EyeOff className="h-5 w-5" />
											) : (
												<Eye className="h-5 w-5" />
											)}
										</button>
										<button
											type="button"
											onClick={() =>
												copy_to_clipboard(new_token.token_secret, "new-secret")
											}
											className="btn-primary flex items-center gap-1 px-3 py-2"
										>
											{copy_success["new-secret"] ? (
												<>
													<CheckCircle className="h-4 w-4" />
													Copied
												</>
											) : (
												<>
													<Copy className="h-4 w-4" />
													Copy
												</>
											)}
										</button>
									</div>
								</div>

								<div className="mt-6">
									<div className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
										One-Line Installation Command
									</div>
									<p className="text-xs text-secondary-600 dark:text-secondary-400 mb-2">
										Run this command on your Proxmox host to download and
										execute the enrollment script:
									</p>

									{/* Force Install Toggle */}
									<div className="mb-3">
										<label className="flex items-center gap-2 text-sm">
											<input
												type="checkbox"
												checked={force_proxmox_install}
												onChange={(e) =>
													setForceProxmoxInstall(e.target.checked)
												}
												className="rounded border-secondary-300 dark:border-secondary-600 text-primary-600 focus:ring-primary-500 dark:focus:ring-primary-400 dark:bg-secondary-700"
											/>
											<span className="text-secondary-800 dark:text-secondary-200">
												Force install (bypass broken packages in containers)
											</span>
										</label>
										<p className="text-xs text-secondary-600 dark:text-secondary-400 mt-1">
											Enable this if your LXC containers have broken packages
											(CloudPanel, WHM, etc.) that block apt-get operations
										</p>
									</div>

									<div className="flex items-center gap-2">
										<input
											type="text"
											value={`curl -s "${getProxmoxUrl()}" | bash`}
											readOnly
											className="flex-1 px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md bg-secondary-50 dark:bg-secondary-900 text-secondary-900 dark:text-white font-mono text-xs"
										/>
										<button
											type="button"
											onClick={() =>
												copy_to_clipboard(
													`curl -s "${getProxmoxUrl()}" | bash`,
													"curl-command",
												)
											}
											className="btn-primary flex items-center gap-1 px-3 py-2 whitespace-nowrap"
										>
											{copy_success["curl-command"] ? (
												<>
													<CheckCircle className="h-4 w-4" />
													Copied
												</>
											) : (
												<>
													<Copy className="h-4 w-4" />
													Copy
												</>
											)}
										</button>
									</div>
									<p className="text-xs text-secondary-500 dark:text-secondary-400 mt-2">
										💡 This command will automatically discover and enroll all
										running LXC containers.
									</p>
								</div>
							</div>

							<div className="flex gap-3 pt-6">
								<button
									type="button"
									onClick={() => {
										setNewToken(null);
										setShowSecret(false);
									}}
									className="flex-1 btn-primary py-2 px-4 rounded-md"
								>
									I've Saved the Credentials
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</SettingsLayout>
	);
};

export default Integrations;
