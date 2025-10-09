# Supabase Proxy - Frontend Examples

This document provides practical examples of using the Supabase Proxy Controller from frontend applications.

## JavaScript/TypeScript Examples

### Setup

```typescript
const API_BASE = 'http://localhost:5000'; // Or your API URL
const SUPABASE_PROXY = `${API_BASE}/api/supabase`;

async function supabaseRequest(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('access_token'); // Or however you store it
  
  const response = await fetch(`${SUPABASE_PROXY}/${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Request failed');
  }
  
  return response.json();
}
```

### Get All Records

```typescript
// Get all teams ordered by creation date
async function getTeams() {
  return await supabaseRequest('teams?select=*&order=created_at.desc');
}

// With TypeScript types
interface Team {
  id: string;
  name: string;
  created_at: string;
}

async function getTeamsTyped(): Promise<Team[]> {
  return await supabaseRequest('teams?select=id,name,created_at&order=created_at.desc');
}
```

### Get Single Record

```typescript
async function getTeam(teamId: string) {
  const teams = await supabaseRequest(`teams?id=eq.${teamId}&select=*`);
  return teams[0] || null;
}
```

### Create Record

```typescript
async function createTeam(name: string) {
  return await supabaseRequest('teams', {
    method: 'POST',
    headers: {
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({ name }),
  });
}
```

### Update Record

```typescript
async function updateTeam(teamId: string, updates: Partial<Team>) {
  return await supabaseRequest(`teams?id=eq.${teamId}`, {
    method: 'PATCH',
    headers: {
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(updates),
  });
}
```

### Delete Record

```typescript
async function deleteTeam(teamId: string) {
  await supabaseRequest(`teams?id=eq.${teamId}`, {
    method: 'DELETE',
  });
}
```

### Call RPC Function

```typescript
async function callCustomFunction(params: any) {
  return await supabaseRequest('rpc/custom_function', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// Example: Get team statistics
async function getTeamStats(teamId: string) {
  return await supabaseRequest('rpc/get_team_stats', {
    method: 'POST',
    body: JSON.stringify({ team_id: teamId }),
  });
}
```

### Filtering Examples

```typescript
// Single filter
async function getActiveTeams() {
  return await supabaseRequest('teams?active=eq.true&select=*');
}

// Multiple filters
async function getRecentTeamsByOwner(ownerId: string) {
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  
  return await supabaseRequest(
    `teams?owner_id=eq.${ownerId}&created_at=gte.${oneMonthAgo.toISOString()}&select=*`
  );
}

// OR conditions with or parameter
async function getTeamsByNameOrDescription(search: string) {
  return await supabaseRequest(
    `teams?or=(name.ilike.*${search}*,description.ilike.*${search}*)&select=*`
  );
}
```

### Pagination

```typescript
// Using limit and offset
async function getTeamsPaginated(page: number, pageSize: number) {
  const offset = page * pageSize;
  return await supabaseRequest(
    `teams?select=*&order=created_at.desc&limit=${pageSize}&offset=${offset}`
  );
}

// Using Range header
async function getTeamsWithRange(start: number, end: number) {
  const token = localStorage.getItem('access_token');
  
  const response = await fetch(`${SUPABASE_PROXY}/teams?select=*`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Range': `${start}-${end}`,
    },
  });
  
  // Content-Range header tells you total count
  const contentRange = response.headers.get('Content-Range');
  // Example: "0-9/100" means items 0-9 of 100 total
  
  const data = await response.json();
  return { data, contentRange };
}
```

### Embedded Resources

```typescript
// Get teams with their members
async function getTeamsWithMembers() {
  return await supabaseRequest(
    'teams?select=id,name,team_members(user_id,role,profiles(full_name,email))'
  );
}

// Get a single team with nested data
async function getTeamDetails(teamId: string) {
  const teams = await supabaseRequest(
    `teams?id=eq.${teamId}&select=*,team_members(user_id,role,profiles(full_name,email)),retro_boards(id,title,created_at)`
  );
  return teams[0];
}
```

## React Hook Example

```typescript
import { useState, useEffect } from 'react';

interface UseSupabaseQueryResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

function useSupabaseQuery<T>(path: string): UseSupabaseQueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await supabaseRequest(path);
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [path]);

  return { data, loading, error, refetch: fetchData };
}

// Usage
function TeamsList() {
  const { data: teams, loading, error, refetch } = useSupabaseQuery<Team[]>(
    'teams?select=*&order=created_at.desc'
  );

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <button onClick={refetch}>Refresh</button>
      {teams?.map(team => (
        <div key={team.id}>{team.name}</div>
      ))}
    </div>
  );
}
```

## React Mutation Example

```typescript
function useSupabaseMutation<TData, TVariables>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = async (
    path: string,
    options: RequestInit,
  ): Promise<TData | null> => {
    try {
      setLoading(true);
      setError(null);
      return await supabaseRequest(path, options);
    } catch (err) {
      setError(err as Error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { mutate, loading, error };
}

// Usage
function CreateTeamForm() {
  const [name, setName] = useState('');
  const { mutate, loading, error } = useSupabaseMutation<Team, { name: string }>();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const team = await mutate('teams', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({ name }),
    });

    if (team) {
      console.log('Team created:', team);
      setName('');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Team name"
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create Team'}
      </button>
      {error && <div>Error: {error.message}</div>}
    </form>
  );
}
```

## Error Handling

```typescript
async function robustSupabaseRequest(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('access_token');
  
  try {
    const response = await fetch(`${SUPABASE_PROXY}/${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      // Handle specific HTTP status codes
      switch (response.status) {
        case 401:
          // Token expired or invalid - redirect to login
          window.location.href = '/login';
          throw new Error('Authentication required');
        
        case 403:
          throw new Error('You do not have permission to perform this action');
        
        case 404:
          throw new Error('Resource not found');
        
        case 409: {
          const error = await response.json();
          throw new Error(`Conflict: ${error.message || 'Constraint violation'}`);
        }
        
        case 422: {
          const error = await response.json();
          throw new Error(`Invalid data: ${error.message || 'Validation failed'}`);
        }
        
        case 502:
          throw new Error('Service temporarily unavailable. Please try again.');
        
        default: {
          const error = await response.json();
          throw new Error(error.message || 'Request failed');
        }
      }
    }

    // Handle empty responses (e.g., from DELETE)
    if (response.status === 204 || response.headers.get('Content-Length') === '0') {
      return null;
    }

    return await response.json();
  } catch (err) {
    if (err instanceof TypeError && err.message === 'Failed to fetch') {
      throw new Error('Network error. Please check your connection.');
    }
    throw err;
  }
}
```

## Comparison: Proxy vs Direct Supabase Client

### Using Supabase Client (Before)
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Get teams
const { data, error } = await supabase
  .from('teams')
  .select('*')
  .order('created_at', { ascending: false });
```

### Using Proxy (Now)
```typescript
// Get teams
const teams = await supabaseRequest('teams?select=*&order=created_at.desc');
```

### Benefits of Using the Proxy

1. **Centralized Authentication**: The C# API handles JWT validation
2. **Backend Control**: Can add logging, rate limiting, or custom logic
3. **Future-Proof**: Can switch to direct PostgreSQL without changing frontend code
4. **Type Safety**: Can generate TypeScript types from C# DTOs
5. **Consistent Error Handling**: All errors go through the same pipeline
6. **CORS Management**: Single CORS configuration in the backend

## See Also

- [SUPABASE_PROXY.md](./SUPABASE_PROXY.md) - Controller documentation
- [PostgREST API Documentation](https://postgrest.org/en/stable/references/api.html)
- [Supabase REST API Guide](https://supabase.com/docs/guides/api)

