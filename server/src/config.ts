import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().optional(),
  POSTGREST_URL: z.string().default('http://postgrest:3000'),
  JWT_SECRET: z.string().min(32).optional(),
  JWT_ISSUER: z.string().default('retroscope-auth'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  ALLOW_ORIGINS: z.string().default('*'),
  UPLOADS_DIR: z.string().default('/data/uploads'),
  SELF_HOSTED_API_BASE_URL: z.string().optional(),
  /** Optional advertised dual-path mode for FE clients that cannot read hosted app_config (RLS). */
  BACKEND_PROVIDER_MODE: z.enum(['supabase', 'selfhosted']).optional(),
  PUBLIC_SITE_URL: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  OAUTH_GOOGLE_REDIRECT_URI: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  /** Hosted Supabase Postgres URI used by admin migrate tool (never expose to FE). */
  MIGRATE_SOURCE_DATABASE_URL: z.string().optional(),
  /** Hosted Supabase project URL for storage object copy / dual-path admin auth. */
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  /** Optional; used to validate hosted user JWTs if service role is unavailable. */
  SUPABASE_ANON_KEY: z.string().optional(),
});

export type AppConfig = z.infer<typeof envSchema> & {
  allowOrigins: string[];
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.parse(env);
  const allowOrigins =
    parsed.ALLOW_ORIGINS.trim() === '*'
      ? ['*']
      : parsed.ALLOW_ORIGINS.split(',')
          .map((origin) => origin.trim())
          .filter(Boolean);

  // Always include public site / API URLs when set so Coolify misconfig is less painful.
  for (const extra of [parsed.PUBLIC_SITE_URL, parsed.SELF_HOSTED_API_BASE_URL]) {
    if (!extra) continue;
    const normalized = extra.replace(/\/$/, '');
    if (normalized && !allowOrigins.includes('*') && !allowOrigins.includes(normalized)) {
      allowOrigins.push(normalized);
    }
  }

  return {
    ...parsed,
    allowOrigins,
  };
}
