import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().optional(),
  POSTGREST_URL: z.string().default('http://postgrest:3000'),
  JWT_SECRET: z.string().min(32).optional(),
  ALLOW_ORIGINS: z.string().default('*'),
  UPLOADS_DIR: z.string().default('/data/uploads'),
  SELF_HOSTED_API_BASE_URL: z.string().optional(),
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

  return {
    ...parsed,
    allowOrigins,
  };
}
