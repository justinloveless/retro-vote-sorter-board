#!/usr/bin/env node
/**
 * Create Linear tickets for DUN-74 self-host migration phases (Retroscope / DUN).
 *
 * Env:
 *   LINEAR_API_KEY       (required)
 *   LINEAR_TEAM_KEY      (default: DUN)
 *   LINEAR_PROJECT_NAME  (default: Retroscope)
 *   LINEAR_PARENT_ID     (optional override for parent issue id; default resolves DUN-74)
 *
 * CLI:
 *   --dry-run   Resolve IDs / print payloads without creating
 */

const LINEAR_API = "https://api.linear.app/graphql";

const PHASES = [
  {
    title: "Self-host Phase 0: Plan & inventory",
    state: "completed",
    description: `Parent: [DUN-74](https://linear.app) Self hosted migration.

## Goal
Lock architecture decisions and inventory FE Supabase coupling before implementation.

## Status
**Done** (see PR https://github.com/justinloveless/retro-vote-sorter-board/pull/172).

## Locked decisions
- PostgREST sidecar: yes
- Coolify on shared Hetzner VPS
- Object storage: Docker volumes (\`retroscope_uploads\` + bucket prefixes)
- Stack: Node (Fastify) + Postgres + PostgREST + static FE

## Deliverables
- \`documentation/plans/self-host-node-postgres-migration-plan.md\`
- \`documentation/plans/self-host-coverage-tracker.md\` (full FE inventory)
- \`tasks/tasks-self-host-node-postgres.md\` (Phase 0 marked Done)

## Inventory highlights
- ~280 \`.from\` call sites / 37 tables
- 29 edge functions, 5 RPCs, 15 realtime channels
- FE storage buckets: avatars, poker-session-chat-images, retro-audio
`,
  },
  {
    title: "Self-host Phase 1: Coolify skeleton + admin backend toggle",
    description: `Parent: DUN-74 Self hosted migration.

## Goal
Scaffold the lean Coolify stack and admin-only backend provider toggle (both modes still hosted Supabase until Phase 2).

## Scope
- Scaffold \`server/\` Fastify app (healthz/readyz, env config, Dockerfile)
- \`docker-compose.selfhost.yml\`: postgres, postgrest, api, web
- Named volumes: \`retroscope_pg_data\`, \`retroscope_uploads\`
- Coolify rules: \`expose\` only (no host ports), CPU/memory limits, PostgREST internal-only
- FE facade stub: \`src/lib/backend/getDataClient.ts\`
- \`app_config.backend_provider\` + Admin \`/admin/backend\` toggle (admin-only)
- Coolify env docs (build-time \`VITE_*\` vs runtime secrets)
- Stub storage routes for volume bucket prefixes

## Acceptance
- Compose deploys on Coolify without port conflicts
- Admin can open Backend page; non-admins cannot
- Toggle persists via \`app_config\`; default remains supabase
- Health endpoints green

## Refs
- Plan: \`documentation/plans/self-host-node-postgres-migration-plan.md\`
- Tasks: \`tasks/tasks-self-host-node-postgres.md\` (Phase 1)
`,
  },
  {
    title: "Self-host Phase 2: Local auth (Google + password)",
    description: `Parent: DUN-74 Self hosted migration.

## Goal
Replace hosted Supabase Auth with Node \`/auth/v1/*\` while preserving existing user UUIDs for Google OAuth and email/password users.

## Scope
- Auth schema: users, identities, refresh_tokens, verification codes
- Password signup/login/refresh (bcrypt-compatible with Supabase hashes)
- Google OAuth authorize + callback (Coolify API FQDN redirect URI)
- Password reset email flow
- Import script: Supabase \`auth.users\` / \`auth.identities\` → local (same UUIDs)
- FE auth facade switched by admin backend toggle
- QA: justin.n.loveless@gmail.com Google + password; profile UUID unchanged

## Depends on
- Phase 1 skeleton + toggle
- Coolify API domain for OAuth redirect

## Refs
- Tasks: Phase 2 in \`tasks/tasks-self-host-node-postgres.md\`
`,
  },
  {
    title: "Self-host Phase 3: Local Postgres + PostgREST data path",
    description: `Parent: DUN-74 Self hosted migration.

## Goal
Serve app data from VPS Postgres via PostgREST (Coolify-internal) behind the FE data facade.

## Scope
- Postgres roles + RLS bootstrap (\`anon\`, \`authenticated\`, \`service_role\`)
- Staging \`pg_dump\` / \`pg_restore\` from hosted Supabase
- PostgREST wired to local JWT secret (not publicly routed)
- FE fluent rest client (Supabase-compatible \`.from().select()\` subset)
- Migrate core hooks: profiles, teams, members, notifications, retro CRUD
- Migrate poker + orgs hooks (realtime can still be hosted temporarily)
- RPC parity for FE RPCs (accept invites, get_user_email_if_admin, etc.)

## Depends on
- Phase 1 facade + Phase 2 auth (for local JWT → RLS)

## Refs
- Coverage tracker: \`documentation/plans/self-host-coverage-tracker.md\`
- Tasks: Phase 3
`,
  },
  {
    title: "Self-host Phase 4: Docker-volume storage + critical edge ports",
    description: `Parent: DUN-74 Self hosted migration.

## Goal
Replace Supabase Storage with Docker volume uploads and port P0 admin/notify edge functions to Node.

## Scope
- Serve/sign files from \`retroscope_uploads\` prefixes: avatars, poker-session-chat-images, retro-audio
- Copy existing Supabase Storage objects into the volume; fix public URLs if host changes
- Port P0 edge functions: admin-search-users, admin-send-notification, admin-team-members, invite email/notify
- Optional: Jira/Slack ports only if actively used
- Explicit Stripe decision (keep on Supabase temporarily vs port)

## Depends on
- Phase 1 volume mount + Phase 2 auth + Phase 3 data

## Refs
- Tasks: Phase 4
`,
  },
  {
    title: "Self-host Phase 5: Self-hosted realtime (retro + poker)",
    description: `Parent: DUN-74 Self hosted migration.

## Goal
Replace Supabase Realtime with Node WebSockets so collaborative retro/poker works in self-hosted mode.

## Scope
- Socket.IO (or equivalent) gateway + room model (\`board:{id}\`, \`poker:{sessionId}\`, \`user:{id}\`)
- Postgres LISTEN/NOTIFY or triggers on hot tables
- FE adapter for channel / postgres_changes / presence / broadcast subset used today
- QA: retro voting + poker presence/rounds under \`backend_provider=selfhosted\`

## Depends on
- Phase 1 API + Phase 3 data

## Refs
- 15 channel sites listed in coverage tracker
- Tasks: Phase 5
`,
  },
  {
    title: "Self-host Phase 6: Production cutover & decommission Supabase/Lovable",
    description: `Parent: DUN-74 Self hosted migration.

## Goal
Cut production traffic to Coolify self-hosted stack and cancel hosted Supabase / Lovable after soak.

## Scope
- Coolify volume backups + nightly \`pg_dump\` restore drill (include uploads volume)
- Maintenance window: final dump/restore + object copy
- Flip admin default toggle → \`selfhosted\`; monitor; rollback = flip back
- DNS / stop Lovable publish
- Soak ~2 weeks, then cancel hosted Supabase
- Remove dual-path / hosted-only FE code; coverage tracker 100%

## Depends on
- Phases 2–5 acceptance criteria green

## Refs
- Tasks: Phase 6
- Plan acceptance criteria in \`documentation/plans/self-host-node-postgres-migration-plan.md\`
`,
  },
];

function env(name, fallback) {
  const value = process.env[name];
  if (value == null || value === "") return fallback;
  return value;
}

async function linearGraphQL(apiKey, query, variables = {}) {
  const res = await fetch(LINEAR_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Linear HTTP ${res.status}: ${JSON.stringify(json)}`);
  }
  if (json.errors?.length) {
    throw new Error(`Linear GraphQL errors: ${JSON.stringify(json.errors)}`);
  }
  return json.data;
}

async function resolveTeamAndProject(apiKey, { teamKey, projectName }) {
  const data = await linearGraphQL(
    apiKey,
    `
    query ResolveTeamProject($teamKey: String!) {
      teams(filter: { key: { eq: $teamKey } }) {
        nodes {
          id
          key
          name
          states { nodes { id name type } }
          projects { nodes { id name } }
        }
      }
    }
    `,
    { teamKey }
  );

  const team = data.teams?.nodes?.[0];
  if (!team) throw new Error(`No Linear team found with key "${teamKey}"`);

  const project = (team.projects?.nodes || []).find(
    (p) => p.name.toLowerCase() === projectName.toLowerCase()
  );
  if (!project) {
    const available = (team.projects?.nodes || []).map((p) => p.name).join(", ") || "(none)";
    throw new Error(`No project named "${projectName}" on team ${team.key}. Available: ${available}`);
  }

  return { team, project };
}

async function resolveParentIssue(apiKey, teamId, identifier = "DUN-74") {
  const data = await linearGraphQL(
    apiKey,
    `
    query FindParent($filter: IssueFilter!) {
      issues(filter: $filter, first: 1) {
        nodes { id identifier title url }
      }
    }
    `,
    {
      filter: {
        team: { id: { eq: teamId } },
        number: { eq: Number(String(identifier).split("-").pop()) },
      },
    }
  );
  const issue = data.issues?.nodes?.[0];
  if (!issue) throw new Error(`Could not resolve parent issue ${identifier}`);
  return issue;
}

async function findExistingPhaseIssue(apiKey, teamId, projectId, title) {
  const data = await linearGraphQL(
    apiKey,
    `
    query FindExisting($filter: IssueFilter!) {
      issues(filter: $filter, first: 5) {
        nodes { id identifier title url }
      }
    }
    `,
    {
      filter: {
        team: { id: { eq: teamId } },
        project: { id: { eq: projectId } },
        title: { eq: title },
      },
    }
  );
  return data.issues?.nodes?.[0] || null;
}

async function createLinearIssue(apiKey, input) {
  const data = await linearGraphQL(
    apiKey,
    `
    mutation IssueCreate($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue { id identifier url title }
      }
    }
    `,
    { input }
  );
  if (!data.issueCreate?.success || !data.issueCreate.issue) {
    throw new Error(`issueCreate failed: ${JSON.stringify(data)}`);
  }
  return data.issueCreate.issue;
}

async function markIssueDone(apiKey, issueId, doneStateId) {
  if (!doneStateId) return;
  await linearGraphQL(
    apiKey,
    `
    mutation IssueUpdate($id: String!, $input: IssueUpdateInput!) {
      issueUpdate(id: $id, input: $input) { success }
    }
    `,
    { id: issueId, input: { stateId: doneStateId } }
  );
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const apiKey = env("LINEAR_API_KEY");
  const teamKey = env("LINEAR_TEAM_KEY", "DUN");
  const projectName = env("LINEAR_PROJECT_NAME", "Retroscope");
  const parentOverride = env("LINEAR_PARENT_ID");

  if (!apiKey) {
    console.error("LINEAR_API_KEY is required");
    process.exit(1);
  }

  const { team, project } = await resolveTeamAndProject(apiKey, { teamKey, projectName });
  const doneState = (team.states?.nodes || []).find(
    (s) => s.type === "completed" || /done|complete/i.test(s.name)
  );
  const parent = parentOverride
    ? { id: parentOverride, identifier: "OVERRIDE", title: "override", url: "" }
    : await resolveParentIssue(apiKey, team.id, "DUN-74");

  const results = [];
  for (const phase of PHASES) {
    const existing = await findExistingPhaseIssue(apiKey, team.id, project.id, phase.title);
    if (existing) {
      results.push({ skipped: true, reason: "already exists", issue: existing });
      continue;
    }

    const input = {
      teamId: team.id,
      projectId: project.id,
      parentId: parent.id,
      title: phase.title,
      description: phase.description,
    };

    if (dryRun) {
      results.push({ dryRun: true, input: { ...input, description: `[${phase.description.length} chars]` } });
      continue;
    }

    const issue = await createLinearIssue(apiKey, input);
    if (phase.state === "completed" && doneState?.id) {
      await markIssueDone(apiKey, issue.id, doneState.id);
    }
    results.push({ created: true, issue, markedDone: phase.state === "completed" });
  }

  console.log(
    JSON.stringify(
      {
        parent: { id: parent.id, identifier: parent.identifier, url: parent.url },
        team: { id: team.id, key: team.key },
        project: { id: project.id, name: project.name },
        doneState: doneState ? { id: doneState.id, name: doneState.name } : null,
        results,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
