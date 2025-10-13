-- Reconcile user_sessions migration from 1.2.7 to 1.2.8+
-- This migration handles the case where 1.2.7 had 'add_user_sessions' without timestamp
-- and 1.2.8+ renamed it to '20251005000000_add_user_sessions' with timestamp

DO $$
DECLARE
    old_migration_exists boolean := false;
    table_exists boolean := false;
    failed_migration_exists boolean := false;
    new_migration_exists boolean := false;
BEGIN
    -- Check if the old migration name exists
    SELECT EXISTS (
        SELECT 1 FROM _prisma_migrations 
        WHERE migration_name = 'add_user_sessions'
    ) INTO old_migration_exists;
    
    -- Check if user_sessions table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_sessions'
    ) INTO table_exists;
    
    -- Check if there's a failed migration attempt
    SELECT EXISTS (
        SELECT 1 FROM _prisma_migrations 
        WHERE migration_name = '20251005000000_add_user_sessions' 
        AND finished_at IS NULL
    ) INTO failed_migration_exists;
    
    -- Check if the new migration already exists and is successful
    SELECT EXISTS (
        SELECT 1 FROM _prisma_migrations 
        WHERE migration_name = '20251005000000_add_user_sessions' 
        AND finished_at IS NOT NULL
    ) INTO new_migration_exists;
    
    -- FIRST: Handle failed migration (must be marked as rolled back)
    IF failed_migration_exists THEN
        RAISE NOTICE 'Found failed migration attempt - marking as rolled back';
        
        -- Mark the failed migration as rolled back (required by Prisma)
        UPDATE _prisma_migrations 
        SET rolled_back_at = NOW()
        WHERE migration_name = '20251005000000_add_user_sessions' 
        AND finished_at IS NULL;
        
        RAISE NOTICE 'Failed migration marked as rolled back';
        
        -- If table exists, it means the migration partially succeeded
        IF table_exists THEN
            RAISE NOTICE 'Table exists - migration was partially successful, will be handled by next migration';
        ELSE
            RAISE NOTICE 'Table does not exist - migration will retry after rollback';
        END IF;
    END IF;
    
    -- SECOND: Handle old migration name (1.2.7 -> 1.2.8+ upgrade)
    IF old_migration_exists AND table_exists THEN
        RAISE NOTICE 'Found 1.2.7 migration "add_user_sessions" - updating to timestamped version';
        
        -- Update the old migration name to the new timestamped version
        UPDATE _prisma_migrations 
        SET migration_name = '20251005000000_add_user_sessions'
        WHERE migration_name = 'add_user_sessions';
        
        RAISE NOTICE 'Migration name updated: add_user_sessions -> 20251005000000_add_user_sessions';
    END IF;
    
    -- THIRD: Handle case where table exists but no migration record exists (1.2.7 upgrade scenario)
    IF table_exists AND NOT old_migration_exists AND NOT new_migration_exists THEN
        RAISE NOTICE 'Table exists but no migration record found - creating migration record for 1.2.7 upgrade';
        
        -- Insert a successful migration record for the existing table
        INSERT INTO _prisma_migrations (
            id, 
            checksum, 
            finished_at, 
            migration_name, 
            logs, 
            rolled_back_at, 
            started_at, 
            applied_steps_count
        ) VALUES (
            gen_random_uuid()::text,
            '', -- Empty checksum since we're reconciling
            NOW(),
            '20251005000000_add_user_sessions',
            'Reconciled from 1.2.7 - table already exists',
            NULL,
            NOW(),
            1
        );
        
        RAISE NOTICE 'Migration record created for existing table';
    END IF;
    
    -- FOURTH: If we have a rolled back migration and table exists, mark it as applied
    IF failed_migration_exists AND table_exists THEN
        RAISE NOTICE 'Migration was rolled back but table exists - marking as successfully applied';
        
        -- Update the rolled back migration to be successful
        UPDATE _prisma_migrations 
        SET 
            finished_at = NOW(),
            rolled_back_at = NULL,
            logs = 'Reconciled from failed state - table already exists'
        WHERE migration_name = '20251005000000_add_user_sessions';
        
        RAISE NOTICE 'Migration marked as successfully applied';
    END IF;
    
    -- If no issues found
    IF NOT old_migration_exists AND NOT failed_migration_exists AND NOT (table_exists AND NOT new_migration_exists) THEN
        RAISE NOTICE 'No migration reconciliation needed';
    END IF;
    
END $$;
