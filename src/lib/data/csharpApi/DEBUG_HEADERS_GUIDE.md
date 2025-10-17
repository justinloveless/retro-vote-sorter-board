# Debug Headers Guide

This guide explains how to use the debug headers feature for testing different backend configurations.

## Overview

The debug headers system allows you to control which backend services are used for authentication and database operations when using the C# API. This is particularly useful for testing the dual-path migration system.

## Available Headers

### X-UseLocalAuth

- **Purpose**: Controls whether to use local authentication services
- **Values**: `true` (use local auth), `false` (use Supabase auth), or not set (use default)
- **Default**: Not set (uses backend default)

### X-UseLocalPostgres

- **Purpose**: Controls whether to use local PostgreSQL database
- **Values**: `true` (use local DB), `false` (use Supabase DB), or not set (use default)
- **Default**: Not set (uses backend default)

### X-DualPath

- **Purpose**: Enables dual-path mode where both local and Supabase services are used
- **Values**: `true` (enable dual path), `false` (disable dual path), or not set (use default)
- **Default**: Not set (uses backend default)

## Using the Debug Toggle

### In Development Mode

1. **Enable Debug Controls**: The debug toggle automatically appears in development mode
2. **Toggle C# API**: First ensure C# API is enabled
3. **Set Headers**: Use the header toggles to configure which services to use:
   - Click the header buttons to cycle through: `—` (not set) → `On` → `Off` → `—`
   - The button colors indicate the current state:
     - Gray (`—`): Not set, uses backend default
     - Green (`On`): Header set to `true`
     - Red (`Off`): Header set to `false`

### Programmatic Usage

```typescript
import { setHeaderOverride, getCSharpApiHeaders } from '@/config/environment';

// Set a header override
setHeaderOverride('useLocalAuth', true);
setHeaderOverride('useLocalPostgres', false);
setHeaderOverride('dualPath', true);

// Get current headers (used automatically by C# API client)
const headers = getCSharpApiHeaders();
console.log(headers);
// Output: {
//   'X-UseLocalAuth': 'true',
//   'X-UseLocalPostgres': 'false',
//   'X-DualPath': 'true'
// }

// Clear an override
setHeaderOverride('useLocalAuth', null);

// Clear all overrides
setHeaderOverride('useLocalAuth', null);
setHeaderOverride('useLocalPostgres', null);
setHeaderOverride('dualPath', null);
```

## How It Works

1. **Header Configuration**: Headers are stored in localStorage and persist across page reloads
2. **Automatic Application**: All C# API requests automatically include the configured headers
3. **Backend Processing**: The C# API backend reads these headers to determine which services to use
4. **Fallback Behavior**: If headers are not set, the backend uses its default configuration

## Testing Scenarios

### Scenario 1: Local Auth + Supabase DB

```
X-UseLocalAuth: true
X-UseLocalPostgres: false
X-DualPath: false
```

### Scenario 2: Supabase Auth + Local DB

```
X-UseLocalAuth: false
X-UseLocalPostgres: true
X-DualPath: false
```

### Scenario 3: Dual Path Mode

```
X-UseLocalAuth: true
X-UseLocalPostgres: true
X-DualPath: true
```

### Scenario 4: All Supabase (Default)

```
(No headers set - uses backend defaults)
```

## Debug Information

To see the current header state in real-time, you can use the `HeaderDebugInfo` component:

```typescript
import { HeaderDebugInfo } from '@/components/HeaderDebugInfo';

// Add to your component for debugging
<HeaderDebugInfo />;
```

This component shows:

- Current override values
- Generated headers
- Updates in real-time as you change settings

## Reset Functionality

The debug toggle includes a "Reset" button that:

1. Clears all header overrides
2. Clears the C# API override
3. Reloads the page to apply changes

## Storage Keys

Headers are stored in localStorage with these keys:

- `debug.header.useLocalAuth`
- `debug.header.useLocalPostgres`
- `debug.header.dualPath`

These can be manually cleared if needed for troubleshooting.

## Production Behavior

- Debug controls are only visible in development mode
- Header overrides are ignored in production
- The C# API client automatically excludes debug headers in production builds
