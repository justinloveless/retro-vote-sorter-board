# Supabase Proxy Client for Frontend

This directory contains a Supabase-compatible client that forwards requests through the C# API proxy controller instead of directly to Supabase.

## 📁 Files

- **`supabaseProxyClient.ts`** - Main client implementation with fluent API
- **`supabaseProxyInstance.ts`** - Helper functions to create authenticated instances
- **`SUPABASE_PROXY_CLIENT_USAGE.md`** - Comprehensive usage guide with examples
- **`MIGRATION_EXAMPLE.md`** - Step-by-step migration guide from direct Supabase
- **`TEST_PROXY_CLIENT.md`** - Browser console tests to verify functionality

## 🚀 Quick Start

```typescript
import { getAuthenticatedProxyClient } from '@/lib/data/csharpApi/supabaseProxyInstance';

// Get client (automatically gets auth token)
const client = await getAuthenticatedProxyClient();

// Use exactly like Supabase client
const { data, error } = await client
  .from('teams')
  .select('*')
  .order('created_at', { ascending: false });
```

## 🎯 Why Use This?

### Instead of this (Direct Supabase):
```typescript
import { supabase } from '@/integrations/supabase/client';

const { data } = await supabase.from('teams').select('*');
```

### Use this (Through C# API):
```typescript
import { getAuthenticatedProxyClient } from '@/lib/data/csharpApi/supabaseProxyInstance';

const client = await getAuthenticatedProxyClient();
const { data } = await client.from('teams').select('*');
```

## ✨ Benefits

1. **Same API** - Drop-in replacement for Supabase client
2. **Centralized Control** - All requests go through your C# API
3. **Future-Ready** - Can switch to direct PostgreSQL without changing frontend
4. **Better Monitoring** - Log and track all database requests in one place
5. **Rate Limiting** - Apply rate limits in the C# API
6. **Custom Logic** - Add business logic before hitting the database

## 📚 Documentation

- **[Usage Guide](./SUPABASE_PROXY_CLIENT_USAGE.md)** - Complete API reference with examples
- **[Migration Guide](./MIGRATION_EXAMPLE.md)** - How to migrate existing code
- **[Testing Guide](./TEST_PROXY_CLIENT.md)** - Browser console tests

## 🔧 Supported Features

### ✅ Fully Supported

All common PostgREST operations:

- **Querying**: `select()`, `from()`
- **Filtering**: `eq()`, `neq()`, `gt()`, `gte()`, `lt()`, `lte()`, `like()`, `ilike()`, `is()`, `in()`
- **Modifying**: `insert()`, `update()`, `upsert()`, `delete()`
- **Sorting**: `order()`
- **Pagination**: `limit()`, `range()`
- **Single row**: `single()`, `maybeSingle()`
- **Complex queries**: Embedded resources, multiple filters
- **RPC**: `rpc()` for stored procedures
- **Advanced filters**: `or()`, `not()`, `contains()`, `containedBy()`

### ⚠️ Not Supported

- Real-time subscriptions (requires WebSocket, use direct Supabase)
- Storage operations (use direct Supabase storage client)
- Auth operations (use direct Supabase auth)

## 🔌 Integration with Existing Code

### Option 1: Direct replacement

```typescript
// Before
import { supabase } from '@/integrations/supabase/client';
const { data } = await supabase.from('teams').select('*');

// After
import { getAuthenticatedProxyClient } from '@/lib/data/csharpApi/supabaseProxyInstance';
const client = await getAuthenticatedProxyClient();
const { data } = await client.from('teams').select('*');
```

### Option 2: Conditional (recommended)

```typescript
import { supabase } from '@/integrations/supabase/client';
import { getAuthenticatedProxyClient } from '@/lib/data/csharpApi/supabaseProxyInstance';
import { shouldUseCSharpApi } from '@/config/environment';

async function getClient() {
  return shouldUseCSharpApi() 
    ? await getAuthenticatedProxyClient()
    : supabase;
}

// Now use getClient() in your data functions
const client = await getClient();
const { data } = await client.from('teams').select('*');
```

## 🧪 Testing

Run these tests in your browser console (see [TEST_PROXY_CLIENT.md](./TEST_PROXY_CLIENT.md)):

```javascript
// Quick test
(async () => {
  const { getAuthenticatedProxyClient } = await import('/src/lib/data/csharpApi/supabaseProxyInstance.ts');
  const client = await getAuthenticatedProxyClient();
  const { data, error } = await client.from('teams').select('*').limit(5);
  console.log({ data, error });
})();
```

## ⚙️ Configuration

Control which client to use via `src/config/environment.ts`:

```typescript
const developmentConfig: EnvironmentConfig = {
  useCSharpApi: true, // Set to true to use proxy client
  apiBaseUrl: 'http://localhost:5228' // Your C# API URL
};
```

Or override at runtime (dev only):

```typescript
localStorage.setItem('debug.useCSharpApiOverride', 'true'); // Force proxy
localStorage.setItem('debug.useCSharpApiOverride', 'false'); // Force direct
localStorage.removeItem('debug.useCSharpApiOverride'); // Use config
```

## 📊 Performance

The proxy adds one network hop:

```
Direct:  Frontend → Supabase (1 hop)
Proxy:   Frontend → C# API → Supabase (2 hops)
```

Typical overhead: 10-50ms depending on network latency.

**When to use direct Supabase:**
- Real-time subscriptions
- Client-side only apps
- When lowest latency is critical

**When to use proxy:**
- Need centralized logging
- Want to add business logic
- Planning to migrate off Supabase
- Need rate limiting
- Want better monitoring

## 🐛 Debugging

Enable debug logging in browser console:

```javascript
// See constructed URLs
const client = await getAuthenticatedProxyClient();
console.log('Query URL:', client.from('teams').select('*')._buildUrl());

// Check network tab for /api/supabase/* requests
```

## 🔐 Authentication

The client automatically:
1. Gets the current user's access token from Supabase
2. Adds it to the `Authorization` header
3. Forwards it to the C# API
4. C# API validates the JWT and forwards to Supabase

No manual token management needed!

## 📖 Examples

### Basic Query
```typescript
const client = await getAuthenticatedProxyClient();
const { data } = await client.from('teams').select('*');
```

### With Filters
```typescript
const { data } = await client
  .from('teams')
  .select('*')
  .eq('active', true)
  .order('created_at', { ascending: false })
  .limit(10);
```

### Embedded Resources
```typescript
const { data } = await client
  .from('teams')
  .select(`
    *,
    team_members(
      role,
      profiles(full_name, email)
    )
  `)
  .eq('id', teamId)
  .single();
```

### Insert
```typescript
const { data } = await client
  .from('teams')
  .insert({ name: 'New Team' })
  .select()
  .single();
```

### Update
```typescript
const { data } = await client
  .from('teams')
  .update({ name: 'Updated Name' })
  .eq('id', teamId)
  .select()
  .single();
```

### Delete
```typescript
await client
  .from('teams')
  .delete()
  .eq('id', teamId);
```

### RPC
```typescript
const { data } = await client
  .rpc('get_team_stats', { team_id: teamId });
```

## 🤝 Contributing

When adding new features:
1. Add the method to `SupabaseProxyQueryBuilder`
2. Update tests in `TEST_PROXY_CLIENT.md`
3. Add examples to `SUPABASE_PROXY_CLIENT_USAGE.md`
4. Test with browser console tests

## 📝 Related Documentation

- [C# Proxy Controller Docs](../../../../api/docs/SUPABASE_PROXY.md)
- [C# Proxy Examples](../../../../api/docs/SUPABASE_PROXY_EXAMPLES.md)
- [Supabase JS Client](https://supabase.com/docs/reference/javascript/introduction)
- [PostgREST API](https://postgrest.org/en/stable/references/api.html)

## ❓ FAQ

**Q: Can I mix proxy and direct Supabase calls?**  
A: Yes! Use proxy for data operations, direct Supabase for auth and realtime.

**Q: Does this work with RLS policies?**  
A: Yes, the JWT token is forwarded so all RLS policies apply normally.

**Q: What about performance?**  
A: Adds ~10-50ms overhead. Test with your specific use case.

**Q: Can I use this in production?**  
A: Yes, but test thoroughly and monitor performance first.

**Q: Does this support TypeScript?**  
A: Yes, fully typed with generic support.

**Q: What if the C# API is down?**  
A: Requests will fail. Consider fallback to direct Supabase or error handling.

