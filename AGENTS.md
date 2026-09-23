# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

RetroScope is a React/TypeScript web app for team retrospectives and planning poker. It uses Vite, Tailwind CSS, shadcn/ui, and Supabase (cloud-hosted) as the backend. See `README.md` for general setup.

### Commands

| Action | Command |
|--------|---------|
| Dev server | `npm run dev` (port 8081) |
| Build | `npm run build` |
| Lint | `npm run lint` |
| Tests | `npx vitest run` |

### Non-obvious notes

- The Vite dev server listens on `::` (all interfaces) port **8081**, configured in `vite.config.ts`.
- Supabase is cloud-hosted (not local). The `.env` file has the project URL and anon key already committed. No `supabase start` is needed.
- Test suites under `supabase/functions/` are written for Deno and will fail when run via vitest/Node. Only the frontend test file (`src/`) passes in the Node environment. This is expected.
- The `eslint` run exits non-zero due to pre-existing `@typescript-eslint/no-explicit-any` errors throughout the codebase. This does not indicate a broken setup.
- Edge functions (Slack, Stripe, OpenAI integrations) require their own API keys and the Supabase CLI / Deno runtime; they are optional for frontend development.
