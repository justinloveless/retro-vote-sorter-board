# Supabase Proxy Client - Frontend Usage Guide

This document shows how to use the new Supabase Proxy Client that forwards requests through the C# API instead of directly to Supabase.

## Quick Start

```typescript
import { getAuthenticatedProxyClient } from '@/lib/data/csharpApi/supabaseProxyInstance';

// Get an authenticated client
const proxyClient = await getAuthenticatedProxyClient();

// Use it exactly like the Supabase client
const { data, error } = await proxyClient
  .from('teams')
  .select('*')
  .order('created_at', { ascending: false });
```

## Basic Examples

### Query Data

```typescript
import { getAuthenticatedProxyClient } from '@/lib/data/csharpApi/supabaseProxyInstance';

async function getTeams() {
  const client = await getAuthenticatedProxyClient();
  
  const { data, error } = await client
    .from('teams')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error('Error fetching teams:', error);
    return [];
  }
  
  return data;
}
```

### Get Single Record

```typescript
async function getTeamById(teamId: string) {
  const client = await getAuthenticatedProxyClient();
  
  const { data, error } = await client
    .from('teams')
    .select('*')
    .eq('id', teamId)
    .single();
    
  return { data, error };
}
```

### Insert Data

```typescript
async function createTeam(name: string) {
  const client = await getAuthenticatedProxyClient();
  
  const { data, error } = await client
    .from('teams')
    .insert({ name })
    .select()
    .single();
    
  return { data, error };
}
```

### Update Data

```typescript
async function updateTeam(teamId: string, updates: Partial<Team>) {
  const client = await getAuthenticatedProxyClient();
  
  const { data, error } = await client
    .from('teams')
    .update(updates)
    .eq('id', teamId)
    .select()
    .single();
    
  return { data, error };
}
```

### Delete Data

```typescript
async function deleteTeam(teamId: string) {
  const client = await getAuthenticatedProxyClient();
  
  const { error } = await client
    .from('teams')
    .delete()
    .eq('id', teamId);
    
  return { error };
}
```

## Advanced Examples

### Complex Filters with Embedded Resources

```typescript
async function getTeamWithMembers(teamId: string, userId: string) {
  const client = await getAuthenticatedProxyClient();
  
  const { data, error } = await client
    .from('teams')
    .select(`
      *,
      team_members!inner(
        role,
        user_id,
        profiles(
          full_name,
          email
        )
      )
    `)
    .eq('id', teamId)
    .eq('team_members.user_id', userId)
    .single();
    
  return { data, error };
}
```

### Multiple Filters

```typescript
async function getActiveTeamsForUser(userId: string) {
  const client = await getAuthenticatedProxyClient();
  
  const { data, error } = await client
    .from('teams')
    .select(`
      *,
      team_members!inner(role)
    `)
    .eq('active', true)
    .eq('team_members.user_id', userId)
    .order('created_at', { ascending: false });
    
  return { data, error };
}
```

### Pagination

```typescript
async function getTeamsPaginated(page: number, pageSize: number) {
  const client = await getAuthenticatedProxyClient();
  
  const from = page * pageSize;
  const to = from + pageSize - 1;
  
  const { data, error } = await client
    .from('teams')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
    
  return { data, error };
}
```

### RPC Function Calls

```typescript
async function getTeamStats(teamId: string) {
  const client = await getAuthenticatedProxyClient();
  
  const { data, error } = await client
    .rpc('get_team_stats', { team_id: teamId });
    
  return { data, error };
}
```

### Upsert

```typescript
async function upsertTeam(team: Partial<Team>) {
  const client = await getAuthenticatedProxyClient();
  
  const { data, error } = await client
    .from('teams')
    .upsert(team, { onConflict: 'id' })
    .select()
    .single();
    
  return { data, error };
}
```

## Migration from Direct Supabase

### Before (Direct Supabase)

```typescript
import { supabase } from '@/lib/integrations/supabase/client';

export async function fetchTeams() {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (error) throw error;
  return data;
}
```

### After (Proxy Client)

```typescript
import { getAuthenticatedProxyClient } from '@/lib/data/csharpApi/supabaseProxyInstance';

export async function fetchTeams() {
  const client = await getAuthenticatedProxyClient();
  
  const { data, error } = await client
    .from('teams')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (error) throw error;
  return data;
}
```

The only change needed is:
1. Import `getAuthenticatedProxyClient` instead of `supabase`
2. Get the client instance: `const client = await getAuthenticatedProxyClient();`
3. Replace `supabase` with `client`

## Using in Data Layer

You can integrate this into your existing data layer by creating a factory function:

```typescript
// src/lib/data/clientFactory.ts
import { supabase } from '../integrations/supabase/client';
import { getAuthenticatedProxyClient } from './csharpApi/supabaseProxyInstance';
import { shouldUseCSharpApi } from '../../config/environment';

/**
 * Get the appropriate database client based on configuration.
 */
export async function getDatabaseClient() {
  if (shouldUseCSharpApi()) {
    return await getAuthenticatedProxyClient();
  }
  return supabase;
}
```

Then in your data functions:

```typescript
import { getDatabaseClient } from './clientFactory';

export async function fetchTeams() {
  const client = await getDatabaseClient();
  
  const { data, error } = await client
    .from('teams')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (error) throw error;
  return data;
}
```

## React Hook Example

```typescript
import { useState, useEffect } from 'react';
import { getAuthenticatedProxyClient } from '@/lib/data/csharpApi/supabaseProxyInstance';

interface Team {
  id: string;
  name: string;
  created_at: string;
}

export function useTeams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const client = await getAuthenticatedProxyClient();
        
        const { data, error } = await client
          .from('teams')
          .select('*')
          .order('created_at', { ascending: false });
          
        if (error) throw new Error(error.message);
        setTeams(data || []);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return { teams, loading, error };
}
```

## Supported Features

### ✅ Implemented

- `.from()` - Query tables
- `.select()` - Select columns (with embedded resources)
- `.insert()` - Insert rows
- `.update()` - Update rows
- `.upsert()` - Upsert rows
- `.delete()` - Delete rows
- `.eq()`, `.neq()`, `.gt()`, `.gte()`, `.lt()`, `.lte()` - Comparison filters
- `.like()`, `.ilike()` - Pattern matching
- `.is()` - IS NULL/TRUE/FALSE
- `.in()` - IN array
- `.contains()`, `.containedBy()` - Array/range operators
- `.or()` - OR conditions
- `.not()` - NOT conditions
- `.order()` - Ordering
- `.limit()` - Limit results
- `.range()` - Range/pagination
- `.single()` - Get single row (throws if not exactly 1)
- `.maybeSingle()` - Get single row or null
- `.rpc()` - Call stored procedures

### 🚧 Not Yet Implemented (can be added if needed)

- `.match()` - Match multiple filters
- `.textSearch()` - Full-text search
- `.filter()` with custom operators
- Real-time subscriptions (requires different approach)
- Storage operations (use dedicated storage client)

## Error Handling

The client returns errors in the same format as Supabase:

```typescript
interface SupabaseError {
  message: string;
  details?: string;
  hint?: string;
  code?: string;
}

const { data, error } = await client.from('teams').select('*');

if (error) {
  console.error('Error code:', error.code);
  console.error('Message:', error.message);
  console.error('Details:', error.details);
  console.error('Hint:', error.hint);
}
```

## Performance Considerations

1. **Caching**: The client doesn't cache results. Implement caching in your data layer if needed.
2. **Batching**: Each query is a separate HTTP request. Consider batching related queries.
3. **Network**: Requests go through your C# API, adding one network hop compared to direct Supabase.

## Debugging

Enable debug logging by checking the network tab for requests to `/api/supabase/*`:

```typescript
// Log the constructed URL (for debugging)
const client = await getAuthenticatedProxyClient();
const query = client
  .from('teams')
  .select('*')
  .eq('active', true);

// The query will make a GET request to:
// /api/supabase/teams?select=*&active=eq.true
```

## See Also

- [Supabase JavaScript Client Docs](https://supabase.com/docs/reference/javascript/introduction)
- [PostgREST API Reference](https://postgrest.org/en/stable/references/api.html)
- [C# Proxy Controller Docs](../../../../api/docs/SUPABASE_PROXY.md)


