import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertCircle,
	CheckCircle,
	Clock,
	Code,
	Download,
	Save,
} from "lucide-react";
import { useEffect, useId, useState } from "react";
import { settingsAPI, versionAPI } from "../../utils/api";

const VersionUpdateTab = () => {
	const repoPublicId = useId();
	const repoPrivateId = useId();
	const useCustomSshKeyId = useId();
	const githubRepoUrlId = useId();
	const sshKeyPathId = useId();
	const [formData, setFormData] = useState({
		githubRepoUrl: "git@github.com:9technologygroup/patchmon.net.git",
		repositoryType: "public",
		sshKeyPath: "",
		useCustomSshKey: false,
	});
	const [errors, setErrors] = useState({});
	const [isDirty, setIsDirty] = useState(false);

	// Version checking state
	const [versionInfo, setVersionInfo] = useState({
		currentVersion: null,
		latestVersion: null,
		isUpdateAvailable: false,
		checking: false,
		error: null,
	});

	const [sshTestResult, setSshTestResult] = useState({
		testing: false,
		success: null,
		message: null,
		error: null,
	});

	const queryClient = useQueryClient();

	// Fetch current settings
	const {
		data: settings,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["settings"],
		queryFn: () => settingsAPI.get().then((res) => res.data),
	});

	// Update form data when settings are loaded
	useEffect(() => {
		if (settings) {
			const newFormData = {
				githubRepoUrl:
					settings.github_repo_url ||
					"git@github.com:9technologygroup/patchmon.net.git",
				repositoryType: settings.repository_type || "public",
				sshKeyPath: settings.ssh_key_path || "",
				useCustomSshKey: !!settings.ssh_key_path,
			};
			setFormData(newFormData);
			setIsDirty(false);
		}
	}, [settings]);

	// Update settings mutation
	const updateSettingsMutation = useMutation({
		mutationFn: (data) => {
			return settingsAPI.update(data).then((res) => res.data);
		},
		onSuccess: () => {
			queryClient.invalidateQueries(["settings"]);
			setIsDirty(false);
			setErrors({});
		},
		onError: (error) => {
			if (error.response?.data?.errors) {
				setErrors(
					error.response.data.errors.reduce((acc, err) => {
						acc[err.path] = err.msg;
						return acc;
					}, {}),
				);
			} else {
				setErrors({
					general: error.response?.data?.error || "Failed to update settings",
				});
			}
		},
	});

	// Load current version on component mount
	useEffect(() => {
		const loadCurrentVersion = async () => {
			try {
				const response = await versionAPI.getCurrent();
				const data = response.data;
				setVersionInfo((prev) => ({
					...prev,
					currentVersion: data.version,
				}));
			} catch (error) {
				console.error("Error loading current version:", error);
			}
		};

		loadCurrentVersion();
	}, []);

	// Version checking functions
	const checkForUpdates = async () => {
		setVersionInfo((prev) => ({ ...prev, checking: true, error: null }));

		try {
			const response = await versionAPI.checkUpdates();
			const data = response.data;

			setVersionInfo({
				currentVersion: data.currentVersion,
				latestVersion: data.latestVersion,
				isUpdateAvailable: data.isUpdateAvailable,
				last_update_check: data.last_update_check,
				checking: false,
				error: null,
			});
		} catch (error) {
			console.error("Version check error:", error);
			setVersionInfo((prev) => ({
				...prev,
				checking: false,
				error: error.response?.data?.error || "Failed to check for updates",
			}));
		}
	};

	const testSshKey = async () => {
		if (!formData.sshKeyPath || !formData.githubRepoUrl) {
			setSshTestResult({
				testing: false,
				success: false,
				message: null,
				error: "Please enter both SSH key path and GitHub repository URL",
			});
			return;
		}

		setSshTestResult({
			testing: true,
			success: null,
			message: null,
			error: null,
		});

		try {
			const response = await versionAPI.testSshKey({
				sshKeyPath: formData.sshKeyPath,
				githubRepoUrl: formData.githubRepoUrl,
			});

			setSshTestResult({
				testing: false,
				success: true,
				message: response.data.message,
				error: null,
			});
		} catch (error) {
			console.error("SSH key test error:", error);
			setSshTestResult({
				testing: false,
				success: false,
				message: null,
				error: error.response?.data?.error || "Failed to test SSH key",
			});
		}
	};

	const handleInputChange = (field, value) => {
		setFormData((prev) => ({
			...prev,
			[field]: value,
		}));
		setIsDirty(true);
		if (errors[field]) {
			setErrors((prev) => ({ ...prev, [field]: null }));
		}
	};

	const handleSave = () => {
		// Only include sshKeyPath if the toggle is enabled
		const dataToSubmit = { ...formData };
		if (!dataToSubmit.useCustomSshKey) {
			dataToSubmit.sshKeyPath = "";
		}
		// Remove the frontend-only field
		delete dataToSubmit.useCustomSshKey;

		updateSettingsMutation.mutate(dataToSubmit);
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-64">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-md p-4">
				<div className="flex">
					<AlertCircle className="h-5 w-5 text-red-400 dark:text-red-300" />
					<div className="ml-3">
						<h3 className="text-sm font-medium text-red-800 dark:text-red-200">
							Error loading settings
						</h3>
						<p className="mt-1 text-sm text-red-700 dark:text-red-300">
							{error.response?.data?.error || "Failed to load settings"}
						</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{errors.general && (
				<div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-md p-4">
					<div className="flex">
						<AlertCircle className="h-5 w-5 text-red-400 dark:text-red-300" />
						<div className="ml-3">
							<p className="text-sm text-red-700 dark:text-red-300">
								{errors.general}
							</p>
						</div>
					</div>
				</div>
			)}

			<div className="flex items-center mb-6">
				<Code className="h-6 w-6 text-primary-600 mr-3" />
				<h2 className="text-xl font-semibold text-secondary-900 dark:text-white">
					Server Version Management
				</h2>
			</div>

			<div className="bg-secondary-50 dark:bg-secondary-700 rounded-lg p-6">
				<h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-4">
					Version Check Configuration
				</h3>
				<p className="text-sm text-secondary-600 dark:text-secondary-300 mb-6">
					Configure automatic version checking against your GitHub repository to
					notify users of available updates.
				</p>

				<div className="space-y-4">
					<fieldset>
						<legend className="block text-sm font-medium text-secondary-700 dark:text-secondary-200 mb-2">
							Repository Type
						</legend>
						<div className="space-y-2">
							<div className="flex items-center">
								<input
									type="radio"
									id={repoPublicId}
									name="repositoryType"
									value="public"
									checked={formData.repositoryType === "public"}
									onChange={(e) =>
										handleInputChange("repositoryType", e.target.value)
									}
									className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
								/>
								<label
									htmlFor={repoPublicId}
									className="ml-2 text-sm text-secondary-700 dark:text-secondary-200"
								>
									Public Repository (uses GitHub API - no authentication
									required)
								</label>
							</div>
							<div className="flex items-center">
								<input
									type="radio"
									id={repoPrivateId}
									name="repositoryType"
									value="private"
									checked={formData.repositoryType === "private"}
									onChange={(e) =>
										handleInputChange("repositoryType", e.target.value)
									}
									className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
								/>
								<label
									htmlFor={repoPrivateId}
									className="ml-2 text-sm text-secondary-700 dark:text-secondary-200"
								>
									Private Repository (uses SSH with deploy key)
								</label>
							</div>
						</div>
						<p className="mt-1 text-xs text-secondary-500 dark:text-secondary-400">
							Choose whether your repository is public or private to determine
							the appropriate access method.
						</p>
					</fieldset>

					<div>
						<label
							htmlFor={githubRepoUrlId}
							className="block text-sm font-medium text-secondary-700 dark:text-secondary-200 mb-2"
						>
							GitHub Repository URL
						</label>
						<input
							id={githubRepoUrlId}
							type="text"
							value={formData.githubRepoUrl || ""}
							onChange={(e) =>
								handleInputChange("githubRepoUrl", e.target.value)
							}
							className="w-full border border-secondary-300 dark:border-secondary-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-secondary-700 text-secondary-900 dark:text-white font-mono text-sm"
							placeholder="git@github.com:username/repository.git"
						/>
						<p className="mt-1 text-xs text-secondary-500 dark:text-secondary-400">
							SSH or HTTPS URL to your GitHub repository
						</p>
					</div>

					{formData.repositoryType === "private" && (
						<div>
							<div className="flex items-center gap-3 mb-3">
								<input
									type="checkbox"
									id={useCustomSshKeyId}
									checked={formData.useCustomSshKey}
									onChange={(e) => {
										const checked = e.target.checked;
										handleInputChange("useCustomSshKey", checked);
										if (!checked) {
											handleInputChange("sshKeyPath", "");
										}
									}}
									className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
								/>
								<label
									htmlFor={useCustomSshKeyId}
									className="text-sm font-medium text-secondary-700 dark:text-secondary-200"
								>
									Set custom SSH key path
								</label>
							</div>

							{formData.useCustomSshKey && (
								<div>
									<label
										htmlFor={sshKeyPathId}
										className="block text-sm font-medium text-secondary-700 dark:text-secondary-200 mb-2"
									>
										SSH Key Path
									</label>
									<input
										id={sshKeyPathId}
										type="text"
										value={formData.sshKeyPath || ""}
										onChange={(e) =>
											handleInputChange("sshKeyPath", e.target.value)
										}
										className="w-full border border-secondary-300 dark:border-secondary-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-secondary-700 text-secondary-900 dark:text-white font-mono text-sm"
										placeholder="/root/.ssh/id_ed25519"
									/>
									<p className="mt-1 text-xs text-secondary-500 dark:text-secondary-400">
										Path to your SSH deploy key. If not set, will auto-detect
										from common locations.
									</p>

									<div className="mt-3">
										<button
											type="button"
											onClick={testSshKey}
											disabled={
												sshTestResult.testing ||
												!formData.sshKeyPath ||
												!formData.githubRepoUrl
											}
											className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
										>
											{sshTestResult.testing ? "Testing..." : "Test SSH Key"}
										</button>

										{sshTestResult.success && (
											<div className="mt-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
												<div className="flex items-center">
													<CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mr-2" />
													<p className="text-sm text-green-800 dark:text-green-200">
														{sshTestResult.message}
													</p>
												</div>
											</div>
										)}

										{sshTestResult.error && (
											<div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
												<div className="flex items-center">
													<AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mr-2" />
													<p className="text-sm text-red-800 dark:text-red-200">
														{sshTestResult.error}
													</p>
												</div>
											</div>
										)}
									</div>
								</div>
							)}

							{!formData.useCustomSshKey && (
								<p className="text-xs text-secondary-500 dark:text-secondary-400">
									Using auto-detection for SSH key location
								</p>
							)}
						</div>
					)}

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="bg-white dark:bg-secondary-800 rounded-lg p-4 border border-secondary-200 dark:border-secondary-600">
							<div className="flex items-center gap-2 mb-2">
								<CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
								<span className="text-sm font-medium text-secondary-700 dark:text-secondary-300">
									Current Version
								</span>
							</div>
							<span className="text-lg font-mono text-secondary-900 dark:text-white">
								{versionInfo.currentVersion}
							</span>
						</div>

						<div className="bg-white dark:bg-secondary-800 rounded-lg p-4 border border-secondary-200 dark:border-secondary-600">
							<div className="flex items-center gap-2 mb-2">
								<Download className="h-4 w-4 text-blue-600 dark:text-blue-400" />
								<span className="text-sm font-medium text-secondary-700 dark:text-secondary-300">
									Latest Version
								</span>
							</div>
							<span className="text-lg font-mono text-secondary-900 dark:text-white">
								{versionInfo.checking ? (
									<span className="text-blue-600 dark:text-blue-400">
										Checking...
									</span>
								) : versionInfo.latestVersion ? (
									<span
										className={
											versionInfo.isUpdateAvailable
												? "text-orange-600 dark:text-orange-400"
												: "text-green-600 dark:text-green-400"
										}
									>
										{versionInfo.latestVersion}
										{versionInfo.isUpdateAvailable && " (Update Available!)"}
									</span>
								) : (
									<span className="text-secondary-500 dark:text-secondary-400">
										Not checked
									</span>
								)}
							</span>
						</div>
					</div>

					{/* Last Checked Time */}
					{versionInfo.last_update_check && (
						<div className="bg-white dark:bg-secondary-800 rounded-lg p-4 border border-secondary-200 dark:border-secondary-600">
							<div className="flex items-center gap-2 mb-2">
								<Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
								<span className="text-sm font-medium text-secondary-700 dark:text-secondary-300">
									Last Checked
								</span>
							</div>
							<span className="text-sm text-secondary-600 dark:text-secondary-400">
								{new Date(versionInfo.last_update_check).toLocaleString()}
							</span>
							<p className="text-xs text-secondary-500 dark:text-secondary-400 mt-1">
								Updates are checked automatically every 24 hours
							</p>
						</div>
					)}

					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<button
								type="button"
								onClick={checkForUpdates}
								disabled={versionInfo.checking}
								className="btn-primary flex items-center gap-2"
							>
								<Download className="h-4 w-4" />
								{versionInfo.checking ? "Checking..." : "Check for Updates"}
							</button>
						</div>

						{/* Save Button for Version Settings */}
						<button
							type="button"
							onClick={handleSave}
							disabled={!isDirty || updateSettingsMutation.isPending}
							className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
								!isDirty || updateSettingsMutation.isPending
									? "bg-secondary-400 cursor-not-allowed"
									: "bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
							}`}
						>
							{updateSettingsMutation.isPending ? (
								<>
									<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
									Saving...
								</>
							) : (
								<>
									<Save className="h-4 w-4 mr-2" />
									Save Settings
								</>
							)}
						</button>
					</div>

					{versionInfo.error && (
						<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
							<div className="flex">
								<AlertCircle className="h-5 w-5 text-red-400 dark:text-red-300" />
								<div className="ml-3">
									<h3 className="text-sm font-medium text-red-800 dark:text-red-200">
										Version Check Failed
									</h3>
									<p className="mt-1 text-sm text-red-700 dark:text-red-300">
										{versionInfo.error}
									</p>
									{versionInfo.error.includes("private") && (
										<p className="mt-2 text-xs text-red-600 dark:text-red-400">
											For private repositories, you may need to configure GitHub
											authentication or make the repository public.
										</p>
									)}
								</div>
							</div>
						</div>
					)}

					{/* Success Message for Version Settings */}
					{updateSettingsMutation.isSuccess && (
						<div className="bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 rounded-md p-4">
							<div className="flex">
								<CheckCircle className="h-5 w-5 text-green-400 dark:text-green-300" />
								<div className="ml-3">
									<p className="text-sm text-green-700 dark:text-green-300">
										Settings saved successfully!
									</p>
								</div>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

export default VersionUpdateTab;
