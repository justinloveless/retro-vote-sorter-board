
# Multi-Environment Deployment Guide

This project supports multiple environments for safe development and testing before production deployment.

## Environment Configuration

The app automatically detects the environment based on:
- Hostname (localhost, dev.*, develop.* = development)
- URL parameters (?env=development)

## Setting Up Development Environment

### 1. Create Development Supabase Project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Create a new project for development
3. Note the project URL and anon key

### 2. Update Development Configuration

In `src/config/environment.ts`, update the development configuration:

```typescript
const developmentConfig: EnvironmentConfig = {
  supabaseUrl: "https://your-dev-project-ref.supabase.co", // Replace with your dev project URL
  supabaseAnonKey: "your-dev-anon-key", // Replace with your dev project anon key
  environment: 'development'
};
```

### 3. Copy Database Schema

Copy your production database schema to the development environment:

1. Export schema from production Supabase project
2. Import schema to development Supabase project
3. Ensure all tables, policies, and functions are copied

## Branch Strategy

- **main branch**: Production environment
- **develop branch**: Development environment

### Creating Develop Branch

```bash
git checkout -b develop
git push -u origin develop
```

## Deployment

### Development Deployment

1. Deploy the `develop` branch to a development URL (e.g., dev.yourdomain.com)
2. The app will automatically use development Supabase configuration
3. Test features thoroughly in this environment

### Production Deployment

1. Merge tested changes from `develop` to `main`
2. Deploy `main` branch to production domain
3. The app will automatically use production Supabase configuration

## Environment Indicator

In development environment, a yellow badge will appear in the top-left corner indicating "🚧 Development Environment".

## Best Practices

1. **Always test in development first**
2. **Keep development and production databases in sync for schema**
3. **Use meaningful commit messages**
4. **Create pull requests from develop to main**
5. **Test database migrations in development before production**

## Troubleshooting

- If data doesn't appear, check Supabase configuration in `src/config/environment.ts`
- Verify database schema matches between environments
- Check browser console for environment detection logs
- Ensure RLS policies are properly configured in both environments
