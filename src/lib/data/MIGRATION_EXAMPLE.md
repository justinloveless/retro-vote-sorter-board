# Migration Example: Using Supabase Proxy Client

This document shows a concrete example of migrating from direct Supabase calls to using the Supabase Proxy Client.

## Example: Migrating `teams.ts`

### Before: Direct Supabase

```typescript
// src/lib/data/teams.ts
import { supabase } from '../integrations/supabase/client';

export async function fetchTeams(): Promise<Team[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("User not authenticated");
  }

  const { data, error } = await supabase
    .from('teams')
    .select(`
      *,
      team_members!inner(role)
    `)
    .eq('team_members.user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch teams: ${error.message}`);
  }

  return data || [];
}
```

### After: With Proxy Client Option

```typescript
// src/lib/data/teams.ts
import { supabase } from '../integrations/supabase/client';
import { getAuthenticatedProxyClient } from './csharpApi/supabaseProxyInstance';
import { shouldUseCSharpApi } from '../../config/environment';

export async function fetchTeams(): Promise<Team[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("User not authenticated");
  }

  // Choose client based on configuration
  const client = shouldUseCSharpApi() 
    ? await getAuthenticatedProxyClient()
    : supabase;

  const { data, error } = await client
    .from('teams')
    .select(`
      *,
      team_members!inner(role)
    `)
    .eq('team_members.user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch teams: ${error.message}`);
  }

  return data || [];
}
```

The only changes needed:
1. Import `getAuthenticatedProxyClient` and `shouldUseCSharpApi`
2. Add a conditional to choose the client
3. Replace `supabase` with `client` in the query

## Complete Example with All CRUD Operations

```typescript
// src/lib/data/teams.ts
import { supabase } from '../integrations/supabase/client';
import { getAuthenticatedProxyClient } from './csharpApi/supabaseProxyInstance';
import { shouldUseCSharpApi } from '../../config/environment';

// Helper to get the appropriate client
async function getClient() {
  if (shouldUseCSharpApi()) {
    return await getAuthenticatedProxyClient();
  }
  return supabase;
}

// Fetch all teams for current user
export async function fetchTeams(): Promise<Team[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const client = await getClient();
  
  const { data, error } = await client
    .from('teams')
    .select(`
      *,
      team_members!inner(role)
    `)
    .eq('team_members.user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch teams: ${error.message}`);
  return data || [];
}

// Create a new team
export async function createTeam(name: string): Promise<Team> {
  const client = await getClient();
  
  const { data, error } = await client
    .from('teams')
    .insert({ name })
    .select()
    .single();

  if (error) throw new Error(`Failed to create team: ${error.message}`);
  if (!data) throw new Error('No data returned from create');
  
  return data;
}

// Update a team
export async function updateTeam(teamId: string, updates: Partial<Team>): Promise<Team> {
  const client = await getClient();
  
  const { data, error } = await client
    .from('teams')
    .update(updates)
    .eq('id', teamId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update team: ${error.message}`);
  if (!data) throw new Error('No data returned from update');
  
  return data;
}

// Delete a team
export async function deleteTeam(teamId: string): Promise<void> {
  const client = await getClient();
  
  const { error } = await client
    .from('teams')
    .delete()
    .eq('id', teamId);

  if (error) throw new Error(`Failed to delete team: ${error.message}`);
}

// Get team members
export async function fetchTeamMembers(teamId: string): Promise<TeamMember[]> {
  const client = await getClient();
  
  const { data, error } = await client
    .from('team_members')
    .select(`
      *,
      profiles(
        id,
        full_name,
        email,
        avatar_url
      )
    `)
    .eq('team_id', teamId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch team members: ${error.message}`);
  return data || [];
}

// Get team by ID with detailed info
export async function getTeamById(teamId: string): Promise<TeamDetails | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const client = await getClient();
  
  const { data, error } = await client
    .from('teams')
    .select(`
      *,
      team_members!inner(
        role,
        user_id,
        profiles(
          full_name,
          email,
          avatar_url
        )
      )
    `)
    .eq('id', teamId)
    .eq('team_members.user_id', user.id)
    .single();

  if (error) {
    // Return null if not found, throw for other errors
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch team: ${error.message}`);
  }
  
  return data;
}
```

## Using in React Components

### Before

```typescript
// src/components/TeamsList.tsx
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/integrations/supabase/client';

export function TeamsList() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTeams() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('team_members.user_id', user.id);

      if (!error && data) {
        setTeams(data);
      }
      setLoading(false);
    }

    loadTeams();
  }, []);

  if (loading) return <div>Loading...</div>;
  return <div>{teams.map(team => <div key={team.id}>{team.name}</div>)}</div>;
}
```

### After: Using Data Layer

```typescript
// src/components/TeamsList.tsx
import { useEffect, useState } from 'react';
import { fetchTeams } from '@/lib/data/teams';

export function TeamsList() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTeams() {
      try {
        // This will automatically use proxy or direct Supabase based on config
        const data = await fetchTeams();
        setTeams(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load teams');
      } finally {
        setLoading(false);
      }
    }

    loadTeams();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  return <div>{teams.map(team => <div key={team.id}>{team.name}</div>)}</div>;
}
```

## Benefits of This Approach

1. **Centralized Logic**: All data access goes through the data layer
2. **Easy Switching**: Toggle between Supabase and C# API with a config flag
3. **Type Safety**: Same types work with both clients
4. **Testing**: Mock the data layer functions instead of Supabase client
5. **Maintainability**: Changes to data access patterns in one place
6. **Gradual Migration**: Can migrate function by function
7. **Feature Flags**: Can A/B test performance between direct and proxied requests

## Configuration

Control which client to use via environment config:

```typescript
// src/config/environment.ts
const developmentConfig: EnvironmentConfig = {
  // ... other config
  useCSharpApi: true, // Use proxy client
  apiBaseUrl: 'http://localhost:5228'
};
```

Or use localStorage override for debugging:

```typescript
// In browser console:
localStorage.setItem('debug.useCSharpApiOverride', 'true'); // Use proxy
localStorage.setItem('debug.useCSharpApiOverride', 'false'); // Use direct Supabase
localStorage.removeItem('debug.useCSharpApiOverride'); // Use config default
```

## Testing the Proxy Client

```typescript
// Test that both clients work the same way
import { supabase } from '@/lib/integrations/supabase/client';
import { getAuthenticatedProxyClient } from '@/lib/data/csharpApi/supabaseProxyInstance';

async function testBothClients() {
  // Test with direct Supabase
  console.log('Testing direct Supabase...');
  const { data: directData, error: directError } = await supabase
    .from('teams')
    .select('*')
    .limit(5);
  console.log('Direct result:', { data: directData, error: directError });

  // Test with proxy client
  console.log('Testing proxy client...');
  const proxyClient = await getAuthenticatedProxyClient();
  const { data: proxyData, error: proxyError } = await proxyClient
    .from('teams')
    .select('*')
    .limit(5);
  console.log('Proxy result:', { data: proxyData, error: proxyError });

  // Compare results
  console.log('Results match:', JSON.stringify(directData) === JSON.stringify(proxyData));
}
```

## Next Steps

1. Update your data layer functions to use `getClient()` helper
2. Test both clients work identically
3. Use feature flag to gradually roll out to users
4. Monitor performance and error rates
5. Optimize based on real usage patterns


