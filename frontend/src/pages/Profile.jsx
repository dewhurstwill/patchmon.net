import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertCircle,
	CheckCircle,
	Copy,
	Download,
	Eye,
	EyeOff,
	Key,
	Mail,
	Moon,
	RefreshCw,
	Save,
	Shield,
	Smartphone,
	Sun,
	Trash2,
	User,
} from "lucide-react";

import { useId, useState } from "react";

import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { tfaAPI } from "../utils/api";

const Profile = () => {
	const usernameId = useId();
	const emailId = useId();
	const firstNameId = useId();
	const lastNameId = useId();
	const currentPasswordId = useId();
	const newPasswordId = useId();
	const confirmPasswordId = useId();
	const { user, updateProfile, changePassword } = useAuth();
	const { toggleTheme, isDark } = useTheme();
	const [activeTab, setActiveTab] = useState("profile");
	const [isLoading, setIsLoading] = useState(false);
	const [message, setMessage] = useState({ type: "", text: "" });

	const [profileData, setProfileData] = useState({
		username: user?.username || "",
		email: user?.email || "",
		first_name: user?.first_name || "",
		last_name: user?.last_name || "",
	});

	const [passwordData, setPasswordData] = useState({
		currentPassword: "",
		newPassword: "",
		confirmPassword: "",
	});

	const [showPasswords, setShowPasswords] = useState({
		current: false,
		new: false,
		confirm: false,
	});

	const handleProfileSubmit = async (e) => {
		e.preventDefault();
		setIsLoading(true);
		setMessage({ type: "", text: "" });

		try {
			const result = await updateProfile(profileData);
			if (result.success) {
				setMessage({ type: "success", text: "Profile updated successfully!" });
			} else {
				setMessage({
					type: "error",
					text: result.error || "Failed to update profile",
				});
			}
		} catch {
			setMessage({ type: "error", text: "Network error occurred" });
		} finally {
			setIsLoading(false);
		}
	};

	const handlePasswordSubmit = async (e) => {
		e.preventDefault();
		setIsLoading(true);
		setMessage({ type: "", text: "" });

		if (passwordData.newPassword !== passwordData.confirmPassword) {
			setMessage({ type: "error", text: "New passwords do not match" });
			setIsLoading(false);
			return;
		}

		if (passwordData.newPassword.length < 6) {
			setMessage({
				type: "error",
				text: "New password must be at least 6 characters",
			});
			setIsLoading(false);
			return;
		}

		try {
			const result = await changePassword(
				passwordData.currentPassword,
				passwordData.newPassword,
			);
			if (result.success) {
				setMessage({ type: "success", text: "Password changed successfully!" });
				setPasswordData({
					currentPassword: "",
					newPassword: "",
					confirmPassword: "",
				});
			} else {
				setMessage({
					type: "error",
					text: result.error || "Failed to change password",
				});
			}
		} catch {
			setMessage({ type: "error", text: "Network error occurred" });
		} finally {
			setIsLoading(false);
		}
	};

	const handleInputChange = (e) => {
		const { name, value } = e.target;
		if (activeTab === "profile") {
			setProfileData((prev) => ({ ...prev, [name]: value }));
		} else {
			setPasswordData((prev) => ({ ...prev, [name]: value }));
		}
	};

	const togglePasswordVisibility = (field) => {
		setShowPasswords((prev) => ({ ...prev, [field]: !prev[field] }));
	};

	const tabs = [
		{ id: "profile", name: "Profile Information", icon: User },
		{ id: "password", name: "Change Password", icon: Key },
		{ id: "tfa", name: "Multi-Factor Authentication", icon: Smartphone },
	];

	return (
		<div className="space-y-6">
			{/* Header */}
			<div>
				<p className="text-sm text-secondary-600 dark:text-secondary-300">
					Manage your account information and security settings
				</p>
			</div>

			{/* User Info Card */}
			<div className="bg-white dark:bg-secondary-800 shadow rounded-lg p-6">
				<div className="flex items-center space-x-4">
					<div className="flex-shrink-0">
						<div className="h-16 w-16 rounded-full bg-primary-100 flex items-center justify-center">
							<User className="h-8 w-8 text-primary-600" />
						</div>
					</div>
					<div className="flex-1">
						<h3 className="text-lg font-medium text-secondary-900 dark:text-white">
							{user?.first_name && user?.last_name
								? `${user.first_name} ${user.last_name}`
								: user?.first_name || user?.username}
						</h3>
						<p className="text-sm text-secondary-600 dark:text-secondary-300">
							{user?.email}
						</p>
						<div className="mt-2">
							<span
								className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
									user?.role === "admin"
										? "bg-primary-100 text-primary-800"
										: user?.role === "host_manager"
											? "bg-green-100 text-green-800"
											: user?.role === "readonly"
												? "bg-yellow-100 text-yellow-800"
												: "bg-secondary-100 text-secondary-800"
								}`}
							>
								<Shield className="h-3 w-3 mr-1" />
								{user?.role?.charAt(0).toUpperCase() +
									user?.role?.slice(1).replace("_", " ")}
							</span>
						</div>
					</div>
				</div>
			</div>

			{/* Tabs */}
			<div className="bg-white dark:bg-secondary-800 shadow rounded-lg">
				<div className="border-b border-secondary-200 dark:border-secondary-600">
					<nav className="-mb-px flex space-x-8 px-6">
						{tabs.map((tab) => {
							const Icon = tab.icon;
							return (
								<button
									type="button"
									key={tab.id}
									onClick={() => setActiveTab(tab.id)}
									className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
										activeTab === tab.id
											? "border-primary-500 text-primary-600 dark:text-primary-400"
											: "border-transparent text-secondary-500 dark:text-secondary-400 hover:text-secondary-700 dark:hover:text-secondary-300 hover:border-secondary-300 dark:hover:border-secondary-500"
									}`}
								>
									<Icon className="h-4 w-4 mr-2" />
									{tab.name}
								</button>
							);
						})}
					</nav>
				</div>

				<div className="p-6">
					{/* Success/Error Message */}
					{message.text && (
						<div
							className={`mb-6 rounded-md p-4 ${
								message.type === "success"
									? "bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700"
									: "bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700"
							}`}
						>
							<div className="flex">
								{message.type === "success" ? (
									<CheckCircle className="h-5 w-5 text-green-400 dark:text-green-300" />
								) : (
									<AlertCircle className="h-5 w-5 text-red-400 dark:text-red-300" />
								)}
								<div className="ml-3">
									<p
										className={`text-sm font-medium ${
											message.type === "success"
												? "text-green-800 dark:text-green-200"
												: "text-red-800 dark:text-red-200"
										}`}
									>
										{message.text}
									</p>
								</div>
							</div>
						</div>
					)}

					{/* Profile Information Tab */}
					{activeTab === "profile" && (
						<form onSubmit={handleProfileSubmit} className="space-y-6">
							<div>
								<h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-4">
									Profile Information
								</h3>
								<div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
									<div>
										<label
											htmlFor={usernameId}
											className="block text-sm font-medium text-secondary-700 dark:text-secondary-200"
										>
											Username
										</label>
										<div className="mt-1 relative">
											<input
												type="text"
												name="username"
												id={usernameId}
												value={profileData.username}
												onChange={handleInputChange}
												className="block w-full border-secondary-300 dark:border-secondary-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 pl-10 bg-white dark:bg-secondary-700 text-secondary-900 dark:text-white"
												required
											/>
											<User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-secondary-400 dark:text-secondary-500" />
										</div>
									</div>

									<div>
										<label
											htmlFor={emailId}
											className="block text-sm font-medium text-secondary-700 dark:text-secondary-200"
										>
											Email Address
										</label>
										<div className="mt-1 relative">
											<input
												type="email"
												name="email"
												id={emailId}
												value={profileData.email}
												onChange={handleInputChange}
												className="block w-full border-secondary-300 dark:border-secondary-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 pl-10 bg-white dark:bg-secondary-700 text-secondary-900 dark:text-white"
												required
											/>
											<Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-secondary-400 dark:text-secondary-500" />
										</div>
									</div>

									<div>
										<label
											htmlFor={firstNameId}
											className="block text-sm font-medium text-secondary-700 dark:text-secondary-200"
										>
											First Name
										</label>
										<div className="mt-1">
											<input
												type="text"
												name="first_name"
												id={firstNameId}
												value={profileData.first_name}
												onChange={handleInputChange}
												className="block w-full border-secondary-300 dark:border-secondary-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-secondary-700 text-secondary-900 dark:text-white"
											/>
										</div>
									</div>

									<div>
										<label
											htmlFor={lastNameId}
											className="block text-sm font-medium text-secondary-700 dark:text-secondary-200"
										>
											Last Name
										</label>
										<div className="mt-1">
											<input
												type="text"
												name="last_name"
												id={lastNameId}
												value={profileData.last_name}
												onChange={handleInputChange}
												className="block w-full border-secondary-300 dark:border-secondary-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-secondary-700 text-secondary-900 dark:text-white"
											/>
										</div>
									</div>
								</div>
							</div>

							{/* Theme Settings */}
							<div className="border-t border-secondary-200 dark:border-secondary-600 pt-6">
								<h4 className="text-sm font-medium text-secondary-700 dark:text-secondary-200 mb-3">
									Appearance
								</h4>
								<div className="max-w-md">
									<div className="flex items-center justify-between">
										<div className="flex items-center space-x-3">
											<div className="flex-shrink-0">
												{isDark ? (
													<Moon className="h-5 w-5 text-secondary-600 dark:text-secondary-400" />
												) : (
													<Sun className="h-5 w-5 text-secondary-600 dark:text-secondary-400" />
												)}
											</div>
											<div>
												<p className="text-sm font-medium text-secondary-900 dark:text-white">
													{isDark ? "Dark Mode" : "Light Mode"}
												</p>
												<p className="text-xs text-secondary-500 dark:text-secondary-400">
													{isDark
														? "Switch to light mode"
														: "Switch to dark mode"}
												</p>
											</div>
										</div>
										<button
											type="button"
											onClick={toggleTheme}
											className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
												isDark ? "bg-primary-600" : "bg-secondary-200"
											}`}
											role="switch"
											aria-checked={isDark}
										>
											<span
												aria-hidden="true"
												className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
													isDark ? "translate-x-5" : "translate-x-0"
												}`}
											/>
										</button>
									</div>
								</div>
							</div>

							<div className="flex justify-end">
								<button
									type="submit"
									disabled={isLoading}
									className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
								>
									<Save className="h-4 w-4 mr-2" />
									{isLoading ? "Saving..." : "Save Changes"}
								</button>
							</div>
						</form>
					)}

					{/* Change Password Tab */}
					{activeTab === "password" && (
						<form onSubmit={handlePasswordSubmit} className="space-y-6">
							<div>
								<h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-4">
									Change Password
								</h3>
								<div className="space-y-4">
									<div>
										<label
											htmlFor={currentPasswordId}
											className="block text-sm font-medium text-secondary-700 dark:text-secondary-200"
										>
											Current Password
										</label>
										<div className="mt-1 relative">
											<input
												type={showPasswords.current ? "text" : "password"}
												name="currentPassword"
												id={currentPasswordId}
												value={passwordData.currentPassword}
												onChange={handleInputChange}
												className="block w-full border-secondary-300 dark:border-secondary-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 pl-10 pr-10 bg-white dark:bg-secondary-700 text-secondary-900 dark:text-white"
												required
											/>
											<Key className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-secondary-400 dark:text-secondary-500" />
											<button
												type="button"
												onClick={() => togglePasswordVisibility("current")}
												className="absolute right-3 top-1/2 transform -translate-y-1/2 text-secondary-400 dark:text-secondary-500 hover:text-secondary-600 dark:hover:text-secondary-300"
											>
												{showPasswords.current ? (
													<EyeOff className="h-4 w-4" />
												) : (
													<Eye className="h-4 w-4" />
												)}
											</button>
										</div>
									</div>

									<div>
										<label
											htmlFor={newPasswordId}
											className="block text-sm font-medium text-secondary-700 dark:text-secondary-200"
										>
											New Password
										</label>
										<div className="mt-1 relative">
											<input
												type={showPasswords.new ? "text" : "password"}
												name="newPassword"
												id={newPasswordId}
												value={passwordData.newPassword}
												onChange={handleInputChange}
												className="block w-full border-secondary-300 dark:border-secondary-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 pl-10 pr-10 bg-white dark:bg-secondary-700 text-secondary-900 dark:text-white"
												required
												minLength="6"
											/>
											<Key className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-secondary-400 dark:text-secondary-500" />
											<button
												type="button"
												onClick={() => togglePasswordVisibility("new")}
												className="absolute right-3 top-1/2 transform -translate-y-1/2 text-secondary-400 dark:text-secondary-500 hover:text-secondary-600 dark:hover:text-secondary-300"
											>
												{showPasswords.new ? (
													<EyeOff className="h-4 w-4" />
												) : (
													<Eye className="h-4 w-4" />
												)}
											</button>
										</div>
										<p className="mt-1 text-xs text-secondary-500 dark:text-secondary-400">
											Must be at least 6 characters long
										</p>
									</div>

									<div>
										<label
											htmlFor={confirmPasswordId}
											className="block text-sm font-medium text-secondary-700 dark:text-secondary-200"
										>
											Confirm New Password
										</label>
										<div className="mt-1 relative">
											<input
												type={showPasswords.confirm ? "text" : "password"}
												name="confirmPassword"
												id={confirmPasswordId}
												value={passwordData.confirmPassword}
												onChange={handleInputChange}
												className="block w-full border-secondary-300 dark:border-secondary-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 pl-10 pr-10 bg-white dark:bg-secondary-700 text-secondary-900 dark:text-white"
												required
												minLength="6"
											/>
											<Key className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-secondary-400 dark:text-secondary-500" />
											<button
												type="button"
												onClick={() => togglePasswordVisibility("confirm")}
												className="absolute right-3 top-1/2 transform -translate-y-1/2 text-secondary-400 dark:text-secondary-500 hover:text-secondary-600 dark:hover:text-secondary-300"
											>
												{showPasswords.confirm ? (
													<EyeOff className="h-4 w-4" />
												) : (
													<Eye className="h-4 w-4" />
												)}
											</button>
										</div>
									</div>
								</div>
							</div>

							<div className="flex justify-end">
								<button
									type="submit"
									disabled={isLoading}
									className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
								>
									<Key className="h-4 w-4 mr-2" />
									{isLoading ? "Changing..." : "Change Password"}
								</button>
							</div>
						</form>
					)}

					{/* Multi-Factor Authentication Tab */}
					{activeTab === "tfa" && <TfaTab />}
				</div>
			</div>
		</div>
	);
};

// TFA Tab Component
const TfaTab = () => {
	const verificationTokenId = useId();
	const [setupStep, setSetupStep] = useState("status"); // 'status', 'setup', 'verify', 'backup-codes'
	const [verificationToken, setVerificationToken] = useState("");
	const [password, setPassword] = useState("");
	const [backupCodes, setBackupCodes] = useState([]);
	const [message, setMessage] = useState({ type: "", text: "" });
	const queryClient = useQueryClient();

	// Fetch TFA status
	const { data: tfaStatus, isLoading: statusLoading } = useQuery({
		queryKey: ["tfaStatus"],
		queryFn: () => tfaAPI.status().then((res) => res.data),
	});

	// Setup TFA mutation
	const setupMutation = useMutation({
		mutationFn: () => tfaAPI.setup().then((res) => res.data),
		onSuccess: () => {
			setSetupStep("setup");
			setMessage({
				type: "info",
				text: "Scan the QR code with your authenticator app and enter the verification code below.",
			});
		},
		onError: (error) => {
			setMessage({
				type: "error",
				text: error.response?.data?.error || "Failed to setup TFA",
			});
		},
	});

	// Verify setup mutation
	const verifyMutation = useMutation({
		mutationFn: (data) => tfaAPI.verifySetup(data).then((res) => res.data),
		onSuccess: (data) => {
			setBackupCodes(data.backupCodes);
			setSetupStep("backup-codes");
			setMessage({
				type: "success",
				text: "Two-factor authentication has been enabled successfully!",
			});
		},
		onError: (error) => {
			setMessage({
				type: "error",
				text: error.response?.data?.error || "Failed to verify TFA setup",
			});
		},
	});

	// Disable TFA mutation
	const disableMutation = useMutation({
		mutationFn: (data) => tfaAPI.disable(data).then((res) => res.data),
		onSuccess: () => {
			queryClient.invalidateQueries(["tfaStatus"]);
			setSetupStep("status");
			setMessage({
				type: "success",
				text: "Two-factor authentication has been disabled successfully!",
			});
		},
		onError: (error) => {
			setMessage({
				type: "error",
				text: error.response?.data?.error || "Failed to disable TFA",
			});
		},
	});

	// Regenerate backup codes mutation
	const regenerateBackupCodesMutation = useMutation({
		mutationFn: () => tfaAPI.regenerateBackupCodes().then((res) => res.data),
		onSuccess: (data) => {
			setBackupCodes(data.backupCodes);
			setMessage({
				type: "success",
				text: "Backup codes have been regenerated successfully!",
			});
		},
		onError: (error) => {
			setMessage({
				type: "error",
				text:
					error.response?.data?.error || "Failed to regenerate backup codes",
			});
		},
	});

	const handleSetup = () => {
		setupMutation.mutate();
	};

	const handleVerify = (e) => {
		e.preventDefault();
		if (verificationToken.length !== 6) {
			setMessage({
				type: "error",
				text: "Please enter a 6-digit verification code",
			});
			return;
		}
		verifyMutation.mutate({ token: verificationToken });
	};

	const handleDisable = (e) => {
		e.preventDefault();
		if (!password) {
			setMessage({
				type: "error",
				text: "Please enter your password to disable TFA",
			});
			return;
		}
		disableMutation.mutate({ password });
	};

	const handleRegenerateBackupCodes = () => {
		regenerateBackupCodesMutation.mutate();
	};

	const copyToClipboard = async (text) => {
		try {
			// Try modern clipboard API first
			if (navigator.clipboard && window.isSecureContext) {
				await navigator.clipboard.writeText(text);
				setMessage({ type: "success", text: "Copied to clipboard!" });
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
				if (successful) {
					setMessage({ type: "success", text: "Copied to clipboard!" });
				} else {
					throw new Error("Copy command failed");
				}
			} catch {
				// If all else fails, show the text in a prompt
				prompt("Copy this text:", text);
				setMessage({
					type: "info",
					text: "Text shown in prompt for manual copying",
				});
			} finally {
				document.body.removeChild(textArea);
			}
		} catch (err) {
			console.error("Failed to copy to clipboard:", err);
			// Show the text in a prompt as last resort
			prompt("Copy this text:", text);
			setMessage({
				type: "info",
				text: "Text shown in prompt for manual copying",
			});
		}
	};

	const downloadBackupCodes = () => {
		const content = `PatchMon Backup Codes\n\n${backupCodes.map((code, index) => `${index + 1}. ${code}`).join("\n")}\n\nKeep these codes safe! Each code can only be used once.`;
		const blob = new Blob([content], { type: "text/plain" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "patchmon-backup-codes.txt";
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	};

	if (statusLoading) {
		return (
			<div className="flex items-center justify-center h-64">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div>
				<h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-4">
					Multi-Factor Authentication
				</h3>
				<p className="text-sm text-secondary-600 dark:text-secondary-300 mb-6">
					Add an extra layer of security to your account by enabling two-factor
					authentication.
				</p>
			</div>

			{/* Status Message */}
			{message.text && (
				<div
					className={`rounded-md p-4 ${
						message.type === "success"
							? "bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700"
							: message.type === "error"
								? "bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700"
								: "bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700"
					}`}
				>
					<div className="flex">
						{message.type === "success" ? (
							<CheckCircle className="h-5 w-5 text-green-400 dark:text-green-300" />
						) : message.type === "error" ? (
							<AlertCircle className="h-5 w-5 text-red-400 dark:text-red-300" />
						) : (
							<AlertCircle className="h-5 w-5 text-blue-400 dark:text-blue-300" />
						)}
						<div className="ml-3">
							<p
								className={`text-sm font-medium ${
									message.type === "success"
										? "text-green-800 dark:text-green-200"
										: message.type === "error"
											? "text-red-800 dark:text-red-200"
											: "text-blue-800 dark:text-blue-200"
								}`}
							>
								{message.text}
							</p>
						</div>
					</div>
				</div>
			)}

			{/* TFA Status */}
			{setupStep === "status" && (
				<div className="space-y-6">
					<div className="bg-white dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-600 rounded-lg p-6">
						<div className="flex items-center justify-between">
							<div className="flex items-center space-x-3">
								<div
									className={`p-2 rounded-full ${tfaStatus?.enabled ? "bg-green-100 dark:bg-green-900" : "bg-secondary-100 dark:bg-secondary-700"}`}
								>
									<Smartphone
										className={`h-6 w-6 ${tfaStatus?.enabled ? "text-green-600 dark:text-green-400" : "text-secondary-600 dark:text-secondary-400"}`}
									/>
								</div>
								<div>
									<h4 className="text-lg font-medium text-secondary-900 dark:text-white">
										{tfaStatus?.enabled
											? "Two-Factor Authentication Enabled"
											: "Two-Factor Authentication Disabled"}
									</h4>
									<p className="text-sm text-secondary-600 dark:text-secondary-300">
										{tfaStatus?.enabled
											? "Your account is protected with two-factor authentication."
											: "Add an extra layer of security to your account."}
									</p>
								</div>
							</div>
							<div>
								{tfaStatus?.enabled ? (
									<button
										type="button"
										onClick={() => setSetupStep("disable")}
										className="btn-outline text-danger-600 border-danger-300 hover:bg-danger-50"
									>
										<Trash2 className="h-4 w-4 mr-2" />
										Disable TFA
									</button>
								) : (
									<button
										type="button"
										onClick={handleSetup}
										disabled={setupMutation.isPending}
										className="btn-primary"
									>
										<Smartphone className="h-4 w-4 mr-2" />
										{setupMutation.isPending ? "Setting up..." : "Enable TFA"}
									</button>
								)}
							</div>
						</div>
					</div>

					{tfaStatus?.enabled && (
						<div className="bg-white dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-600 rounded-lg p-6">
							<h4 className="text-lg font-medium text-secondary-900 dark:text-white mb-4">
								Backup Codes
							</h4>
							<p className="text-sm text-secondary-600 dark:text-secondary-300 mb-4">
								Use these backup codes to access your account if you lose your
								authenticator device.
							</p>
							<button
								type="button"
								onClick={handleRegenerateBackupCodes}
								disabled={regenerateBackupCodesMutation.isPending}
								className="btn-outline"
							>
								<RefreshCw
									className={`h-4 w-4 mr-2 ${regenerateBackupCodesMutation.isPending ? "animate-spin" : ""}`}
								/>
								{regenerateBackupCodesMutation.isPending
									? "Regenerating..."
									: "Regenerate Codes"}
							</button>
						</div>
					)}
				</div>
			)}

			{/* TFA Setup */}
			{setupStep === "setup" && setupMutation.data && (
				<div className="space-y-6">
					<div className="bg-white dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-600 rounded-lg p-6">
						<h4 className="text-lg font-medium text-secondary-900 dark:text-white mb-4">
							Setup Two-Factor Authentication
						</h4>
						<div className="space-y-4">
							<div className="text-center">
								<img
									src={setupMutation.data.qrCode}
									alt="QR Code"
									className="mx-auto h-48 w-48 border border-secondary-200 dark:border-secondary-600 rounded-lg"
								/>
								<p className="text-sm text-secondary-600 dark:text-secondary-300 mt-2">
									Scan this QR code with your authenticator app
								</p>
							</div>

							<div className="bg-secondary-50 dark:bg-secondary-700 p-4 rounded-lg">
								<p className="text-sm font-medium text-secondary-900 dark:text-white mb-2">
									Manual Entry Key:
								</p>
								<div className="flex items-center space-x-2">
									<code className="flex-1 bg-white dark:bg-secondary-800 px-3 py-2 rounded border text-sm font-mono">
										{setupMutation.data.manualEntryKey}
									</code>
									<button
										type="button"
										onClick={() =>
											copyToClipboard(setupMutation.data.manualEntryKey)
										}
										className="p-2 text-secondary-400 hover:text-secondary-600 dark:hover:text-secondary-300"
										title="Copy to clipboard"
									>
										<Copy className="h-4 w-4" />
									</button>
								</div>
							</div>

							<div className="text-center">
								<button
									type="button"
									onClick={() => setSetupStep("verify")}
									className="btn-primary"
								>
									Continue to Verification
								</button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* TFA Verification */}
			{setupStep === "verify" && (
				<div className="space-y-6">
					<div className="bg-white dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-600 rounded-lg p-6">
						<h4 className="text-lg font-medium text-secondary-900 dark:text-white mb-4">
							Verify Setup
						</h4>
						<p className="text-sm text-secondary-600 dark:text-secondary-300 mb-4">
							Enter the 6-digit code from your authenticator app to complete the
							setup.
						</p>
						<form onSubmit={handleVerify} className="space-y-4">
							<div>
								<label
									htmlFor={verificationTokenId}
									className="block text-sm font-medium text-secondary-700 dark:text-secondary-200 mb-1"
								>
									Verification Code
								</label>
								<input
									id={verificationTokenId}
									type="text"
									value={verificationToken}
									onChange={(e) =>
										setVerificationToken(
											e.target.value.replace(/\D/g, "").slice(0, 6),
										)
									}
									placeholder="000000"
									className="w-full px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-secondary-700 text-secondary-900 dark:text-white text-center text-lg font-mono tracking-widest"
									maxLength="6"
									required
								/>
							</div>
							<div className="flex space-x-3">
								<button
									type="submit"
									disabled={
										verifyMutation.isPending || verificationToken.length !== 6
									}
									className="btn-primary"
								>
									{verifyMutation.isPending
										? "Verifying..."
										: "Verify & Enable"}
								</button>
								<button
									type="button"
									onClick={() => setSetupStep("status")}
									className="btn-outline"
								>
									Cancel
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{/* Backup Codes */}
			{setupStep === "backup-codes" && backupCodes.length > 0 && (
				<div className="space-y-6">
					<div className="bg-white dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-600 rounded-lg p-6">
						<h4 className="text-lg font-medium text-secondary-900 dark:text-white mb-4">
							Backup Codes
						</h4>
						<p className="text-sm text-secondary-600 dark:text-secondary-300 mb-4">
							Save these backup codes in a safe place. Each code can only be
							used once.
						</p>
						<div className="bg-secondary-50 dark:bg-secondary-700 p-4 rounded-lg mb-4">
							<div className="grid grid-cols-2 gap-2 font-mono text-sm">
								{backupCodes.map((code, index) => (
									<div
										key={code}
										className="flex items-center justify-between py-1"
									>
										<span className="text-secondary-600 dark:text-secondary-400">
											{index + 1}.
										</span>
										<span className="text-secondary-900 dark:text-white">
											{code}
										</span>
									</div>
								))}
							</div>
						</div>
						<div className="flex space-x-3">
							<button
								type="button"
								onClick={downloadBackupCodes}
								className="btn-outline"
							>
								<Download className="h-4 w-4 mr-2" />
								Download Codes
							</button>
							<button
								type="button"
								onClick={() => {
									setSetupStep("status");
									queryClient.invalidateQueries(["tfaStatus"]);
								}}
								className="btn-primary"
							>
								Done
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Disable TFA */}
			{setupStep === "disable" && (
				<div className="space-y-6">
					<div className="bg-white dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-600 rounded-lg p-6">
						<h4 className="text-lg font-medium text-secondary-900 dark:text-white mb-4">
							Disable Two-Factor Authentication
						</h4>
						<p className="text-sm text-secondary-600 dark:text-secondary-300 mb-4">
							Enter your password to disable two-factor authentication.
						</p>
						<form onSubmit={handleDisable} className="space-y-4">
							<div>
								<label
									htmlFor={disablePasswordId}
									className="block text-sm font-medium text-secondary-700 dark:text-secondary-200 mb-1"
								>
									Password
								</label>
								<input
									id={disablePasswordId}
									type="password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									className="w-full px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-secondary-700 text-secondary-900 dark:text-white"
									required
								/>
							</div>
							<div className="flex space-x-3">
								<button
									type="submit"
									disabled={disableMutation.isPending || !password}
									className="btn-danger"
								>
									{disableMutation.isPending ? "Disabling..." : "Disable TFA"}
								</button>
								<button
									type="button"
									onClick={() => setSetupStep("status")}
									className="btn-outline"
								>
									Cancel
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
};

export default Profile;
