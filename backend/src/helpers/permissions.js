// Helper function to get user permissions based on role
async function getUserPermissions(userRole) {
	try {
		const permissions = await prisma.role_permissions.findUnique({
			where: { role: userRole },
		});

		// If no specific permissions found, return default admin permissions (for backward compatibility)
		if (!permissions) {
			console.warn(
				`No permissions found for role: ${userRole}, defaulting to admin access`,
			);
			return {
				can_view_dashboard: true,
				can_view_hosts: true,
				can_manage_hosts: true,
				can_view_packages: true,
				can_manage_packages: true,
				can_view_users: true,
				can_manage_users: true,
				can_view_reports: true,
				can_export_data: true,
				can_manage_settings: true,
			};
		}

		return permissions;
	} catch (error) {
		console.error("Error fetching user permissions:", error);
		// Return admin permissions as fallback
		return {
			can_view_dashboard: true,
			can_view_hosts: true,
			can_manage_hosts: true,
			can_view_packages: true,
			can_manage_packages: true,
			can_view_users: true,
			can_manage_users: true,
			can_view_reports: true,
			can_export_data: true,
			can_manage_settings: true,
		};
	}
}

// Helper function to get permission-based dashboard preferences for a role
async function getPermissionBasedPreferences(userRole) {
	// Get user's actual permissions
	const permissions = await getUserPermissions(userRole);

	// Define all possible dashboard cards with their required permissions
	const allCards = [
		// Host-related cards
		{ cardId: "totalHosts", requiredPermission: "can_view_hosts", order: 0 },
		{
			cardId: "hostsNeedingUpdates",
			requiredPermission: "can_view_hosts",
			order: 1,
		},

		// Package-related cards
		{
			cardId: "totalOutdatedPackages",
			requiredPermission: "can_view_packages",
			order: 2,
		},
		{
			cardId: "securityUpdates",
			requiredPermission: "can_view_packages",
			order: 3,
		},

		// Host-related cards (continued)
		{
			cardId: "totalHostGroups",
			requiredPermission: "can_view_hosts",
			order: 4,
		},
		{ cardId: "upToDateHosts", requiredPermission: "can_view_hosts", order: 5 },

		// Repository-related cards
		{ cardId: "totalRepos", requiredPermission: "can_view_hosts", order: 6 }, // Repos are host-related

		// User management cards (admin only)
		{ cardId: "totalUsers", requiredPermission: "can_view_users", order: 7 },

		// System/Report cards
		{
			cardId: "osDistribution",
			requiredPermission: "can_view_reports",
			order: 8,
		},
		{
			cardId: "osDistributionBar",
			requiredPermission: "can_view_reports",
			order: 9,
		},
		{
			cardId: "osDistributionDoughnut",
			requiredPermission: "can_view_reports",
			order: 10,
		},
		{
			cardId: "recentCollection",
			requiredPermission: "can_view_hosts",
			order: 11,
		}, // Collection is host-related
		{
			cardId: "updateStatus",
			requiredPermission: "can_view_reports",
			order: 12,
		},
		{
			cardId: "packagePriority",
			requiredPermission: "can_view_packages",
			order: 13,
		},
		{
			cardId: "packageTrends",
			requiredPermission: "can_view_packages",
			order: 14,
		},
		{ cardId: "recentUsers", requiredPermission: "can_view_users", order: 15 },
		{
			cardId: "quickStats",
			requiredPermission: "can_view_dashboard",
			order: 16,
		},
	];

	// Filter cards based on user's permissions
	const allowedCards = allCards.filter((card) => {
		return permissions[card.requiredPermission] === true;
	});

	return allowedCards.map((card) => ({
		cardId: card.cardId,
		enabled: true,
		order: card.order, // Preserve original order from allCards
	}));
}

module.exports = {
	getPermissionBasedPreferences,
	getUserPermissions,
};
