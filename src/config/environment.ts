
// Environment configuration for different deployment environments
interface EnvironmentConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  environment: 'development' | 'production';
  useCSharpApi: boolean;
  apiBaseUrl: string;
}

// Default to production configuration
const productionConfig: EnvironmentConfig = {
  supabaseUrl: "https://nwfwbjmzbwuyxehindpv.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53Zndiam16Ynd1eXhlaGluZHB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg1MjkyMzksImV4cCI6MjA2NDEwNTIzOX0.s_vI6z46NAYlpB8K0wznCWEr_cFcnsHh7Qn4LmsUZU0",
  environment: 'production',
  useCSharpApi: true, // Disabled in production by default
  apiBaseUrl: 'http://localhost:5099' // Will be set when needed
};

// Development configuration - update these with your dev Supabase project details
const developmentConfig: EnvironmentConfig = {
  // supabaseUrl: "https://your-dev-project-ref.supabase.co", // Replace with your dev project URL
  // supabaseAnonKey: "your-dev-anon-key", // Replace with your dev project anon key
  supabaseUrl: "https://nwfwbjmzbwuyxehindpv.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53Zndiam16Ynd1eXhlaGluZHB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg1MjkyMzksImV4cCI6MjA2NDEwNTIzOX0.s_vI6z46NAYlpB8K0wznCWEr_cFcnsHh7Qn4LmsUZU0",
  environment: 'development',
  useCSharpApi: true, // Enabled in development
  apiBaseUrl: 'http://localhost:5227' // Local C# API URL
};

// Detect environment based on hostname or explicit environment variable
const getEnvironment = (): 'development' | 'production' => {
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

// Get configuration from environment variables (Vite)
const getEnvConfig = () => {
  return {
    useCSharpApi: import.meta.env.VITE_USE_CSHARP_API === 'true',
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || ''
  };
};

// Get the current environment configuration
export const getEnvironmentConfig = (): EnvironmentConfig => {
  const env = getEnvironment();
  const envConfig = getEnvConfig();
  
  let config: EnvironmentConfig;
  switch (env) {
    case 'development':
      config = developmentConfig;
      break;
    case 'production':
    default:
      config = productionConfig;
      break;
  }
  
  // Override with environment variables if provided
  if (envConfig.useCSharpApi !== undefined) {
    config.useCSharpApi = envConfig.useCSharpApi;
  }
  if (envConfig.apiBaseUrl) {
    config.apiBaseUrl = envConfig.apiBaseUrl;
  }
  
  return config;
};

// Export current config
export const currentEnvironment = getEnvironmentConfig();

// Helper to check if we're in development
export const isDevelopment = () => currentEnvironment.environment === 'development';

// Helper to check if we're in production
export const isProduction = () => currentEnvironment.environment === 'production';

// Helper to check if C# API should be used
export const shouldUseCSharpApi = () => currentEnvironment.useCSharpApi;

// Helper to get the C# API base URL
export const getApiBaseUrl = () => currentEnvironment.apiBaseUrl;
