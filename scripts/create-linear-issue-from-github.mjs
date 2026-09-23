#!/usr/bin/env node
/**
 * Create a Linear issue (Retroscope project by default) from a GitHub issue payload.
 *
 * Env:
 *   LINEAR_API_KEY          (required)
 *   LINEAR_TEAM_KEY         (default: DUN)
 *   LINEAR_PROJECT_NAME     (default: Retroscope)
 *   GITHUB_ISSUE_TITLE      (required unless --dry-run with fixtures)
 *   GITHUB_ISSUE_BODY
 *   GITHUB_ISSUE_URL
 *   GITHUB_ISSUE_NUMBER
 *   GITHUB_REPOSITORY
 *
 * CLI:
 *   --dry-run   Resolve IDs / print mutation input without creating
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

const LINEAR_API = "https://api.linear.app/graphql";

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

export function buildIssueDescription({ body, issueUrl, issueNumber, repository }) {
  const parts = [];
  if (body?.trim()) parts.push(body.trim());
  parts.push("---");
  parts.push(`Synced from GitHub issue [#${issueNumber}](${issueUrl}) in \`${repository}\`.`);
  return parts.join("\n\n");
}

export async function resolveTeamAndProject(apiKey, { teamKey, projectName }) {
  const data = await linearGraphQL(
    apiKey,
    `
    query ResolveTeamProject($teamKey: String!) {
      teams(filter: { key: { eq: $teamKey } }) {
        nodes {
          id
          key
          name
          projects {
            nodes {
              id
              name
            }
          }
        }
      }
    }
    `,
    { teamKey }
  );

  const team = data.teams?.nodes?.[0];
  if (!team) {
    throw new Error(`No Linear team found with key "${teamKey}"`);
  }

  const project = (team.projects?.nodes || []).find(
    (p) => p.name.toLowerCase() === projectName.toLowerCase()
  );
  if (!project) {
    const available = (team.projects?.nodes || []).map((p) => p.name).join(", ") || "(none)";
    throw new Error(
      `No project named "${projectName}" on team ${team.key}. Available: ${available}`
    );
  }

  return { team, project };
}

export async function createLinearIssue(apiKey, input) {
  const data = await linearGraphQL(
    apiKey,
    `
    mutation IssueCreate($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue {
          id
          identifier
          url
          title
        }
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

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const apiKey = env("LINEAR_API_KEY");
  const teamKey = env("LINEAR_TEAM_KEY", "DUN");
  const projectName = env("LINEAR_PROJECT_NAME", "Retroscope");
  const title = env("GITHUB_ISSUE_TITLE");
  const body = env("GITHUB_ISSUE_BODY", "");
  const issueUrl = env("GITHUB_ISSUE_URL", "");
  const issueNumber = env("GITHUB_ISSUE_NUMBER", "");
  const repository = env("GITHUB_REPOSITORY", "justinloveless/retro-vote-sorter-board");

  if (!apiKey) {
    console.error("LINEAR_API_KEY is required");
    process.exit(1);
  }
  if (!title) {
    console.error("GITHUB_ISSUE_TITLE is required");
    process.exit(1);
  }

  const { team, project } = await resolveTeamAndProject(apiKey, { teamKey, projectName });
  const input = {
    teamId: team.id,
    projectId: project.id,
    title,
    description: buildIssueDescription({ body, issueUrl, issueNumber, repository }),
  };

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          team: { id: team.id, key: team.key, name: team.name },
          project: { id: project.id, name: project.name },
          input,
        },
        null,
        2
      )
    );
    return;
  }

  const issue = await createLinearIssue(apiKey, input);
  console.log(JSON.stringify({ success: true, issue }, null, 2));
}

const isDirectRun =
  !!process.argv[1] &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);

if (isDirectRun) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
