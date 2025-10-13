const { PrismaClient } = require("@prisma/client");

async function reconcileMigrations() {
	const prisma = new PrismaClient();

	try {
		console.log(
			"[Migration Reconciliation] Checking for migration name conflicts...",
		);

		// Check if the old migration name exists
		const oldMigration = await prisma.$queryRawUnsafe(
			"SELECT migration_name FROM _prisma_migrations WHERE migration_name = 'add_user_sessions'",
		);

		if (oldMigration && oldMigration.length > 0) {
			console.log(
				'[Migration Reconciliation] Found old migration name "add_user_sessions"',
			);
			console.log(
				'[Migration Reconciliation] Updating to "20251005000000_add_user_sessions"...',
			);

			// Update the migration name to the new timestamped version
			await prisma.$executeRawUnsafe(`
        UPDATE _prisma_migrations 
        SET migration_name = '20251005000000_add_user_sessions'
        WHERE migration_name = 'add_user_sessions'
      `);

			console.log(
				"[Migration Reconciliation] ✅ Migration name updated successfully",
			);
		} else {
			console.log(
				"[Migration Reconciliation] No migration reconciliation needed",
			);
		}
	} catch (error) {
		// If _prisma_migrations table doesn't exist yet, that's okay (fresh install)
		if (error.code === "42P01") {
			console.log(
				"[Migration Reconciliation] Fresh database detected, skipping reconciliation",
			);
		} else {
			console.error(
				"[Migration Reconciliation] Error during migration reconciliation:",
				error.message,
			);
			throw error;
		}
	} finally {
		await prisma.$disconnect();
	}
}

// Run if called directly
if (require.main === module) {
	reconcileMigrations()
		.then(() => process.exit(0))
		.catch((error) => {
			console.error(error);
			process.exit(1);
		});
}

module.exports = reconcileMigrations;
