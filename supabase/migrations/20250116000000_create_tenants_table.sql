-- Create tenants table for multi-tenancy support
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subdomain TEXT UNIQUE NOT NULL,
  database_type TEXT NOT NULL DEFAULT 'shared' CHECK (database_type IN ('shared', 'isolated', 'custom')),
  database_config JSONB,
  features JSONB NOT NULL DEFAULT '{}',
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Create index for subdomain lookups
CREATE INDEX IF NOT EXISTS idx_tenants_subdomain ON public.tenants(subdomain);

-- Create index for database type filtering
CREATE INDEX IF NOT EXISTS idx_tenants_database_type ON public.tenants(database_type);

-- Add tenant_id column to existing tables for data isolation
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.retro_boards ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.board_templates ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Create indexes for tenant_id columns
CREATE INDEX IF NOT EXISTS idx_teams_tenant_id ON public.teams(tenant_id);
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id ON public.profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_retro_boards_tenant_id ON public.retro_boards(tenant_id);
CREATE INDEX IF NOT EXISTS idx_board_templates_tenant_id ON public.board_templates(tenant_id);

-- Create function to automatically set tenant_id based on current tenant context
CREATE OR REPLACE FUNCTION public.set_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Get tenant_id from request headers (X-Tenant)
  NEW.tenant_id = COALESCE(
    current_setting('request.headers')::json->>'x-tenant',
    'shared'::text
  )::uuid;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically set tenant_id
CREATE TRIGGER set_tenant_id_teams
  BEFORE INSERT ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.set_tenant_id();

CREATE TRIGGER set_tenant_id_profiles
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_tenant_id();

CREATE TRIGGER set_tenant_id_retro_boards
  BEFORE INSERT ON public.retro_boards
  FOR EACH ROW
  EXECUTE FUNCTION public.set_tenant_id();

CREATE TRIGGER set_tenant_id_board_templates
  BEFORE INSERT ON public.board_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.set_tenant_id();

-- Create function to get current tenant ID from headers
CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS UUID AS $$
BEGIN
  RETURN COALESCE(
    current_setting('request.headers')::json->>'x-tenant',
    'shared'::text
  )::uuid;
END;
$$ LANGUAGE plpgsql STABLE;

-- Update RLS policies to include tenant isolation
-- Teams policy
DROP POLICY IF EXISTS "Users can view teams they are members of" ON public.teams;
CREATE POLICY "Users can view teams they are members of" ON public.teams
  FOR SELECT USING (
    tenant_id = public.get_current_tenant_id() AND
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = teams.id
      AND tm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Team creators can insert teams" ON public.teams;
CREATE POLICY "Team creators can insert teams" ON public.teams
  FOR INSERT WITH CHECK (
    tenant_id = public.get_current_tenant_id() AND
    creator_id = auth.uid()
  );

DROP POLICY IF EXISTS "Team creators can update teams" ON public.teams;
CREATE POLICY "Team creators can update teams" ON public.teams
  FOR UPDATE USING (
    tenant_id = public.get_current_tenant_id() AND
    creator_id = auth.uid()
  );

-- Profiles policy
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (
    tenant_id = public.get_current_tenant_id() AND
    id = auth.uid()
  );

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (
    tenant_id = public.get_current_tenant_id() AND
    id = auth.uid()
  );

-- Retro boards policy
DROP POLICY IF EXISTS "Users can view boards they have access to" ON public.retro_boards;
CREATE POLICY "Users can view boards they have access to" ON public.retro_boards
  FOR SELECT USING (
    tenant_id = public.get_current_tenant_id() AND
    (
      is_private = false OR
      EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.team_id = retro_boards.team_id
        AND tm.user_id = auth.uid()
      )
    )
  );

-- Insert default shared tenant
INSERT INTO public.tenants (id, name, subdomain, database_type, features, settings)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'Shared Workspace',
  'shared',
  'shared',
  '{"retroBoards": true, "pokerSessions": true, "teamManagement": true, "adminPanel": true}',
  '{"allowAnonymousUsers": true, "requireEmailVerification": false, "maxTeamMembers": 50, "maxBoardsPerTeam": 100}'
) ON CONFLICT (subdomain) DO NOTHING;

