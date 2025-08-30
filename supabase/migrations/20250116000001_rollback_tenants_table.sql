-- Rollback migration for tenants table
-- This migration undoes all changes from 20250116000000_create_tenants_table.sql and 20250116000002_backfill_existing_data_tenant_ids.sql

-- Drop triggers first
DROP TRIGGER IF EXISTS set_tenant_id_board_templates ON public.board_templates;
DROP TRIGGER IF EXISTS set_tenant_id_retro_boards ON public.retro_boards;
DROP TRIGGER IF EXISTS set_tenant_id_profiles ON public.profiles;
DROP TRIGGER IF EXISTS set_tenant_id_teams ON public.teams;

-- Drop functions
DROP FUNCTION IF EXISTS public.set_tenant_id();
DROP FUNCTION IF EXISTS public.get_current_tenant_id();

-- Revert RLS policies to original state (without tenant filtering)
-- Teams policies
DROP POLICY IF EXISTS "Users can view teams they are members of" ON public.teams;
CREATE POLICY "Users can view teams they are members of" ON public.teams
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = teams.id
      AND tm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Team creators can insert teams" ON public.teams;
CREATE POLICY "Team creators can insert teams" ON public.teams
  FOR INSERT WITH CHECK (
    creator_id = auth.uid()
  );

DROP POLICY IF EXISTS "Team creators can update teams" ON public.teams;
CREATE POLICY "Team creators can update teams" ON public.teams
  FOR UPDATE USING (
    creator_id = auth.uid()
  );

-- Profiles policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (
    id = auth.uid()
  );

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (
    id = auth.uid()
  );

-- Retro boards policy
DROP POLICY IF EXISTS "Users can view boards they have access to" ON public.retro_boards;
CREATE POLICY "Users can view boards they have access to" ON public.retro_boards
  FOR SELECT USING (
    is_private = false OR
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = retro_boards.team_id
      AND tm.user_id = auth.uid()
    )
  );

-- Drop indexes for tenant_id columns
DROP INDEX IF EXISTS idx_board_templates_tenant_id;
DROP INDEX IF EXISTS idx_retro_boards_tenant_id;
DROP INDEX IF EXISTS idx_profiles_tenant_id;
DROP INDEX IF EXISTS idx_teams_tenant_id;

-- Remove tenant_id columns from existing tables
ALTER TABLE public.board_templates DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.retro_boards DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.teams DROP COLUMN IF EXISTS tenant_id;

-- Drop indexes on tenants table
DROP INDEX IF EXISTS idx_tenants_database_type;
DROP INDEX IF EXISTS idx_tenants_subdomain;

-- Drop the tenants table
DROP TABLE IF EXISTS public.tenants CASCADE;
