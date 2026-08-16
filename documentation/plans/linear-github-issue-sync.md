# Linear ← GitHub issue creation (DUN-68)

## Goal

Whenever a GitHub issue is created on `justinloveless/retro-vote-sorter-board`, automatically create a corresponding Linear issue on the **Retroscope** project (DUN team).

## Verdict

**Yes — this is supported natively by Linear**, with no repo code required for the core flow.

Linear’s **GitHub Issues Sync** maps a GitHub repository to a Linear **team**. New GitHub issues create synced Linear issues going forward (historical issues need a separate import).

Native sync targets a **team**, not a **project**. Retroscope is a Linear project, so after sync is enabled you either:

1. Manually (or via Triage) put synced issues on Retroscope, or
2. Use a Triage rule / custom GitHub Action to set `project = Retroscope` automatically.

## Recommended approach: Linear GitHub Issues Sync (one-way)

Prefer this unless you need project assignment without a Business/Enterprise Triage plan.

### Why this approach

- Official, maintained by Linear
- Bi-directional comments/status/labels/assignee on the synced issue thread
- No API keys or workflow maintenance in this repo
- Available on all Linear plans for the sync itself

### Setup (Linear admin + GitHub admin)

1. Open [Linear → Settings → Integrations → GitHub](https://linear.app/settings/integrations/github).
2. Enable/install the Linear GitHub app if it is not already installed.
3. Grant the app access to `justinloveless/retro-vote-sorter-board` (repo admin or org owner).
4. Under **GitHub Issues**, click **+**.
5. Select:
   - **Repository:** `justinloveless/retro-vote-sorter-board`
   - **Linear team:** DUN (Dungeon Dwellers)
   - **Direction:** **One-way** (GitHub → Linear)
6. Save.

Docs: [Configure GitHub Issues Sync](https://linear.app/docs/github#configure-github-issues-sync)

### Put synced issues on the Retroscope project

Native sync does **not** let you pick a Linear project in the mapping UI. Options:

| Method | Notes |
| --- | --- |
| **Triage rule** | Team Settings → Triage → Rules. When issues enter Triage from the GitHub sync, set **Project = Retroscope**. Requires Business/Enterprise. |
| **Triage Intelligence** | Can suggest/auto-apply project. Business/Enterprise. |
| **Manual accept** | Accept from Triage and set project Retroscope. Works on all plans. |
| **Custom Action (this PR)** | Creates Linear issues with `projectId` set to Retroscope via the Linear API. Use only if you are **not** using native sync (to avoid duplicates). |

### Important limitations

- Sync applies to **newly created** GitHub issues only. Import existing ones via [GitHub Issues Importer](https://linear.app/docs/github-to-linear) if needed.
- One-way: multiple GitHub repos can feed one Linear team.
- Two-way: a Linear team can sync with only **one** GitHub repo at a time. Prefer one-way unless you need Linear→GitHub creation.
- Only one Linear workspace can be connected to a given GitHub organization (GitHub App install limit).
- Custom GitHub Project statuses do not map into Linear workflow states.

### Properties that sync

Title, description, status (open/closed), assignee (when personal GitHub accounts are linked), labels, sub-issues, and comments in the synced thread.

## Alternative: GitHub Action → Linear API

Use this when you need issues created **directly on the Retroscope project** and do not want native sync (or Triage rules are unavailable).

Workflow: `.github/workflows/sync-github-issue-to-linear.yml`  
Script: `scripts/create-linear-issue-from-github.mjs`

### Required GitHub secrets / vars

| Name | Type | Description |
| --- | --- | --- |
| `LINEAR_API_KEY` | Secret | Personal API key from Linear → Settings → Account → Security & access → Personal API keys |
| `LINEAR_TEAM_KEY` | Variable (optional) | Defaults to `DUN` |
| `LINEAR_PROJECT_NAME` | Variable (optional) | Defaults to `Retroscope` |

Do **not** enable this workflow while native GitHub Issues Sync is also creating Linear issues for the same repo, or you will get duplicates.

### Behavior

On `issues: opened`:

1. Resolve team by key (`DUN`) and project by name (`Retroscope`).
2. Create a Linear issue with title/body from the GitHub issue, including a link back to GitHub.
3. Comment on the GitHub issue with the new Linear identifier/URL (best-effort).

This path creates a Linear issue; it does **not** establish Linear’s native synced-comment attachment unless you later link them manually.

## Recommendation for Retroscope

1. Enable **one-way** GitHub Issues Sync for `retro-vote-sorter-board` → DUN.
2. If the workspace has Triage rules: auto-set **Project = Retroscope**.
3. If not: either accept into Retroscope manually, or enable the Action in this PR and leave native Issues Sync **off** for this repo.

## Verification checklist

After enabling native sync (or the Action):

1. Open a throwaway GitHub issue on `retro-vote-sorter-board`.
2. Confirm a Linear issue appears on team DUN within a minute or two.
3. Confirm it is (or gets) on project **Retroscope**.
4. Close the GitHub issue and confirm Linear status updates (native sync only).
5. Delete/cancel the throwaway issues.

## References

- [Linear GitHub docs](https://linear.app/docs/github)
- [GitHub Issues Sync overview](https://linear.app/integrations/github)
- [Import / sync options](https://linear.app/docs/github-to-linear)
- [Triage rules](https://linear.app/docs/triage#triage-rules)
