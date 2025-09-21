## Development Process For Each Task (C# Passthrough API + Front End)

Audience: Junior developer. Follow every step exactly. Do not skip steps.

### Prerequisites (install once)

- Git (configured with your name/email)
- Node.js 18+ and npm 9+ (or Bun if the repo uses it; default to npm here)
- .NET SDK 8
- Docker (optional for local containers)

Verify versions:
```bash
git --version
node -v
npm -v
dotnet --version
```

### 0) Sync main and create your branch

Run these from the repo root (`/Users/justin.loveless/Code/justinloveless`).

```bash
git checkout main
git pull --rebase origin main
git status | cat
```

If there are local changes, commit or stash them before continuing.

Create a new branch. Use this exact naming format:

`<type>/<area>-<short-desc>-<task-number>`

- `<type>`: feature | fix | chore | docs | refactor
- `<area>`: api | fe | retro | poker | slack | notifications | teams | storage
- `<short-desc>`: hyphenated summary
- `<task-number>`: the number from `tasks/tasks-csharp-pass-through-api.md`

Example:
```bash
git checkout -b feature/api-notifications-mark-read-22
```

### 1) Open and update the task row

1. Open `tasks/tasks-csharp-pass-through-api.md`.
2. Find your row by task number.
3. Set Status to `In progress`.
4. In Notes, paste a link to this process doc and the plan:
   - `documentation/plans/development-process.md`
   - `documentation/plans/csharp-pass-through-api-plan.md`

Commit the status change immediately:
```bash
git add tasks/tasks-csharp-pass-through-api.md
git commit -m "chore(tasks): start Task #22 (set In progress)"
```

### 2) Environment and configuration

API (.NET):
- Add development settings in `api/src/Retroscope.Api/appsettings.Development.json` or use `dotnet user-secrets`.
- Required: `SUPABASE_URL`, `SUPABASE_JWKS_URL`, `SUPABASE_POSTGREST_URL`, `SUPABASE_FUNCTIONS_URL`, `ALLOW_ORIGINS`.

Front end (Vite):
- Create/edit `.env.local` in repo root:
```
VITE_USE_CSHARP_API=true
VITE_API_BASE_URL=http://localhost:5099
```

### 3) Baseline checks before coding

API:
```bash
cd api
dotnet restore
dotnet build
dotnet test
cd ..
```

Front end:
```bash
npm ci
npm run lint || npx eslint .
npm run build || echo "No build script; skip"
```

If any command fails, fix the issue before continuing.

### 4) Implement using TDD (test-driven development)

Follow this loop until the task is complete. Do not skip tests.

API tasks (controllers/gateway):
1. Write a failing unit test in `tests/Retroscope.Api.UnitTests` for your controller route/auth.
2. Run `dotnet test` (it should fail).
3. Implement the controller in `src/Retroscope.Api` to satisfy the test.
4. Write/adjust integration tests in `tests/Retroscope.Api.IntegrationTests` using WireMock to stub Supabase responses.
5. Implement/adjust `SupabaseGateway` in `src/Retroscope.Infrastructure` to match contracts.
6. Run `dotnet test` until all tests pass.

Front-end tasks (flagged migration):
1. Write/adjust a unit test to assert the hook/component calls the C# API path when `VITE_USE_CSHARP_API === 'true'`.
2. Implement the change using the functions in `src/lib/apiClient.ts`.
3. Run `npm run test` (or your project’s test command) until green.

### 5) Full local validation (must be green)

API:
```bash
cd api
dotnet build
dotnet test
cd ..
```

Front end:
```bash
npm run lint || npx eslint .
npm run build || echo "No build script; skip"
npm run test || echo "No test script; skip"
```

Manual smoke:
```bash
cd api && dotnet run --project src/Retroscope.Api &
API_PID=$!
cd ..
npm run dev & DEV_PID=$!
sleep 5
# Use the app briefly to hit your endpoints, then:
kill $DEV_PID || true
kill $API_PID || true
```

### 6) Update coverage tracker

Open `documentation/plans/csharp-api-coverage-tracker.md` and either:
- Add a new row for the Supabase call you migrated, or
- Change `Status` to `Covered`/`Switched` for existing rows.

Commit the tracker changes:
```bash
git add documentation/plans/csharp-api-coverage-tracker.md
git commit -m "docs(tracker): update coverage for Task #22"
```

### 7) Commit your code with clear messages

Use small, focused commits. Include the task number.
```bash
git add -A
git commit -m "feat(api): add notifications mark-as-read controller (Task #22)"
```

### 8) Rebase on latest main if needed

```bash
git fetch origin
git rebase origin/main
# Resolve conflicts, then:
git add -A
git rebase --continue
```

Run validations again (Section 5) after a rebase.

### 9) Push and open a pull request

```bash
git push -u origin $(git branch --show-current)
```

Open a PR with this format:
- Title: `feat(api): <summary> (Task #22)`
- Description:
  - What changed and why (link the plan section)
  - Test coverage summary (unit + integration + FE if applicable)
  - Links to updated files: tasks row and coverage tracker

Set PR labels and request reviewers.

### 10) Mark task as In Review

Edit `tasks/tasks-csharp-pass-through-api.md` and set your task Status to `In review`. Commit:
```bash
git add tasks/tasks-csharp-pass-through-api.md
git commit -m "chore(tasks): Task #22 → In review"
git push
```

### 11) Respond to review, fix CI, and iterate

- If CI fails, reproduce locally and fix. Re-run Section 5.
- Address comments with new commits. Do not force-push unless asked.
- Keep PR small and focused. If scope grows, split into follow-ups.

### 12) Merge and clean up

- Rebase on main one last time if requested by reviewers.
- Use “Squash and merge” with a clear message including the task number.
- After merge:
  - Pull main: `git checkout main && git pull --rebase origin main`
  - Delete your branch locally and on origin: `git branch -D <branch>` and `git push origin --delete <branch>`
  - Update `tasks/tasks-csharp-pass-through-api.md` to `Done` and add any final Notes (links to PR, any follow-ups). Commit to main if permitted or include in your next branch if required by policy.
  - Update the coverage tracker Status to `Switched` or `Deprecated` as appropriate.

### 13) Rollback / hotfix (if needed)

- To rollback a merge: coordinate with repo owner, then `git revert <merge_commit_sha>` and open a PR.
- For hotfixes: branch from `main` (`fix/...`), keep the change minimal, add tests, and follow the same PR steps.

### 14) Common pitfalls checklist (check these before PR)

- [ ] All API routes have `[Authorize]` and validate JWT against Supabase JWKS.
- [ ] Forward the exact `Authorization` header to Supabase for RLS.
- [ ] Include and propagate `X-Correlation-Id`; generate one if missing.
- [ ] DTO fields exactly match the plan’s contracts.
- [ ] Error mapping uses the standard error envelope and correct status codes.
- [ ] Feature flag respected in front end; old path still works when flag=false.
- [ ] Coverage tracker updated; task row updated.
- [ ] No secrets committed. `.env.local` not committed.

### 15) Quick command reference

```bash
# Sync main
git checkout main && git pull --rebase origin main

# Create branch
git checkout -b feature/api-notifications-mark-read-22

# API build & test
cd api && dotnet build && dotnet test && cd ..

# Front-end lint/test/build
npm ci && npm run lint || npx eslint .
npm run test || echo "No test script; skip"
npm run build || echo "No build script; skip"

# Push and PR
git push -u origin $(git branch --show-current)
```


