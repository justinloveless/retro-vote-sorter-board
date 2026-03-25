# Install the Retroscope poker local advisor (no app source code required)

You only need **Node.js 18+** on your computer ([download Node](https://nodejs.org/)).

## 1. Download

Download **`poker-local-advisor.zip`** from your Retroscope **Account** page (Poker advisor section) or from the poker session advisor panel, then unzip it.

You should see a folder named `poker-local-advisor` containing `server.mjs`, `README.md`, and a `handlers` folder.

## 2. Run the server

Open a terminal, go into that folder, and start the server:

```bash
cd poker-local-advisor
node server.mjs
```

By default it listens on **http://127.0.0.1:17300** (only your machine).

Optional: use a Claude or Gemini handler (see `README.md` inside the folder):

```bash
chmod +x handlers/run-claude-code.sh
POKER_ADVISOR_HANDLER="$(pwd)/handlers/run-claude-code.sh" node server.mjs
```

## 3. Connect Retroscope

1. In Retroscope, open **Account** → **Poker advisor (local CLI)**.
2. (Optional) Set **personal advisor instructions** here; team owners can set a **team prompt** under **Team settings**—both are sent in each `POST /advise` JSON with ticket fields.
3. Enter the base URL (usually **`http://127.0.0.1:17300`**). Change the port here if you started the server on a different port.
4. Acknowledge data sharing, then enable the advisor and **Save**.
5. Open a team poker session—the **Private advisor** panel at the bottom should contact your local server.

## Troubleshooting

- **Connection failed**: Confirm the server is running and the URL in Account matches (including `http://` and port).
- **Firewall**: The browser talks to your own PC only; allow Node if your OS asks.
- **HTTPS site**: Browsers usually allow `http://127.0.0.1` from HTTPS pages; if not, try another browser or run Retroscope on `http://localhost` for development.

For advanced options (custom handlers, env vars), read `README.md` in this folder.
