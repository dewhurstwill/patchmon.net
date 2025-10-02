import { Code, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import SettingsLayout from "../../components/SettingsLayout";
import AgentManagementTab from "../../components/settings/AgentManagementTab";
import AgentUpdatesTab from "../../components/settings/AgentUpdatesTab";

const SettingsAgentConfig = () => {
	const location = useLocation();
	const navigate = useNavigate();
	const [activeTab, setActiveTab] = useState(() => {
		// Set initial tab based on current route
		if (location.pathname === "/settings/agent-version") return "management";
		return "updates";
	});

	// Update active tab when route changes
	useEffect(() => {
		if (location.pathname === "/settings/agent-version") {
			setActiveTab("management");
		} else if (location.pathname === "/settings/agent-config") {
			setActiveTab("updates");
		}
	}, [location.pathname]);

	const tabs = [
		{
			id: "updates",
			name: "Agent Updates",
			icon: Settings,
			href: "/settings/agent-config",
		},
		{
			id: "management",
			name: "Agent Version",
			icon: Code,
			href: "/settings/agent-version",
		},
	];

	const renderTabContent = () => {
		switch (activeTab) {
			case "updates":
				return <AgentUpdatesTab />;
			case "management":
				return <AgentManagementTab />;
			default:
				return <AgentUpdatesTab />;
		}
	};

	return (
		<SettingsLayout>
			<div className="space-y-6">
				{/* Tab Navigation */}
				<div className="border-b border-secondary-200 dark:border-secondary-600">
					<nav className="-mb-px flex space-x-8">
						{tabs.map((tab) => {
							const Icon = tab.icon;
							return (
								<button
									type="button"
									key={tab.id}
									onClick={() => {
										setActiveTab(tab.id);
										navigate(tab.href);
									}}
									className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
										activeTab === tab.id
											? "border-primary-500 text-primary-600 dark:text-primary-400"
											: "border-transparent text-secondary-500 dark:text-secondary-400 hover:text-secondary-700 dark:hover:text-secondary-300 hover:border-secondary-300 dark:hover:border-secondary-500"
									}`}
								>
									<Icon className="h-4 w-4" />
									{tab.name}
								</button>
							);
						})}
					</nav>
				</div>

				{/* Tab Content */}
				<div className="mt-6">{renderTabContent()}</div>
			</div>
		</SettingsLayout>
	);
};

export default SettingsAgentConfig;
