# Test Supabase Proxy Client

Quick tests you can run in the browser console to verify the proxy client works correctly.

## Prerequisites

1. Make sure you're logged in to the app
2. Open browser console (F12)
3. Make sure the C# API is running (`http://localhost:5228`)

## Basic Test

Paste this into the browser console:

```javascript
// Test the proxy client
(async () => {
  const { getAuthenticatedProxyClient } = await import('/src/lib/data/csharpApi/supabaseProxyInstance.ts');
  
  console.log('Creating authenticated proxy client...');
  const client = await getAuthenticatedProxyClient();
  
  console.log('Fetching teams...');
  const { data, error } = await client
    .from('teams')
    .select('*')
    .limit(5);
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Success! Teams:', data);
  }
})();
```

## Compare Both Clients

Test that proxy and direct Supabase return the same results:

```javascript
(async () => {
  const { supabase } = await import('/src/integrations/supabase/client.ts');
  const { getAuthenticatedProxyClient } = await import('/src/lib/data/csharpApi/supabaseProxyInstance.ts');
  
  console.log('Testing direct Supabase...');
  const { data: directData, error: directError } = await supabase
    .from('teams')
    .select('id, name, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
  
  console.log('Direct Supabase result:', { data: directData, error: directError });
  
  console.log('\nTesting proxy client...');
  const proxyClient = await getAuthenticatedProxyClient();
  const { data: proxyData, error: proxyError } = await proxyClient
    .from('teams')
    .select('id, name, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
  
  console.log('Proxy client result:', { data: proxyData, error: proxyError });
  
  // Compare
  console.log('\n=== COMPARISON ===');
  console.log('Both successful:', !directError && !proxyError);
  console.log('Same number of results:', directData?.length === proxyData?.length);
  console.log('Results match:', JSON.stringify(directData) === JSON.stringify(proxyData));
})();
```

## Test Complex Query

Test with embedded resources and filters:

```javascript
(async () => {
  const { getAuthenticatedProxyClient } = await import('/src/lib/data/csharpApi/supabaseProxyInstance.ts');
  const { supabase } = await import('/src/integrations/supabase/client.ts');
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error('Not logged in!');
    return;
  }
  
  console.log('Testing complex query with user:', user.id);
  
  const client = await getAuthenticatedProxyClient();
  const { data, error } = await client
    .from('teams')
    .select(`
      *,
      team_members!inner(
        role,
        user_id
      )
    `)
    .eq('team_members.user_id', user.id)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Success! Teams with members:', data);
    console.log(`Found ${data?.length || 0} teams`);
  }
})();
```

## Test CRUD Operations

Test create, read, update, delete:

```javascript
(async () => {
  const { getAuthenticatedProxyClient } = await import('/src/lib/data/csharpApi/supabaseProxyInstance.ts');
  
  const client = await getAuthenticatedProxyClient();
  const testTeamName = `Test Team ${Date.now()}`;
  
  try {
    // CREATE
    console.log('Creating team:', testTeamName);
    const { data: created, error: createError } = await client
      .from('teams')
      .insert({ name: testTeamName })
      .select()
      .single();
    
    if (createError) throw createError;
    console.log('✓ Created:', created);
    
    // READ
    console.log('\nReading team...');
    const { data: read, error: readError } = await client
      .from('teams')
      .select('*')
      .eq('id', created.id)
      .single();
    
    if (readError) throw readError;
    console.log('✓ Read:', read);
    
    // UPDATE
    console.log('\nUpdating team...');
    const { data: updated, error: updateError } = await client
      .from('teams')
      .update({ name: `${testTeamName} (updated)` })
      .eq('id', created.id)
      .select()
      .single();
    
    if (updateError) throw updateError;
    console.log('✓ Updated:', updated);
    
    // DELETE
    console.log('\nDeleting team...');
    const { error: deleteError } = await client
      .from('teams')
      .delete()
      .eq('id', created.id);
    
    if (deleteError) throw deleteError;
    console.log('✓ Deleted successfully');
    
    console.log('\n✅ All CRUD operations successful!');
  } catch (err) {
    console.error('❌ Test failed:', err);
  }
})();
```

## Test RPC Function

Test calling a stored procedure:

```javascript
(async () => {
  const { getAuthenticatedProxyClient } = await import('/src/lib/data/csharpApi/supabaseProxyInstance.ts');
  
  const client = await getAuthenticatedProxyClient();
  
  // Replace 'your_function_name' with an actual RPC function in your database
  const { data, error } = await client
    .rpc('get_team_stats', { 
      team_id: 'your-team-id-here' 
    });
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('RPC result:', data);
  }
})();
```

## Test Error Handling

Test that errors are handled correctly:

```javascript
(async () => {
  const { getAuthenticatedProxyClient } = await import('/src/lib/data/csharpApi/supabaseProxyInstance.ts');
  
  const client = await getAuthenticatedProxyClient();
  
  // Test 1: Single with no results
  console.log('Test 1: Single with no results');
  const { data: data1, error: error1 } = await client
    .from('teams')
    .select('*')
    .eq('id', '00000000-0000-0000-0000-000000000000')
    .single();
  
  console.log('Result:', { data: data1, error: error1 });
  console.log('Expected error code:', error1?.code);
  
  // Test 2: Invalid table
  console.log('\nTest 2: Invalid table');
  const { data: data2, error: error2 } = await client
    .from('nonexistent_table')
    .select('*');
  
  console.log('Result:', { data: data2, error: error2 });
  console.log('Should have error:', !!error2);
  
  // Test 3: Insert with constraint violation
  console.log('\nTest 3: Constraint violation (if you have unique constraints)');
  const { data: data3, error: error3 } = await client
    .from('teams')
    .insert({ name: null }); // Assuming name is NOT NULL
  
  console.log('Result:', { data: data3, error: error3 });
  console.log('Should have error:', !!error3);
})();
```

## Performance Test

Compare performance between direct and proxy:

```javascript
(async () => {
  const { supabase } = await import('/src/integrations/supabase/client.ts');
  const { getAuthenticatedProxyClient } = await import('/src/lib/data/csharpApi/supabaseProxyInstance.ts');
  
  const iterations = 10;
  
  // Test direct Supabase
  console.log('Testing direct Supabase performance...');
  const directStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    await supabase.from('teams').select('*').limit(10);
  }
  const directEnd = performance.now();
  const directTime = (directEnd - directStart) / iterations;
  
  // Test proxy
  console.log('Testing proxy client performance...');
  const client = await getAuthenticatedProxyClient();
  const proxyStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    await client.from('teams').select('*').limit(10);
  }
  const proxyEnd = performance.now();
  const proxyTime = (proxyEnd - proxyStart) / iterations;
  
  // Results
  console.log('\n=== PERFORMANCE RESULTS ===');
  console.log(`Direct Supabase: ${directTime.toFixed(2)}ms per request`);
  console.log(`Proxy Client: ${proxyTime.toFixed(2)}ms per request`);
  console.log(`Overhead: ${(proxyTime - directTime).toFixed(2)}ms (${((proxyTime / directTime - 1) * 100).toFixed(1)}%)`);
})();
```

## Expected Results

- **Basic Test**: Should return your teams data
- **Compare Test**: Both should return identical results
- **Complex Query**: Should return teams with embedded members
- **CRUD Test**: All operations should succeed
- **Error Test**: Should get appropriate error messages
- **Performance Test**: Proxy should be slightly slower due to extra hop

## Troubleshooting

### "Failed to fetch"
- Check that C# API is running on `http://localhost:5228`
- Check CORS settings in C# API
- Check network tab for the actual error

### "401 Unauthorized"
- Make sure you're logged in
- Check that access token is being sent correctly
- Check C# API authentication configuration

### "Different results between clients"
- Check if RLS policies are the same
- Check if you're using the same user for both
- Verify query syntax is exactly the same

### "Slow performance"
- Check network latency
- Enable caching in the proxy if needed
- Consider batching multiple requests

## Clean Up

After testing, clean up any test data:

```javascript
// Delete all test teams (be careful with this!)
(async () => {
  const { getAuthenticatedProxyClient } = await import('/src/lib/data/csharpApi/supabaseProxyInstance.ts');
  
  const client = await getAuthenticatedProxyClient();
  
  // Find test teams
  const { data: testTeams } = await client
    .from('teams')
    .select('id, name')
    .ilike('name', 'Test Team%');
  
  console.log('Found test teams:', testTeams);
  
  if (testTeams && testTeams.length > 0) {
    const confirm = window.confirm(`Delete ${testTeams.length} test teams?`);
    if (confirm) {
      for (const team of testTeams) {
        await client.from('teams').delete().eq('id', team.id);
        console.log('Deleted:', team.name);
      }
      console.log('✓ Cleanup complete');
    }
  }
})();
```

