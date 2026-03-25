# Poker local advisor server

Minimal HTTP server for the **Poker local CLI advisor** feature in Retroscope. The web app sends JSON ticket context from your browser to **your machine only** (`localhost`). This process forwards the payload to a command you configure (Claude Code CLI, Gemini CLI, a shell script, etc.) and returns JSON to the app.

**End users (no source code):** download **`poker-local-advisor.zip`** from Retroscope **Account → Poker advisor** or the poker session advisor panel, then follow **`INSTALL.md`** inside the zip.

## Contract

### `POST /advise`

**Request** (`application/json`):

| Field | Type | Description |
|--------|------|-------------|
| `roundId` | string | Poker round row id — echoed on responses for correlation |
| `ticketKey` | string | Issue key (e.g. `PROJ-123`) |
| `ticketTitle` | string \| null | Summary |
| `parentKey` | string \| null | Parent issue key |
| `parentSummary` | string \| null | Parent summary |
| `description` | string \| null | Optional longer text (e.g. Jira description) |
| `roundNumber` | number | Round index |
| `gameState` | `"Selection"` \| `"Playing"` | Current round |
| `teamPrompt` | string \| null | Team-wide instructions (Team settings) |
| `personalPrompt` | string \| null | Per-user instructions (Account) |
| `combinedPrompt` | string \| null | `teamPrompt` + `personalPrompt` merged (team first); null if both empty |

**Response** (`application/json`):

| Field | Type | Description |
|--------|------|-------------|
| `points` | number | Fibonacci estimate (1, 2, 3, 5, 8, 13, 21) or `-1` to abstain |
| `reasoning` | string | Short explanation (only you see this in the app) |
| `abstain` | boolean (optional) | If true, treat as abstain |
| `roundId` | string | Echoed from the request (reference server merges this for every response) |
| `ticketKey` | string | Echoed from the request |
| `roundNumber` | number | Echoed from the request |

**CORS**: The server must respond with `Access-Control-Allow-Origin` suitable for your app (this implementation uses `*` for local development).

## Run

```bash
cd tools/poker-local-advisor
node server.mjs
```

Defaults: `PORT=17300`, stub mode unless `POKER_ADVISOR_HANDLER` is set.

### Environment

| Variable | Description |
|----------|-------------|
| `PORT` | Listen port (default `17300`) |
| `POKER_ADVISOR_HANDLER` | Optional path to an executable. Receives the JSON request body on **stdin**; must print **one JSON object** on **stdout** (same shape as response above). |

### Bundled handlers (Claude Code & Gemini CLI)

These scripts read the same JSON stdin as the server, call the respective CLI with a planning-poker prompt, then print normalized JSON to stdout.

| Script | CLI | Requirements |
|--------|-----|----------------|
| [`handlers/run-claude-code.sh`](handlers/run-claude-code.sh) | [Claude Code](https://docs.anthropic.com/en/docs/claude-code/cli-usage) `claude -p …` | `claude` on `PATH`, auth configured |
| [`handlers/run-gemini-cli.sh`](handlers/run-gemini-cli.sh) | [Gemini CLI](https://google-gemini.github.io/gemini-cli/) `gemini -p …` | `gemini` on `PATH`, auth configured |

```bash
cd tools/poker-local-advisor
chmod +x handlers/run-claude-code.sh handlers/run-gemini-cli.sh

# Claude Code (default binary name: claude)
POKER_ADVISOR_HANDLER="$(pwd)/handlers/run-claude-code.sh" node server.mjs

# Or Gemini CLI
POKER_ADVISOR_HANDLER="$(pwd)/handlers/run-gemini-cli.sh" node server.mjs
```

Optional environment (see comments at top of each `handlers/*.mjs`):

| Variable | Used by | Purpose |
|----------|---------|---------|
| `CLAUDE_BIN` | `claude-code.mjs` | Override binary (default `claude`) |
| `CLAUDE_ARGS` | `claude-code.mjs` | Extra args, space-separated (e.g. `--bare`) |
| `GEMINI_BIN` | `gemini-cli.mjs` | Override binary (default `gemini`) |
| `GEMINI_ARGS` | `gemini-cli.mjs` | Extra args, space-separated |

The model is instructed to return **only** JSON: `{"points": N, "reasoning": "...", "abstain": false}`. The handler tolerates markdown fences or extra text by extracting the first JSON object from stdout.

**Windows:** run via `node handlers/claude-code.mjs` from a `.cmd` wrapper, or use WSL/Git Bash with the shell scripts above.

### Custom handler

```bash
#!/usr/bin/env bash
# Read stdin, call your CLI, output JSON to stdout
INPUT=$(cat)
echo "$INPUT" | your-cli --json
```

```bash
chmod +x handler.sh
POKER_ADVISOR_HANDLER=./handler.sh node server.mjs
```

## Account settings

In Retroscope: **Account → Poker advisor**, set your local server URL to `http://127.0.0.1:17300` (or your port), enable the advisor, and acknowledge the data-sharing notice.
