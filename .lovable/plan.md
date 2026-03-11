

## Endorsement Feature Plan

### Overview
Add a peer endorsement system to retro boards where team members can endorse each other with configurable endorsement types. Includes confetti/sound on receiving endorsements and a leaderboard on the team page.

### Database Schema (3 new tables, 1 migration)

**`endorsement_types`** — configurable per team
- `id` uuid PK
- `team_id` uuid FK → teams
- `name` text (e.g. "Tech Excellence")
- `description` text
- `icon_url` text (logo/image URL)
- `position` integer (ordering)
- `is_default` boolean (seeded defaults)
- `created_at`, `updated_at` timestamps

**`endorsement_settings`** — per-team config
- `id` uuid PK
- `team_id` uuid FK → teams (unique)
- `max_endorsements_per_user_per_board` integer (default 3)
- `created_at`, `updated_at` timestamps

**`endorsements`** — actual endorsements given
- `id` uuid PK
- `board_id` uuid FK → retro_boards
- `team_id` uuid FK → teams
- `endorsement_type_id` uuid FK → endorsement_types
- `from_user_id` uuid (giver)
- `to_user_id` uuid (receiver)
- `created_at` timestamp
- Unique constraint on (board_id, from_user_id, to_user_id, endorsement_type_id)

**3 default endorsement types** seeded per team on creation:
1. "Problem Solver" — Tackles tough technical challenges head-on
2. "Team Player" — Goes above and beyond to help teammates
3. "Innovator" — Brings creative ideas and fresh perspectives

RLS policies: team members can SELECT/INSERT endorsements for their teams; team admins can manage endorsement_types and endorsement_settings.

### Frontend Components

**Retro Board — Endorsement Panel**
- New tab/section or floating button on the retro board (visible during any stage)
- Shows team members with buttons for each endorsement type
- Displays remaining endorsement budget
- Uses Supabase Realtime to detect incoming endorsements

**Confetti & Sound on Endorsement**
- Use `canvas-confetti` npm package for confetti animation
- Play a short celebratory sound via `useAudioPlayer` (a bundled sound file or hosted URL)
- Triggered via Realtime subscription when current user receives an endorsement

**Team Page — Endorsements Leaderboard**
- New "Endorsements" tab alongside Boards/Members/Action Items
- Table/cards showing each member's endorsement counts grouped by type
- Each type displays its icon, name, and count
- Sortable by total or per-type

**Team Settings — Endorsement Configuration**
- New section in TeamSettings page
- CRUD for endorsement types (name, description, icon upload)
- Setting for max endorsements per user per board
- Seed defaults button if team has none

### Technical Details

- **New npm dependency**: `canvas-confetti` for the celebration effect
- **New hook**: `useEndorsements(boardId, teamId)` — manages endorsement data, Realtime subscriptions, and the give/revoke actions
- **New hook**: `useEndorsementTypes(teamId)` — CRUD for endorsement types
- **Realtime**: Subscribe to `endorsements` table inserts filtered by `to_user_id = currentUser.id` to trigger confetti/sound
- **Sound**: Bundle a short MP3 celebration sound in `src/assets/` or use a hosted URL played via `playAudioUrl`

### File Changes Summary

| Area | Files |
|------|-------|
| Migration | 1 new migration (3 tables + seed trigger + RLS) |
| Hooks | `useEndorsements.ts`, `useEndorsementTypes.ts` |
| Retro Board | `EndorsementPanel.tsx` (new), `RetroBoard.tsx` (integrate panel) |
| Team Page | `EndorsementLeaderboard.tsx` (new), `Team.tsx` (add tab) |
| Team Settings | `EndorsementSettings.tsx` (new), `TeamSettings.tsx` (add section) |
| Celebrations | `EndorsementCelebration.tsx` (confetti + sound component) |

