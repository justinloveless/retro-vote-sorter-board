# OAuth Provider Setup Guide

This guide will help you set up OAuth providers (GitHub and Google) for your local auth system.

## GitHub OAuth Setup

1. **Go to GitHub Settings**

   - Navigate to [GitHub Settings](https://github.com/settings)
   - Click on "Developer settings" in the left sidebar
   - Click on "OAuth Apps"

2. **Create New OAuth App**

   - Click "New OAuth App"
   - Fill in the following details:
     - **Application name**: `Retroscope Local Auth`
     - **Homepage URL**: `http://localhost:5228`
     - **Authorization callback URL**: `http://localhost:5228/auth/v1/callback`
   - Click "Register application"

3. **Get Client Credentials**

   - Copy the **Client ID**
   - Generate a new **Client Secret** (click "Generate a new client secret")
   - Save both values securely

4. **Update Configuration**
   - Update `appsettings.json`:
   ```json
   "OAuth": {
     "GitHub": {
       "ClientId": "your-github-client-id-here",
       "ClientSecret": "your-github-client-secret-here",
       "RedirectUri": "http://localhost:5228/auth/v1/callback"
     }
   }
   ```

## Google OAuth Setup

1. **Go to Google Cloud Console**

   - Navigate to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one

2. **Enable Google+ API**

   - Go to "APIs & Services" > "Library"
   - Search for "Google+ API" and enable it
   - Also enable "Google OAuth2 API"

3. **Create OAuth 2.0 Credentials**

   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client IDs"
   - Choose "Web application"
   - Fill in the details:
     - **Name**: `Retroscope Local Auth`
     - **Authorized JavaScript origins**: `http://localhost:5228`
     - **Authorized redirect URIs**: `http://localhost:5228/auth/v1/callback`
   - Click "Create"

4. **Get Client Credentials**

   - Copy the **Client ID**
   - Copy the **Client Secret**

5. **Update Configuration**
   - Update `appsettings.json`:
   ```json
   "OAuth": {
     "Google": {
       "ClientId": "your-google-client-id-here",
       "ClientSecret": "your-google-client-secret-here",
       "RedirectUri": "http://localhost:5228/auth/v1/callback"
     }
   }
   ```

## Environment Variables (Alternative)

Instead of updating `appsettings.json`, you can set environment variables:

```bash
export OAuth__GitHub__ClientId="your-github-client-id"
export OAuth__GitHub__ClientSecret="your-github-client-secret"
export OAuth__Google__ClientId="your-google-client-id"
export OAuth__Google__ClientSecret="your-google-client-secret"
```

## Testing OAuth Flow

1. **Start your application**

   ```bash
   cd api
   dotnet run --project src/Retroscope.Api
   ```

2. **Test GitHub OAuth**

   - Navigate to: `http://localhost:5228/auth/v1/authorize?provider=github&redirect_to=/dashboard`
   - You should be redirected to GitHub for authorization
   - After authorization, you'll be redirected back with tokens

3. **Test Google OAuth**
   - Navigate to: `http://localhost:5228/auth/v1/authorize?provider=google&redirect_to=/dashboard`
   - You should be redirected to Google for authorization
   - After authorization, you'll be redirected back with tokens

## Security Notes

- **Never commit OAuth secrets to version control**
- **Use environment variables in production**
- **Rotate secrets regularly**
- **Use HTTPS in production** (update redirect URIs accordingly)
- **Limit OAuth app permissions** to only what's needed

## Production Setup

For production deployment:

1. **Update redirect URIs** to use your production domain
2. **Use HTTPS** for all URLs
3. **Set strong JWT secrets** (at least 32 characters)
4. **Use environment variables** instead of appsettings.json
5. **Enable proper logging** for OAuth flows
6. **Set up monitoring** for failed authentication attempts

## Troubleshooting

### Common Issues

1. **"Invalid redirect URI"**

   - Ensure the redirect URI in your OAuth app matches exactly
   - Check for trailing slashes or protocol mismatches

2. **"Client ID not found"**

   - Verify the Client ID is correct
   - Ensure the OAuth app is not disabled

3. **"Invalid client secret"**

   - Regenerate the client secret
   - Ensure no extra spaces or characters

4. **"Access denied"**
   - Check OAuth app permissions
   - Verify the user has granted necessary permissions

### Debug Mode

Enable debug logging in `appsettings.json`:

```json
{
  "Logging": {
    "LogLevel": {
      "Retroscope.Auth": "Debug"
    }
  }
}
```

This will provide detailed logs of the OAuth flow for troubleshooting.
