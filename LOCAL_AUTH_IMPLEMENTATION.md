# Local Auth Implementation

This document describes the implementation of a local authentication system similar to Supabase Auth, built using ASP.NET Core Identity and JWT tokens.

> **⚠️ Dual-Path System**: This local auth system runs **in parallel** with Supabase Auth. See `DUAL_PATH_AUTH_IMPLEMENTATION.md` for routing details and migration strategy.

## Overview

The local auth system provides:

- **Email/Password Authentication** - Traditional signup and signin
- **OAuth Integration** - GitHub and Google OAuth providers
- **JWT Token Management** - Access and refresh tokens
- **Database Integration** - Uses your existing Postgres database
- **Supabase Compatibility** - Maintains compatibility with existing RLS policies

## Architecture

### Components

1. **Retroscope.Auth** - Core authentication library
2. **AuthController** - REST API endpoints for auth operations
3. **AuthService** - Business logic for authentication flows
4. **AuthDbContext** - Entity Framework context for auth data
5. **JWT Configuration** - Token generation and validation

### Database Schema

The auth system extends your existing `auth` schema with additional tables:

- `auth.users` - Enhanced with password and metadata fields
- `auth.identities` - OAuth provider identities
- `auth.refresh_tokens` - JWT refresh token management
- `auth.verification_codes` - Email verification and password reset

## API Endpoints

### Authentication Endpoints

| Method | Endpoint                          | Description            |
| ------ | --------------------------------- | ---------------------- |
| POST   | `/auth/v1/signup`                 | User registration      |
| POST   | `/auth/v1/token`                  | Email/password signin  |
| POST   | `/auth/v1/refresh`                | Refresh access token   |
| GET    | `/auth/v1/user`                   | Get current user info  |
| GET    | `/auth/v1/authorize`              | OAuth authorization    |
| GET    | `/auth/v1/callback`               | OAuth callback         |
| POST   | `/auth/v1/verify`                 | Email verification     |
| POST   | `/auth/v1/reset-password`         | Password reset request |
| POST   | `/auth/v1/confirm-password-reset` | Confirm password reset |

### JWKS Endpoint

| Method | Endpoint                         | Description     |
| ------ | -------------------------------- | --------------- |
| GET    | `/auth/v1/.well-known/jwks.json` | JWT public keys |

## Configuration

### Environment Variables

```bash
# Database
ConnectionStrings__DefaultConnection="Host=localhost;Port=5432;Database=retroscope;Username=retroscope_app;Password=retroscope_app_pass"

# JWT
JWT__Secret="your-super-secret-key-min-32-chars-long-for-jwt-signing"
JWT__Issuer="http://localhost:5228"

# GitHub OAuth
OAuth__GitHub__ClientId="your-github-client-id"
OAuth__GitHub__ClientSecret="your-github-client-secret"
OAuth__GitHub__RedirectUri="http://localhost:5228/auth/v1/callback"

# Google OAuth
OAuth__Google__ClientId="your-google-client-id"
OAuth__Google__ClientSecret="your-google-client-secret"
OAuth__Google__RedirectUri="http://localhost:5228/auth/v1/callback"
```

### Docker Compose

The system is configured to work with your existing Docker setup. Key changes:

- Updated PostgREST to use local JWT secret
- Added auth environment variables to API service
- Maintains compatibility with existing services

## Usage Examples

### 1. User Registration

```bash
curl -X POST http://localhost:5228/auth/v1/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword123"
  }'
```

Response:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "base64-encoded-refresh-token",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "emailConfirmedAt": null,
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

### 2. User Sign In

```bash
curl -X POST "http://localhost:5228/auth/v1/token?grant_type=password" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword123"
  }'
```

### 3. OAuth Authorization

```bash
# Redirect user to OAuth provider
curl -L "http://localhost:5228/auth/v1/authorize?provider=github&redirect_to=/dashboard"
```

### 4. Get Current User

```bash
curl -X GET http://localhost:5228/auth/v1/user \
  -H "Authorization: Bearer your-access-token"
```

### 5. Refresh Token

```bash
curl -X POST http://localhost:5228/auth/v1/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "your-refresh-token"
  }'
```

## Frontend Integration

### JavaScript/TypeScript

```typescript
// Auth service for frontend
class AuthService {
  private baseUrl = 'http://localhost:5228/auth/v1';

  async signUp(email: string, password: string) {
    const response = await fetch(`${this.baseUrl}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return response.json();
  }

  async signIn(email: string, password: string) {
    const response = await fetch(`${this.baseUrl}/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return response.json();
  }

  async getCurrentUser() {
    const token = localStorage.getItem('accessToken');
    const response = await fetch(`${this.baseUrl}/user`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.json();
  }

  async refreshToken() {
    const refreshToken = localStorage.getItem('refreshToken');
    const response = await fetch(`${this.baseUrl}/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    return response.json();
  }
}
```

### React Hook Example

```typescript
import { useState, useEffect } from 'react';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      // Verify token and get user
      authService
        .getCurrentUser()
        .then(setUser)
        .catch(() => {
          // Try refresh token
          authService
            .refreshToken()
            .then(({ accessToken, user }) => {
              localStorage.setItem('accessToken', accessToken);
              setUser(user);
            })
            .catch(() => {
              localStorage.removeItem('accessToken');
              localStorage.removeItem('refreshToken');
            });
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  return { user, loading };
}
```

## Migration from Supabase

### Phase 1: Parallel Operation

- Keep Supabase auth running
- Start using local auth for new users
- Both systems can coexist

### Phase 2: User Migration

- Export users from Supabase
- Import to local auth system
- Update user references

### Phase 3: Complete Switch

- Update frontend to use local auth endpoints
- Remove Supabase auth dependencies
- Clean up old auth code

## Security Considerations

### JWT Security

- Use strong, random secrets (32+ characters)
- Rotate secrets regularly
- Use HTTPS in production
- Implement token expiration

### OAuth Security

- Store client secrets securely
- Use environment variables
- Validate redirect URIs
- Implement CSRF protection

### Database Security

- Use RLS policies (already implemented)
- Encrypt sensitive data
- Regular security audits
- Monitor authentication attempts

## Development vs Production

### Development Mode

- Uses `DevelopmentAuthHandler` for easy testing
- Bypasses JWT validation
- Allows any user to authenticate

### Production Mode

- Full JWT validation
- OAuth provider integration
- Secure token management
- Proper error handling

## Troubleshooting

### Common Issues

1. **Database Connection Errors**

   - Check connection string
   - Verify database is running
   - Check user permissions

2. **JWT Validation Errors**

   - Verify JWT secret matches
   - Check token expiration
   - Validate issuer/audience

3. **OAuth Errors**
   - Check client credentials
   - Verify redirect URIs
   - Check provider permissions

### Debug Mode

Enable debug logging:

```json
{
  "Logging": {
    "LogLevel": {
      "Retroscope.Auth": "Debug"
    }
  }
}
```

## Performance Considerations

- **Token Caching** - Cache JWT validation results
- **Database Indexing** - Ensure proper indexes on auth tables
- **Connection Pooling** - Use connection pooling for database
- **Rate Limiting** - Implement rate limiting for auth endpoints

## Monitoring

- **Authentication Metrics** - Track signup/signin rates
- **Error Monitoring** - Monitor failed authentication attempts
- **Performance Metrics** - Track auth endpoint response times
- **Security Alerts** - Alert on suspicious activity

## Future Enhancements

- **Multi-Factor Authentication** - Add TOTP/SMS support
- **Social Login** - Add more OAuth providers
- **Session Management** - Advanced session handling
- **Audit Logging** - Comprehensive auth audit trail
- **Password Policies** - Configurable password requirements
