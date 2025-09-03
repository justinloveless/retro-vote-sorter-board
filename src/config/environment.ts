
// Environment configuration for different deployment environments
interface EnvironmentConfig {
  supabaseUrl: string;
  usingSupabaseEnvVariables: boolean;
  supabaseAnonKey: string;
  environment: 'development' | 'production';
}

// Read from Vite env at build time
const ENV_SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL as string | undefined;
const ENV_SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY as string | undefined;

// Default to production configuration (expects env to be provided in CI/deploy)
const productionConfig: EnvironmentConfig = {
  usingSupabaseEnvVariables: (ENV_SUPABASE_URL !== undefined && ENV_SUPABASE_ANON_KEY !== undefined),
  supabaseUrl: ENV_SUPABASE_URL || 'http://test-app-supabase-5f3402-178-156-151-60.traefik.me',
  supabaseAnonKey: ENV_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NTY4Mjc5MzcsImV4cCI6MTg5MzQ1NjAwMCwiaXNzIjoiZG9rcGxveSJ9.603AiFduLpZH30E6b4UYIOmF-Bw4FZG323rSWfzEwZA',
  environment: 'production'
};

// Development configuration - can fall back to local defaults if not set
const developmentConfig: EnvironmentConfig = {
  usingSupabaseEnvVariables: (ENV_SUPABASE_URL !== undefined && ENV_SUPABASE_ANON_KEY !== undefined),
  supabaseUrl: ENV_SUPABASE_URL || 'http://localhost:54321',
  supabaseAnonKey: ENV_SUPABASE_ANON_KEY || '',
  environment: 'development'
};

// Detect environment based on hostname or explicit environment variable
const getEnvironment = (): 'development' | 'production' => {
  // Check if we're in a browser environment
  if (typeof window === 'undefined' || !window.location) {
    // Server-side or during build time, default to production
    return 'production';
  }

  const hostname = window.location.hostname;

  // Check if we're on localhost or a development domain
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('dev.') || hostname.includes('develop.')) {
    return 'development';
  }

  // Check for explicit environment indicator in URL
  if (window.location.search.includes('env=development') || window.location.search.includes('env=dev')) {
    return 'development';
  }

  return 'production';
};

// Get the current environment configuration
export const getEnvironmentConfig = (): EnvironmentConfig => {
  const env = getEnvironment();

  switch (env) {
    case 'development':
      return developmentConfig;
    case 'production':
    default:
      return productionConfig;
  }
};

// Export current config
export const currentEnvironment = getEnvironmentConfig();

// Helper to check if we're in development
export const isDevelopment = () => currentEnvironment.environment === 'development';

// Helper to check if we're in production
export const isProduction = () => currentEnvironment.environment === 'production';
