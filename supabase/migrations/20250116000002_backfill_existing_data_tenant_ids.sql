-- Backfill existing data with shared tenant ID
-- This migration ensures all existing data is associated with the shared tenant

-- First, ensure the shared tenant exists
INSERT INTO public.tenants (id, name, subdomain, database_type, features, settings)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'Shared Workspace',
  'shared',
  'shared',
  '{"retroBoards": true, "pokerSessions": true, "teamManagement": true, "adminPanel": true}',
  '{"allowAnonymousUsers": true, "requireEmailVerification": false, "maxTeamMembers": 50, "maxBoardsPerTeam": 100}'
) ON CONFLICT (subdomain) DO NOTHING;

-- Update existing profiles to use shared tenant
UPDATE public.profiles 
SET tenant_id = '00000000-0000-0000-0000-000000000000'
WHERE tenant_id IS NULL;

-- Update existing teams to use shared tenant
UPDATE public.teams 
SET tenant_id = '00000000-0000-0000-0000-000000000000'
WHERE tenant_id IS NULL;

-- Update existing retro boards to use shared tenant
UPDATE public.retro_boards 
SET tenant_id = '00000000-0000-0000-0000-000000000000'
WHERE tenant_id IS NULL;

-- Update existing board templates to use shared tenant
UPDATE public.board_templates 
SET tenant_id = '00000000-0000-0000-0000-000000000000'
WHERE tenant_id IS NULL;

-- Add NOT NULL constraints after backfilling to prevent future NULL values
-- This ensures all future inserts will require a tenant_id

-- Add NOT NULL constraint to profiles.tenant_id
ALTER TABLE public.profiles 
ALTER COLUMN tenant_id SET NOT NULL;

-- Add NOT NULL constraint to teams.tenant_id
ALTER TABLE public.teams 
ALTER COLUMN tenant_id SET NOT NULL;

-- Add NOT NULL constraint to retro_boards.tenant_id
ALTER TABLE public.retro_boards 
ALTER COLUMN tenant_id SET NOT NULL;

-- Add NOT NULL constraint to board_templates.tenant_id
ALTER TABLE public.board_templates 
ALTER COLUMN tenant_id SET NOT NULL;

-- Create a comment to document the shared tenant
COMMENT ON TABLE public.tenants IS 'Multi-tenant configuration table. The shared tenant (ID: 00000000-0000-0000-0000-000000000000) contains all existing data migrated from the pre-multi-tenant system.';

