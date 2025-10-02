import { Plug } from "lucide-react";
import SettingsLayout from "../../components/SettingsLayout";

const Integrations = () => {
	return (
		<SettingsLayout>
			<div className="space-y-6">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-bold text-secondary-900 dark:text-white">
							Integrations
						</h1>
						<p className="mt-1 text-sm text-secondary-600 dark:text-secondary-400">
							Connect PatchMon to third-party services
						</p>
					</div>
				</div>

				{/* Coming Soon Card */}
				<div className="bg-white dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-600 rounded-lg p-6">
					<div className="flex items-center gap-4">
						<div className="flex-shrink-0">
							<div className="w-12 h-12 bg-secondary-100 dark:bg-secondary-700 rounded-lg flex items-center justify-center">
								<Plug className="h-6 w-6 text-secondary-700 dark:text-secondary-200" />
							</div>
						</div>
						<div className="flex-1">
							<h3 className="text-lg font-semibold text-secondary-900 dark:text-white">
								Integrations Coming Soon
							</h3>
							<p className="mt-1 text-sm text-secondary-600 dark:text-secondary-400">
								We are building integrations for Slack, Discord, email, and
								webhooks to streamline alerts and workflows.
							</p>
							<div className="mt-3">
								<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary-100 text-secondary-800 dark:bg-secondary-700 dark:text-secondary-200">
									In Development
								</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</SettingsLayout>
	);
};

export default Integrations;
