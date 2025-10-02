import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, Code, Download, Plus, Shield, X } from "lucide-react";
import { useId, useState } from "react";
import { agentFileAPI, settingsAPI } from "../../utils/api";

const AgentManagementTab = () => {
	const scriptFileId = useId();
	const scriptContentId = useId();
	const [showUploadModal, setShowUploadModal] = useState(false);

	// Agent file queries and mutations
	const {
		data: agentFileInfo,
		isLoading: agentFileLoading,
		error: agentFileError,
		refetch: refetchAgentFile,
	} = useQuery({
		queryKey: ["agentFile"],
		queryFn: () => agentFileAPI.getInfo().then((res) => res.data),
	});

	// Fetch settings for dynamic curl flags
	const { data: settings } = useQuery({
		queryKey: ["settings"],
		queryFn: () => settingsAPI.get().then((res) => res.data),
	});

	// Helper function to get curl flags based on settings
	const getCurlFlags = () => {
		return settings?.ignore_ssl_self_signed ? "-sk" : "-s";
	};

	const uploadAgentMutation = useMutation({
		mutationFn: (scriptContent) =>
			agentFileAPI.upload(scriptContent).then((res) => res.data),
		onSuccess: () => {
			refetchAgentFile();
			setShowUploadModal(false);
		},
		onError: (error) => {
			console.error("Upload agent error:", error);
		},
	});

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between mb-6">
				<div>
					<div className="flex items-center mb-2">
						<Code className="h-6 w-6 text-primary-600 mr-3" />
						<h2 className="text-xl font-semibold text-secondary-900 dark:text-white">
							Agent File Management
						</h2>
					</div>
					<p className="text-sm text-secondary-500 dark:text-secondary-300">
						Manage the PatchMon agent script file used for installations and
						updates
					</p>
				</div>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => {
							const url = "/api/v1/hosts/agent/download";
							const link = document.createElement("a");
							link.href = url;
							link.download = "patchmon-agent.sh";
							document.body.appendChild(link);
							link.click();
							document.body.removeChild(link);
						}}
						className="btn-outline flex items-center gap-2"
					>
						<Download className="h-4 w-4" />
						Download
					</button>
					<button
						type="button"
						onClick={() => setShowUploadModal(true)}
						className="btn-primary flex items-center gap-2"
					>
						<Plus className="h-4 w-4" />
						Replace Script
					</button>
				</div>
			</div>

			{/* Content */}
			{agentFileLoading ? (
				<div className="flex items-center justify-center py-8">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
				</div>
			) : agentFileError ? (
				<div className="text-center py-8">
					<p className="text-red-600 dark:text-red-400">
						Error loading agent file: {agentFileError.message}
					</p>
				</div>
			) : !agentFileInfo?.exists ? (
				<div className="text-center py-8">
					<Code className="h-12 w-12 text-secondary-400 mx-auto mb-4" />
					<p className="text-secondary-500 dark:text-secondary-300">
						No agent script found
					</p>
					<p className="text-sm text-secondary-400 dark:text-secondary-400 mt-2">
						Upload an agent script to get started
					</p>
				</div>
			) : (
				<div className="space-y-6">
					{/* Agent File Info */}
					<div className="bg-secondary-50 dark:bg-secondary-700 rounded-lg p-6">
						<h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-4">
							Current Agent Script
						</h3>
						<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
							<div className="flex items-center gap-2">
								<Code className="h-4 w-4 text-blue-600 dark:text-blue-400" />
								<span className="text-sm font-medium text-secondary-700 dark:text-secondary-300">
									Version:
								</span>
								<span className="text-sm text-secondary-900 dark:text-white font-mono">
									{agentFileInfo.version}
								</span>
							</div>
							<div className="flex items-center gap-2">
								<Download className="h-4 w-4 text-green-600 dark:text-green-400" />
								<span className="text-sm font-medium text-secondary-700 dark:text-secondary-300">
									Size:
								</span>
								<span className="text-sm text-secondary-900 dark:text-white">
									{agentFileInfo.sizeFormatted}
								</span>
							</div>
							<div className="flex items-center gap-2">
								<Code className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
								<span className="text-sm font-medium text-secondary-700 dark:text-secondary-300">
									Modified:
								</span>
								<span className="text-sm text-secondary-900 dark:text-white">
									{new Date(agentFileInfo.lastModified).toLocaleDateString()}
								</span>
							</div>
						</div>
					</div>

					{/* Usage Instructions */}
					<div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-md p-4">
						<div className="flex">
							<Shield className="h-5 w-5 text-blue-400 dark:text-blue-300" />
							<div className="ml-3">
								<h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
									Agent Script Usage
								</h3>
								<div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
									<p className="mb-2">This script is used for:</p>
									<ul className="list-disc list-inside space-y-1">
										<li>New agent installations via the install script</li>
										<li>
											Agent downloads from the /api/v1/hosts/agent/download
											endpoint
										</li>
										<li>Manual agent deployments and updates</li>
									</ul>
								</div>
							</div>
						</div>
					</div>

					{/* Uninstall Instructions */}
					<div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-md p-4">
						<div className="flex">
							<Shield className="h-5 w-5 text-red-400 dark:text-red-300" />
							<div className="ml-3">
								<h3 className="text-sm font-medium text-red-800 dark:text-red-200">
									Agent Uninstall Command
								</h3>
								<div className="mt-2 text-sm text-red-700 dark:text-red-300">
									<p className="mb-2">
										To completely remove PatchMon from a host:
									</p>
									<div className="flex items-center gap-2">
										<div className="bg-red-100 dark:bg-red-800 rounded p-2 font-mono text-xs flex-1">
											curl {getCurlFlags()} {window.location.origin}
											/api/v1/hosts/remove | sudo bash
										</div>
										<button
											type="button"
											onClick={() => {
												const command = `curl ${getCurlFlags()} ${window.location.origin}/api/v1/hosts/remove | sudo bash`;
												navigator.clipboard.writeText(command);
												// You could add a toast notification here
											}}
											className="px-2 py-1 bg-red-200 dark:bg-red-700 text-red-800 dark:text-red-200 rounded text-xs hover:bg-red-300 dark:hover:bg-red-600 transition-colors"
										>
											Copy
										</button>
									</div>
									<p className="mt-2 text-xs">
										⚠️ This will remove all PatchMon files, configuration, and
										crontab entries
									</p>
								</div>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Agent Upload Modal */}
			{showUploadModal && (
				<AgentUploadModal
					isOpen={showUploadModal}
					onClose={() => setShowUploadModal(false)}
					onSubmit={uploadAgentMutation.mutate}
					isLoading={uploadAgentMutation.isPending}
					error={uploadAgentMutation.error}
					scriptFileId={scriptFileId}
					scriptContentId={scriptContentId}
				/>
			)}
		</div>
	);
};

// Agent Upload Modal Component
const AgentUploadModal = ({
	isOpen,
	onClose,
	onSubmit,
	isLoading,
	error,
	scriptFileId,
	scriptContentId,
}) => {
	const [scriptContent, setScriptContent] = useState("");
	const [uploadError, setUploadError] = useState("");

	const handleSubmit = (e) => {
		e.preventDefault();
		setUploadError("");

		if (!scriptContent.trim()) {
			setUploadError("Script content is required");
			return;
		}

		if (!scriptContent.trim().startsWith("#!/")) {
			setUploadError(
				"Script must start with a shebang (#!/bin/bash or #!/bin/sh)",
			);
			return;
		}

		onSubmit(scriptContent);
	};

	const handleFileUpload = (e) => {
		const file = e.target.files[0];
		if (file) {
			const reader = new FileReader();
			reader.onload = (event) => {
				setScriptContent(event.target.result);
				setUploadError("");
			};
			reader.readAsText(file);
		}
	};

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
			<div className="bg-white dark:bg-secondary-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
				<div className="px-6 py-4 border-b border-secondary-200 dark:border-secondary-600">
					<div className="flex items-center justify-between">
						<h3 className="text-lg font-medium text-secondary-900 dark:text-white">
							Replace Agent Script
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

				<form onSubmit={handleSubmit} className="px-6 py-4">
					<div className="space-y-4">
						<div>
							<label
								htmlFor={scriptFileId}
								className="block text-sm font-medium text-secondary-700 dark:text-secondary-200 mb-2"
							>
								Upload Script File
							</label>
							<input
								id={scriptFileId}
								type="file"
								accept=".sh"
								onChange={handleFileUpload}
								className="block w-full text-sm text-secondary-500 dark:text-secondary-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 dark:file:bg-primary-900 dark:file:text-primary-200"
							/>
							<p className="mt-1 text-xs text-secondary-500 dark:text-secondary-400">
								Select a .sh file to upload, or paste the script content below
							</p>
						</div>

						<div>
							<label
								htmlFor={scriptContentId}
								className="block text-sm font-medium text-secondary-700 dark:text-secondary-200 mb-2"
							>
								Script Content *
							</label>
							<textarea
								id={scriptContentId}
								value={scriptContent}
								onChange={(e) => {
									setScriptContent(e.target.value);
									setUploadError("");
								}}
								rows={15}
								className="block w-full border border-secondary-300 dark:border-secondary-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-secondary-700 text-secondary-900 dark:text-white font-mono text-sm"
								placeholder="#!/bin/bash&#10;&#10;# PatchMon Agent Script&#10;VERSION=&quot;1.0.0&quot;&#10;&#10;# Your script content here..."
							/>
						</div>

						{(uploadError || error) && (
							<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
								<p className="text-sm text-red-800 dark:text-red-200">
									{uploadError ||
										error?.response?.data?.error ||
										error?.message}
								</p>
							</div>
						)}

						<div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3">
							<div className="flex">
								<AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mr-2 mt-0.5" />
								<div className="text-sm text-yellow-800 dark:text-yellow-200">
									<p className="font-medium">Important:</p>
									<ul className="mt-1 list-disc list-inside space-y-1">
										<li>This will replace the current agent script file</li>
										<li>A backup will be created automatically</li>
										<li>All new installations will use this script</li>
										<li>
											Existing agents will download this version on their next
											update
										</li>
									</ul>
								</div>
							</div>
						</div>
					</div>

					<div className="flex justify-end gap-3 mt-6">
						<button type="button" onClick={onClose} className="btn-outline">
							Cancel
						</button>
						<button
							type="submit"
							disabled={isLoading || !scriptContent.trim()}
							className="btn-primary"
						>
							{isLoading ? "Uploading..." : "Replace Script"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
};

export default AgentManagementTab;
