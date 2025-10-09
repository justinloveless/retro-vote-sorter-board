# Edge Functions Usage Guide

## Overview

The Supabase Proxy Client now supports Edge Functions invocation through the C# API proxy, providing the same interface as the standard Supabase client.

## Basic Usage

```typescript
import { supabaseProxy } from '@/lib/data/csharpApi/supabaseProxyInstance';

// Invoke an Edge Function
const { data, error } = await supabaseProxy.functions.invoke('my-function', {
  body: { 
    message: 'Hello from client',
    userId: '123'
  }
});

if (error) {
  console.error('Function invocation failed:', error);
  return;
}

console.log('Function response:', data);
```

## Request Options

### Method

By default, Edge Functions are invoked with POST. You can specify other HTTP methods:

```typescript
// GET request
const { data, error } = await supabaseProxy.functions.invoke('get-data', {
  method: 'GET'
});

// PUT request
const { data, error } = await supabaseProxy.functions.invoke('update-resource', {
  method: 'PUT',
  body: { resourceId: '123', updates: { name: 'New Name' } }
});
```

### Custom Headers

Pass custom headers to your Edge Function:

```typescript
const { data, error } = await supabaseProxy.functions.invoke('my-function', {
  body: { data: 'value' },
  headers: {
    'X-Custom-Header': 'custom-value',
    'X-Request-Source': 'web-app'
  }
});
```

## Real-World Examples

### Send Notification

```typescript
export async function sendNotification(userId: string, message: string) {
  const { data, error } = await supabaseProxy.functions.invoke('admin-send-notification', {
    body: {
      user_id: userId,
      notification: {
        title: 'New Update',
        message: message,
        type: 'info'
      }
    }
  });

  if (error) {
    console.error('Failed to send notification:', error);
    return false;
  }

  return true;
}
```

### Process Payment

```typescript
export async function processPayment(amount: number, paymentMethod: string) {
  const { data, error } = await supabaseProxy.functions.invoke('process-payment', {
    body: {
      amount,
      payment_method: paymentMethod,
      currency: 'USD'
    }
  });

  if (error) {
    return {
      success: false,
      error: error.message
    };
  }

  return {
    success: true,
    transactionId: data.transaction_id,
    status: data.status
  };
}
```

### Generate Report

```typescript
export async function generateReport(teamId: string, dateRange: { from: string; to: string }) {
  const { data, error } = await supabaseProxy.functions.invoke('generate-report', {
    body: {
      team_id: teamId,
      date_from: dateRange.from,
      date_to: dateRange.to,
      format: 'pdf'
    }
  });

  if (error) {
    throw new Error(`Report generation failed: ${error.message}`);
  }

  return {
    reportUrl: data.report_url,
    expiresAt: data.expires_at
  };
}
```

## Error Handling

Edge Functions return errors in the standard Supabase format:

```typescript
const { data, error } = await supabaseProxy.functions.invoke('my-function', {
  body: { param: 'value' }
});

if (error) {
  console.error('Error details:', {
    message: error.message,
    details: error.details,
    hint: error.hint,
    code: error.code
  });
  
  // Handle specific error codes
  if (error.code === '401') {
    // Unauthorized - token may be expired
    redirectToLogin();
  } else if (error.code === '500') {
    // Server error
    showErrorNotification('Something went wrong. Please try again.');
  }
}
```

## Request Flow

When you call an Edge Function through the proxy:

1. **Client Request**:
   ```
   supabaseProxy.functions.invoke('admin-send-notification', { body: {...} })
   ```

2. **HTTP Request to C# API**:
   ```
   POST /api/supabase/functions/admin-send-notification
   Authorization: Bearer <jwt-token>
   Content-Type: application/json
   
   { body: {...} }
   ```

3. **C# API Proxies to Supabase**:
   ```
   POST https://[project].supabase.co/functions/v1/admin-send-notification
   Authorization: Bearer <jwt-token>
   apikey: <anon-key>
   Content-Type: application/json
   
   {...}
   ```

4. **Response Forwarded Back**:
   ```
   { data: {...}, error: null }
   ```

## Benefits of Using the Proxy

1. **Security**: Supabase anon key is never exposed to the client
2. **Centralized Auth**: JWT validation happens in one place
3. **Logging**: All requests are logged in the C# API
4. **Error Handling**: Consistent error format across all operations
5. **Retry Logic**: Automatic retries for transient failures
6. **Monitoring**: Easy to track and monitor function invocations

## Comparison with Direct Supabase Client

### Before (Direct Supabase):
```typescript
import { supabase } from '@/integrations/supabase/client';

const { data, error } = await supabase.functions.invoke('my-function', {
  body: { param: 'value' }
});
```

### After (Through Proxy):
```typescript
import { supabaseProxy } from '@/lib/data/csharpApi/supabaseProxyInstance';

const { data, error } = await supabaseProxy.functions.invoke('my-function', {
  body: { param: 'value' }
});
```

**The API is identical!** Just swap `supabase` with `supabaseProxy`.

## Testing

### Test Edge Function Call

```typescript
import { supabaseProxy } from '@/lib/data/csharpApi/supabaseProxyInstance';

async function testEdgeFunction() {
  console.log('Testing Edge Function invocation...');
  
  const { data, error } = await supabaseProxy.functions.invoke('hello-world', {
    body: { name: 'Test User' }
  });
  
  if (error) {
    console.error('❌ Test failed:', error);
    return;
  }
  
  console.log('✅ Test passed:', data);
}

// Run the test
testEdgeFunction();
```

## TypeScript Types

For better type safety, define your function request/response types:

```typescript
interface SendNotificationRequest {
  user_id: string;
  notification: {
    title: string;
    message: string;
    type: 'info' | 'warning' | 'error' | 'success';
  };
}

interface SendNotificationResponse {
  notification_id: string;
  sent_at: string;
}

export async function sendNotification(
  request: SendNotificationRequest
): Promise<SendNotificationResponse> {
  const { data, error } = await supabaseProxy.functions
    .invoke<SendNotificationResponse>('admin-send-notification', {
      body: request
    });

  if (error) {
    throw new Error(`Failed to send notification: ${error.message}`);
  }

  return data;
}
```

## Debugging

Enable detailed logging in the C# API to see the full request/response flow:

```json
{
  "Serilog": {
    "MinimumLevel": {
      "Default": "Debug"
    }
  }
}
```

Then check the console output for:
- Request method and URL
- Which client is being used (FunctionsClient vs PostgrestClient)
- Response status and content length
- Any errors with full stack traces

## Common Issues

### 404 Not Found

**Problem**: Edge Function returns 404

**Causes**:
- Function name is incorrect
- Function doesn't exist in Supabase
- Function is not deployed

**Solution**: Verify the function exists in Supabase dashboard

### 401 Unauthorized

**Problem**: Edge Function returns 401

**Causes**:
- JWT token is expired or invalid
- User doesn't have permission to invoke the function

**Solution**: Check authentication state and refresh token if needed

### 500 Server Error

**Problem**: Edge Function returns 500

**Causes**:
- Error in the Edge Function code
- Missing environment variables in function
- Timeout (function took too long)

**Solution**: Check Edge Function logs in Supabase dashboard

## Next Steps

- See [SUPABASE_PROXY_CLIENT_USAGE.md](./SUPABASE_PROXY_CLIENT_USAGE.md) for database operations
- See [PROXY_ROUTING_GUIDE.md](../../../api/docs/PROXY_ROUTING_GUIDE.md) for technical details
- See [AUTH_USAGE.md](./AUTH_USAGE.md) for authentication operations (coming soon)

