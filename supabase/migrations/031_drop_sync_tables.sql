-- Migration 031: Drop legacy cloud-sync tables
-- Run AFTER verifying that all extension installs have migrated to local-only storage
-- and no data is being written to these tables.
--
-- IMPORTANT: Run this migration only after:
--   1. New extension version (with sync removed) has been published and adopted
--   2. You have confirmed no recent writes to these tables (check updated_at columns)

DROP TABLE IF EXISTS sessions               CASCADE;
DROP TABLE IF EXISTS prompts                CASCADE;
DROP TABLE IF EXISTS prompt_folders         CASCADE;
DROP TABLE IF EXISTS tracked_subscriptions  CASCADE;
DROP TABLE IF EXISTS tab_group_templates    CASCADE;
DROP TABLE IF EXISTS bookmark_folders       CASCADE;
DROP TABLE IF EXISTS bookmark_entries       CASCADE;
DROP TABLE IF EXISTS dashboard_configs      CASCADE;
DROP TABLE IF EXISTS dashboard_sync_log     CASCADE;

-- Drop obsolete quota/usage RPCs that referenced synced entity counts
DROP FUNCTION IF EXISTS get_user_quota(UUID);
DROP FUNCTION IF EXISTS get_user_usage(UUID);
DROP FUNCTION IF EXISTS can_add_tracked_subscription(UUID);

-- Remove old quota columns from plans (replaced by daily/monthly action limits)
ALTER TABLE plans
  DROP COLUMN IF EXISTS sessions_limit,
  DROP COLUMN IF EXISTS prompts_limit,
  DROP COLUMN IF EXISTS subscriptions_limit,
  DROP COLUMN IF EXISTS tab_groups_synced_limit,
  DROP COLUMN IF EXISTS total_tabs_limit,
  DROP COLUMN IF EXISTS bookmark_entries_limit,
  DROP COLUMN IF EXISTS bookmark_folders_limit;
