import {
	AlertCircle,
	BookOpen,
	CheckCircle,
	Container,
	Copy,
	Eye,
	EyeOff,
	Plus,
	Server,
	Trash2,
	X,
} from "lucide-react";
import { useEffect, useId, useState } from "react";
import SettingsLayout from "../../components/SettingsLayout";
import api from "../../utils/api";

const Integrations = () => {
	// Generate unique IDs for form elements
	const token_name_id = useId();
	const token_key_id = useId();
	const token_secret_id = useId();
	const token_base64_id = useId();
	const gethomepage_config_id = useId();

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
					integration_type:
						activeTab === "gethomepage" ? "gethomepage" : "proxmox-lxc",
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

	const copy_to_clipboard = async (text, key) => {
		// Check if Clipboard API is available
		if (navigator.clipboard && window.isSecureContext) {
			try {
				await navigator.clipboard.writeText(text);
				setCopySuccess({ ...copy_success, [key]: true });
				setTimeout(() => {
					setCopySuccess({ ...copy_success, [key]: false });
				}, 2000);
				return;
			} catch (error) {
				console.error("Clipboard API failed:", error);
				// Fall through to fallback method
			}
		}

		// Fallback method for older browsers or non-secure contexts
		try {
			const textArea = document.createElement("textarea");
			textArea.value = text;
			textArea.style.position = "fixed";
			textArea.style.left = "-999999px";
			textArea.style.top = "-999999px";
			document.body.appendChild(textArea);
			textArea.focus();
			textArea.select();

			const successful = document.execCommand("copy");
			document.body.removeChild(textArea);

			if (successful) {
				setCopySuccess({ ...copy_success, [key]: true });
				setTimeout(() => {
					setCopySuccess({ ...copy_success, [key]: false });
				}, 2000);
			} else {
				console.error("Fallback copy failed");
				alert("Failed to copy to clipboard. Please copy manually.");
			}
		} catch (fallbackError) {
			console.error("Fallback copy failed:", fallbackError);
			alert("Failed to copy to clipboard. Please copy manually.");
		}
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
						<button
							type="button"
							onClick={() => handleTabChange("gethomepage")}
							className={`px-6 py-3 text-sm font-medium ${
								activeTab === "gethomepage"
									? "text-primary-600 dark:text-primary-400 border-b-2 border-primary-500 bg-primary-50 dark:bg-primary-900/20"
									: "text-secondary-500 dark:text-secondary-400 hover:text-secondary-700 dark:hover:text-secondary-300 hover:bg-secondary-50 dark:hover:bg-secondary-700/50"
							}`}
						>
							GetHomepage
						</button>
						<button
							type="button"
							onClick={() => handleTabChange("docker")}
							className={`px-6 py-3 text-sm font-medium ${
								activeTab === "docker"
									? "text-primary-600 dark:text-primary-400 border-b-2 border-primary-500 bg-primary-50 dark:bg-primary-900/20"
									: "text-secondary-500 dark:text-secondary-400 hover:text-secondary-700 dark:hover:text-secondary-300 hover:bg-secondary-50 dark:hover:bg-secondary-700/50"
							}`}
						>
							Docker
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
									<div className="flex items-center justify-between mb-4">
										<h3 className="text-lg font-semibold text-primary-900 dark:text-primary-200">
											How to Use Auto-Enrollment
										</h3>
										<a
											href="https://docs.patchmon.net/books/patchmon-application-documentation/page/proxmox-lxc-auto-enrollment-guide"
											target="_blank"
											rel="noopener noreferrer"
											className="px-4 py-2 bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 text-white rounded-lg flex items-center gap-2 transition-colors"
										>
											<BookOpen className="h-4 w-4" />
											Documentation
										</a>
									</div>
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

						{/* GetHomepage Tab */}
						{activeTab === "gethomepage" && (
							<div className="space-y-6">
								{/* Header with New API Key Button */}
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-3">
										<div className="w-10 h-10 bg-primary-100 dark:bg-primary-900 rounded-lg flex items-center justify-center">
											<Server className="h-5 w-5 text-primary-600 dark:text-primary-400" />
										</div>
										<div>
											<h3 className="text-lg font-semibold text-secondary-900 dark:text-white">
												GetHomepage Widget Integration
											</h3>
											<p className="text-sm text-secondary-600 dark:text-secondary-400">
												Create API keys to display PatchMon statistics in your
												GetHomepage dashboard
											</p>
										</div>
									</div>
									<button
										type="button"
										onClick={() => setShowCreateModal(true)}
										className="btn-primary flex items-center gap-2"
									>
										<Plus className="h-4 w-4" />
										New API Key
									</button>
								</div>

								{/* API Keys List */}
								{loading ? (
									<div className="text-center py-8">
										<div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
									</div>
								) : tokens.filter(
										(token) =>
											token.metadata?.integration_type === "gethomepage",
									).length === 0 ? (
									<div className="text-center py-8 text-secondary-600 dark:text-secondary-400">
										<p>No GetHomepage API keys created yet.</p>
										<p className="text-sm mt-2">
											Create an API key to enable GetHomepage widget
											integration.
										</p>
									</div>
								) : (
									<div className="space-y-3">
										{tokens
											.filter(
												(token) =>
													token.metadata?.integration_type === "gethomepage",
											)
											.map((token) => (
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
																<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
																	GetHomepage
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
																<p>Created: {format_date(token.created_at)}</p>
																{token.last_used_at && (
																	<p>
																		Last Used: {format_date(token.last_used_at)}
																	</p>
																)}
																{token.expires_at && (
																	<p>
																		Expires: {format_date(token.expires_at)}
																		{new Date(token.expires_at) <
																			new Date() && (
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
									<div className="flex items-center justify-between mb-4">
										<h3 className="text-lg font-semibold text-primary-900 dark:text-primary-200">
											How to Use GetHomepage Integration
										</h3>
										<a
											href="https://docs.patchmon.net/books/patchmon-application-documentation/page/gethomepagedev-dashboard-card"
											target="_blank"
											rel="noopener noreferrer"
											className="px-4 py-2 bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 text-white rounded-lg flex items-center gap-2 transition-colors"
										>
											<BookOpen className="h-4 w-4" />
											Documentation
										</a>
									</div>
									<ol className="list-decimal list-inside space-y-2 text-sm text-primary-800 dark:text-primary-300">
										<li>Create a new API key using the button above</li>
										<li>Copy the API key and secret from the success dialog</li>
										<li>
											Add the following widget configuration to your GetHomepage{" "}
											<code className="bg-primary-100 dark:bg-primary-900/40 px-1 py-0.5 rounded text-xs">
												services.yml
											</code>{" "}
											file:
										</li>
									</ol>

									<div className="mt-4 p-3 bg-primary-100 dark:bg-primary-900/40 rounded border border-primary-200 dark:border-primary-700">
										<pre className="text-xs text-primary-800 dark:text-primary-300 whitespace-pre-wrap overflow-x-auto font-mono">
											{`- PatchMon:
    href: ${server_url}
    description: PatchMon Statistics
    icon: ${server_url}/assets/favicon.svg
    widget:
      type: customapi
      url: ${server_url}/api/v1/gethomepage/stats
      headers:
        Authorization: Basic BASE64_ENCODED_CREDENTIALS
      mappings:
        - field: total_hosts
          label: Total Hosts
        - field: hosts_needing_updates
          label: Needs Updates
        - field: security_updates
          label: Security Updates`}
										</pre>
									</div>

									<div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
										<p className="text-xs text-blue-800 dark:text-blue-300 mb-2">
											<strong>
												How to generate BASE64_ENCODED_CREDENTIALS:
											</strong>
										</p>
										<pre className="text-xs text-blue-800 dark:text-blue-300 font-mono bg-blue-100 dark:bg-blue-900/40 p-2 rounded overflow-x-auto">
											{`echo -n "YOUR_API_KEY:YOUR_API_SECRET" | base64`}
										</pre>
										<p className="text-xs text-blue-800 dark:text-blue-300 mt-2">
											Replace YOUR_API_KEY and YOUR_API_SECRET with your actual
											credentials, then run this command to get the base64
											string.
										</p>
									</div>

									<div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
										<h4 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">
											Additional Widget Examples
										</h4>
										<p className="text-xs text-blue-800 dark:text-blue-300 mb-2">
											You can create multiple widgets to display different
											statistics:
										</p>
										<div className="space-y-2 text-xs text-blue-800 dark:text-blue-300 font-mono">
											<div className="bg-blue-100 dark:bg-blue-900/40 p-2 rounded">
												<strong>Security Updates Widget:</strong>
												<br />
												type: customapi
												<br />
												key: security_updates
												<br />
												value: hosts_with_security_updates
												<br />
												label: Security Updates
											</div>
											<div className="bg-blue-100 dark:bg-blue-900/40 p-2 rounded">
												<strong>Up-to-Date Hosts Widget:</strong>
												<br />
												type: customapi
												<br />
												key: up_to_date_hosts
												<br />
												value: total_hosts
												<br />
												label: Up-to-Date Hosts
											</div>
											<div className="bg-blue-100 dark:bg-blue-900/40 p-2 rounded">
												<strong>Recent Activity Widget:</strong>
												<br />
												type: customapi
												<br />
												key: recent_updates_24h
												<br />
												value: total_hosts
												<br />
												label: Updates (24h)
											</div>
										</div>
									</div>
								</div>
							</div>
						)}

						{/* Docker Tab */}
						{activeTab === "docker" && (
							<div className="space-y-6">
								{/* Header */}
								<div className="flex items-center gap-3">
									<div className="w-10 h-10 bg-primary-100 dark:bg-primary-900 rounded-lg flex items-center justify-center">
										<Container className="h-5 w-5 text-primary-600 dark:text-primary-400" />
									</div>
									<div>
										<h3 className="text-lg font-semibold text-secondary-900 dark:text-white">
											Docker Container Monitoring
										</h3>
										<p className="text-sm text-secondary-600 dark:text-secondary-400">
											Monitor Docker containers and images for available updates
										</p>
									</div>
								</div>

								{/* Installation Instructions */}
								<div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-6">
									<h3 className="text-lg font-semibold text-primary-900 dark:text-primary-200 mb-4">
										Agent Installation
									</h3>
									<ol className="list-decimal list-inside space-y-3 text-sm text-primary-800 dark:text-primary-300">
										<li>
											Make sure you have the PatchMon credentials file set up on
											your host (
											<code className="bg-primary-100 dark:bg-primary-900/40 px-1 py-0.5 rounded text-xs">
												/etc/patchmon/credentials
											</code>
											)
										</li>
										<li>
											SSH into your Docker host where you want to monitor
											containers
										</li>
										<li>Run the installation command below</li>
										<li>
											The agent will automatically collect Docker container and
											image information every 5 minutes
										</li>
										<li>View your Docker inventory in the Docker page</li>
									</ol>
								</div>

								{/* Installation Command */}
								<div className="bg-white dark:bg-secondary-900 border border-secondary-200 dark:border-secondary-600 rounded-lg p-6">
									<h4 className="text-md font-semibold text-secondary-900 dark:text-white mb-3">
										Quick Installation (One-Line Command)
									</h4>
									<div className="space-y-3">
										<div>
											<div className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
												Download and install the Docker agent:
											</div>
											<div className="flex items-center gap-2">
												<input
													type="text"
													value={`curl -o /usr/local/bin/patchmon-docker-agent.sh "${server_url}/api/v1/docker/agent" && chmod +x /usr/local/bin/patchmon-docker-agent.sh && echo "*/5 * * * * /usr/local/bin/patchmon-docker-agent.sh collect" | crontab -`}
													readOnly
													className="flex-1 px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md bg-secondary-50 dark:bg-secondary-900 text-secondary-900 dark:text-white font-mono text-xs"
												/>
												<button
													type="button"
													onClick={() =>
														copy_to_clipboard(
															`curl -o /usr/local/bin/patchmon-docker-agent.sh "${server_url}/api/v1/docker/agent" && chmod +x /usr/local/bin/patchmon-docker-agent.sh && echo "*/5 * * * * /usr/local/bin/patchmon-docker-agent.sh collect" | crontab -`,
															"docker-install",
														)
													}
													className="btn-primary flex items-center gap-1 px-3 py-2 whitespace-nowrap"
												>
													{copy_success["docker-install"] ? (
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
												💡 This will download the agent, make it executable, and
												set up a cron job to run every 5 minutes
											</p>
										</div>
									</div>
								</div>

								{/* Manual Installation Steps */}
								<div className="bg-white dark:bg-secondary-900 border border-secondary-200 dark:border-secondary-600 rounded-lg p-6">
									<h4 className="text-md font-semibold text-secondary-900 dark:text-white mb-3">
										Manual Installation Steps
									</h4>
									<div className="space-y-4">
										<div>
											<p className="text-sm text-secondary-700 dark:text-secondary-300 mb-2">
												<strong>Step 1:</strong> Download the agent
											</p>
											<div className="flex items-center gap-2">
												<input
													type="text"
													value={`curl -o /usr/local/bin/patchmon-docker-agent.sh "${server_url}/api/v1/docker/agent"`}
													readOnly
													className="flex-1 px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md bg-secondary-50 dark:bg-secondary-900 text-secondary-900 dark:text-white font-mono text-xs"
												/>
												<button
													type="button"
													onClick={() =>
														copy_to_clipboard(
															`curl -o /usr/local/bin/patchmon-docker-agent.sh "${server_url}/api/v1/docker/agent"`,
															"docker-download",
														)
													}
													className="btn-primary p-2"
												>
													{copy_success["docker-download"] ? (
														<CheckCircle className="h-4 w-4" />
													) : (
														<Copy className="h-4 w-4" />
													)}
												</button>
											</div>
										</div>

										<div>
											<p className="text-sm text-secondary-700 dark:text-secondary-300 mb-2">
												<strong>Step 2:</strong> Make it executable
											</p>
											<div className="flex items-center gap-2">
												<input
													type="text"
													value="chmod +x /usr/local/bin/patchmon-docker-agent.sh"
													readOnly
													className="flex-1 px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md bg-secondary-50 dark:bg-secondary-900 text-secondary-900 dark:text-white font-mono text-xs"
												/>
												<button
													type="button"
													onClick={() =>
														copy_to_clipboard(
															"chmod +x /usr/local/bin/patchmon-docker-agent.sh",
															"docker-chmod",
														)
													}
													className="btn-primary p-2"
												>
													{copy_success["docker-chmod"] ? (
														<CheckCircle className="h-4 w-4" />
													) : (
														<Copy className="h-4 w-4" />
													)}
												</button>
											</div>
										</div>

										<div>
											<p className="text-sm text-secondary-700 dark:text-secondary-300 mb-2">
												<strong>Step 3:</strong> Test the agent
											</p>
											<div className="flex items-center gap-2">
												<input
													type="text"
													value="/usr/local/bin/patchmon-docker-agent.sh collect"
													readOnly
													className="flex-1 px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md bg-secondary-50 dark:bg-secondary-900 text-secondary-900 dark:text-white font-mono text-xs"
												/>
												<button
													type="button"
													onClick={() =>
														copy_to_clipboard(
															"/usr/local/bin/patchmon-docker-agent.sh collect",
															"docker-test",
														)
													}
													className="btn-primary p-2"
												>
													{copy_success["docker-test"] ? (
														<CheckCircle className="h-4 w-4" />
													) : (
														<Copy className="h-4 w-4" />
													)}
												</button>
											</div>
										</div>

										<div>
											<p className="text-sm text-secondary-700 dark:text-secondary-300 mb-2">
												<strong>Step 4:</strong> Set up automatic collection
												(every 5 minutes)
											</p>
											<div className="flex items-center gap-2">
												<input
													type="text"
													value='echo "*/5 * * * * /usr/local/bin/patchmon-docker-agent.sh collect" | crontab -'
													readOnly
													className="flex-1 px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md bg-secondary-50 dark:bg-secondary-900 text-secondary-900 dark:text-white font-mono text-xs"
												/>
												<button
													type="button"
													onClick={() =>
														copy_to_clipboard(
															'echo "*/5 * * * * /usr/local/bin/patchmon-docker-agent.sh collect" | crontab -',
															"docker-cron",
														)
													}
													className="btn-primary p-2"
												>
													{copy_success["docker-cron"] ? (
														<CheckCircle className="h-4 w-4" />
													) : (
														<Copy className="h-4 w-4" />
													)}
												</button>
											</div>
										</div>
									</div>
								</div>

								{/* Prerequisites */}
								<div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
									<div className="flex items-start gap-2">
										<AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
										<div className="text-sm text-yellow-800 dark:text-yellow-200">
											<p className="font-semibold mb-2">Prerequisites:</p>
											<ul className="list-disc list-inside space-y-1 ml-2">
												<li>
													Docker must be installed and running on the host
												</li>
												<li>
													PatchMon credentials file must exist at{" "}
													<code className="bg-yellow-100 dark:bg-yellow-900/40 px-1 py-0.5 rounded text-xs">
														/etc/patchmon/credentials
													</code>
												</li>
												<li>
													The host must have network access to your PatchMon
													server
												</li>
												<li>The agent must run as root (or with sudo)</li>
											</ul>
										</div>
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
									{activeTab === "gethomepage"
										? "Create GetHomepage API Key"
										: "Create Auto-Enrollment Token"}
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
										placeholder={
											activeTab === "gethomepage"
												? "e.g., GetHomepage Widget"
												: "e.g., Proxmox Production"
										}
										className="w-full px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md bg-white dark:bg-secondary-700 text-secondary-900 dark:text-white"
									/>
								</label>

								{activeTab === "proxmox" && (
									<>
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
												Maximum number of hosts that can be enrolled per day
												using this token
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
									</>
								)}

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
					<div className="bg-white dark:bg-secondary-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
						<div className="p-6">
							<div className="flex items-center justify-between mb-4">
								<div className="flex items-center gap-2">
									<CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
									<h2 className="text-lg font-bold text-secondary-900 dark:text-white">
										{activeTab === "gethomepage"
											? "API Key Created Successfully"
											: "Token Created Successfully"}
									</h2>
								</div>
								<button
									type="button"
									onClick={() => {
										setNewToken(null);
										setShowSecret(false);
									}}
									className="text-secondary-400 hover:text-secondary-600 dark:hover:text-secondary-200"
								>
									<X className="h-5 w-5" />
								</button>
							</div>

							<div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4">
								<div className="flex items-center gap-2">
									<AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
									<p className="text-xs text-yellow-800 dark:text-yellow-200">
										<strong>Important:</strong> Save these credentials - the
										secret won't be shown again.
									</p>
								</div>
							</div>

							<div className="space-y-3">
								<div>
									<label
										htmlFor={token_name_id}
										className="block text-xs font-medium text-secondary-700 dark:text-secondary-300 mb-1"
									>
										Token Name
									</label>
									<input
										id={token_name_id}
										type="text"
										value={new_token.token_name}
										readOnly
										className="w-full px-3 py-2 text-sm border border-secondary-300 dark:border-secondary-600 rounded-md bg-secondary-50 dark:bg-secondary-900 text-secondary-900 dark:text-white font-mono"
									/>
								</div>

								<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
									<div>
										<label
											htmlFor={token_key_id}
											className="block text-xs font-medium text-secondary-700 dark:text-secondary-300 mb-1"
										>
											Token Key
										</label>
										<div className="flex items-center gap-2">
											<input
												id={token_key_id}
												type="text"
												value={new_token.token_key}
												readOnly
												className="flex-1 px-3 py-2 text-sm border border-secondary-300 dark:border-secondary-600 rounded-md bg-secondary-50 dark:bg-secondary-900 text-secondary-900 dark:text-white font-mono"
											/>
											<button
												type="button"
												onClick={() =>
													copy_to_clipboard(new_token.token_key, "new-key")
												}
												className="btn-primary p-2"
												title="Copy Key"
											>
												{copy_success["new-key"] ? (
													<CheckCircle className="h-4 w-4" />
												) : (
													<Copy className="h-4 w-4" />
												)}
											</button>
										</div>
									</div>

									<div>
										<label
											htmlFor={token_secret_id}
											className="block text-xs font-medium text-secondary-700 dark:text-secondary-300 mb-1"
										>
											Token Secret
										</label>
										<div className="flex items-center gap-2">
											<input
												id={token_secret_id}
												type={show_secret ? "text" : "password"}
												value={new_token.token_secret}
												readOnly
												className="flex-1 px-3 py-2 text-sm border border-secondary-300 dark:border-secondary-600 rounded-md bg-secondary-50 dark:bg-secondary-900 text-secondary-900 dark:text-white font-mono"
											/>
											<button
												type="button"
												onClick={() => setShowSecret(!show_secret)}
												className="p-2 text-secondary-600 hover:text-secondary-800 dark:text-secondary-400"
												title="Toggle visibility"
											>
												{show_secret ? (
													<EyeOff className="h-4 w-4" />
												) : (
													<Eye className="h-4 w-4" />
												)}
											</button>
											<button
												type="button"
												onClick={() =>
													copy_to_clipboard(
														new_token.token_secret,
														"new-secret",
													)
												}
												className="btn-primary p-2"
												title="Copy Secret"
											>
												{copy_success["new-secret"] ? (
													<CheckCircle className="h-4 w-4" />
												) : (
													<Copy className="h-4 w-4" />
												)}
											</button>
										</div>
									</div>
								</div>

								{activeTab === "proxmox" && (
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
								)}

								{activeTab === "gethomepage" && (
									<div className="mt-3 space-y-3">
										<div>
											<label
												htmlFor={token_base64_id}
												className="block text-xs font-medium text-secondary-700 dark:text-secondary-300 mb-1"
											>
												Base64 Encoded Credentials
											</label>
											<div className="flex items-center gap-2">
												<input
													id={token_base64_id}
													type="text"
													value={btoa(
														`${new_token.token_key}:${new_token.token_secret}`,
													)}
													readOnly
													className="flex-1 px-3 py-2 text-sm border border-secondary-300 dark:border-secondary-600 rounded-md bg-secondary-50 dark:bg-secondary-900 text-secondary-900 dark:text-white font-mono"
												/>
												<button
													type="button"
													onClick={() =>
														copy_to_clipboard(
															btoa(
																`${new_token.token_key}:${new_token.token_secret}`,
															),
															"base64-creds",
														)
													}
													className="btn-primary p-2"
													title="Copy Base64"
												>
													{copy_success["base64-creds"] ? (
														<CheckCircle className="h-4 w-4" />
													) : (
														<Copy className="h-4 w-4" />
													)}
												</button>
											</div>
										</div>

										<div>
											<div className="flex items-center justify-between mb-1">
												<label
													htmlFor={gethomepage_config_id}
													className="text-xs font-medium text-secondary-700 dark:text-secondary-300"
												>
													GetHomepage Configuration
												</label>
												<button
													type="button"
													onClick={() => {
														const base64Creds = btoa(
															`${new_token.token_key}:${new_token.token_secret}`,
														);
														const config = `- PatchMon:
    href: ${server_url}
    description: PatchMon Statistics
    icon: ${server_url}/assets/favicon.svg
    widget:
      type: customapi
      url: ${server_url}/api/v1/gethomepage/stats
      headers:
        Authorization: Basic ${base64Creds}
      mappings:
        - field: total_hosts
          label: Total Hosts
        - field: hosts_needing_updates
          label: Needs Updates
        - field: security_updates
          label: Security Updates`;
														copy_to_clipboard(config, "gethomepage-config");
													}}
													className="btn-primary flex items-center gap-1 px-2 py-1 text-xs"
												>
													{copy_success["gethomepage-config"] ? (
														<>
															<CheckCircle className="h-3 w-3" />
															Copied
														</>
													) : (
														<>
															<Copy className="h-3 w-3" />
															Copy Config
														</>
													)}
												</button>
											</div>
											<textarea
												id={gethomepage_config_id}
												value={(() => {
													const base64Creds = btoa(
														`${new_token.token_key}:${new_token.token_secret}`,
													);
													return `- PatchMon:
    href: ${server_url}
    description: PatchMon Statistics
    icon: ${server_url}/assets/favicon.svg
    widget:
      type: customapi
      url: ${server_url}/api/v1/gethomepage/stats
      headers:
        Authorization: Basic ${base64Creds}
      mappings:
        - field: total_hosts
          label: Total Hosts
        - field: hosts_needing_updates
          label: Needs Updates
        - field: security_updates
          label: Security Updates`;
												})()}
												readOnly
												rows={12}
												className="w-full px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md bg-secondary-50 dark:bg-secondary-900 text-secondary-900 dark:text-white font-mono text-xs resize-none"
											/>
											<p className="text-xs text-secondary-500 dark:text-secondary-400 mt-1">
												💡 Paste into your GetHomepage{" "}
												<code className="bg-secondary-100 dark:bg-secondary-700 px-1 rounded">
													services.yml
												</code>
											</p>
										</div>
									</div>
								)}
							</div>

							<div className="mt-4 pt-4 border-t border-secondary-200 dark:border-secondary-600">
								<button
									type="button"
									onClick={() => {
										setNewToken(null);
										setShowSecret(false);
									}}
									className="w-full btn-primary py-2 px-4 rounded-md"
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
