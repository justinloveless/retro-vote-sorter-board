/** Atlaskit bundles reference `process` in the browser; Vite only replaces `process.env`. */
const nodeEnv = import.meta.env.PROD ? 'production' : 'development';
const g = globalThis as any;
if (typeof g.process === 'undefined') {
  g.process = { env: { NODE_ENV: nodeEnv }, browser: true };
} else {
  g.process.env = { NODE_ENV: nodeEnv, ...g.process.env };
}
