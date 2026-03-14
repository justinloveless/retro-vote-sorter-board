

# Jira Backlog Queue for Poker Sessions

## Overview
Add a persistent, team-level Jira ticket queue that lets users browse their Jira board, select issues, reorder them, and automatically advance through them during poker rounds.

## Architecture

### 1. New Edge Function: `get-jira-board-issues`
A new Supabase edge function that searches/lists issues from a configured Jira board or project. It will:
- Accept `teamId`, optional `boardId` or `projectKey`, and optional search/filter params (JQL)
- Reuse the existing pattern from `get-jira-issue` to fetch team Jira credentials
- Call `GET /rest/api/2/search?jql=...` to return a paginated list of issues (key, summary, status, priority, assignee, story points)
- Support filtering by status (e.g. exclude Done), and text search

### 2. New DB Table: `poker_ticket_queue`
Stores the ordered queue of tickets per team.

```sql
CREATE TABLE public.poker_ticket_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  ticket_key text NOT NULL,
  ticket_summary text,
  position integer NOT NULL DEFAULT 0,
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.poker_ticket_queue ENABLE ROW LEVEL SECURITY;

-- Team members can view
CREATE POLICY "Team members can view queue"
  ON public.poker_ticket_queue FOR SELECT TO authenticated
  USING (is_team_member(team_id, auth.uid()));

-- Team members can manage
CREATE POLICY "Team members can manage queue"
  ON public.poker_ticket_queue FOR ALL TO authenticated
  USING (is_team_member(team_id, auth.uid()))
  WITH CHECK (is_team_member(team_id, auth.uid()));
```

### 3. New Column on `teams` Table
Add `jira_board_id` (text, nullable) to store the default Jira board/project to browse. Configured in team settings alongside existing Jira fields.

### 4. Team Settings Update
Add a "Jira Board ID" field to `JiraSettingsForm.tsx` so admins can configure which board/project to browse issues from.

### 5. New UI Component: `TicketQueuePanel`
A drawer/sheet accessible from the poker table that contains:
- **Browse tab**: Fetches issues from the configured Jira board via the new edge function. Shows a searchable, scrollable list with key, summary, status, and an "Add to queue" button per issue.
- **Queue tab**: Shows the current ordered queue with drag-to-reorder (using native HTML drag-and-drop or a lightweight approach). Each item shows ticket key + summary, with a remove button. The top item is "up next".

This will be accessible via a new button on the poker table UI (e.g. a "Queue" or "Backlog" icon button near the ticket number input).

### 6. Hook: `useTicketQueue`
Manages CRUD operations on `poker_ticket_queue` for the current team:
- `fetchQueue()` — loads ordered queue items
- `addTicket(key, summary)` — inserts at the end
- `removeTicket(id)` — deletes an item
- `reorderQueue(items)` — batch updates positions
- `popNext()` — removes and returns the first item
- Subscribes to realtime changes so all session participants see queue updates

### 7. Auto-Advance Integration
When the user clicks "Next Round":
- If there are items in the queue, skip the `NextRoundDialog` entirely
- Pop the first ticket from the queue and pass its key directly to `nextRound(ticketKey)`
- If the queue is empty, fall back to the existing dialog behavior

This requires a small change in `PokerTable.tsx`: before opening the dialog, check if there's a queued ticket. If so, call `handleNextRoundConfirm` with it directly.

### Files to Create
- `supabase/functions/get-jira-board-issues/index.ts`
- `src/hooks/useTicketQueue.ts`
- `src/components/Neotro/TicketQueuePanel.tsx`

### Files to Modify
- `src/components/team/JiraSettingsForm.tsx` — add `jira_board_id` field
- `src/pages/TeamSettings.tsx` — include new field in save/load
- `src/components/Neotro/PokerTable.tsx` — integrate queue auto-advance
- `src/components/Neotro/PokerTableComponent/context.tsx` — expose queue state
- `src/components/Neotro/PokerTableComponent/DesktopView.tsx` — add queue button
- `src/components/Neotro/PokerTableComponent/MobileView.tsx` — add queue button
- DB migration for new table + teams column

