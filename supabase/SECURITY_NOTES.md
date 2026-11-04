# Supabase advisor review (Nov 4, 2026)

Project `ztlpgyomjuzmjmuifbbd` (team-tracker). What was fixed, and why each remaining finding stays.

## Fixed

- **Function search_path (10 private functions):** pinned to `public, pg_temp`.
- **Private schema:** every `private.*` function revoked from `public`, `anon` and `authenticated`; schema usage revoked from those roles too. Checked that no policy or non-definer function depends on it.
- **Per-row `auth.uid()` in RLS (63 policies, public and storage):** rewritten as `(select auth.uid())`. Same rules, evaluated once per query.
- **Unindexed foreign keys (28):** indexes added.

## Left on purpose

| Finding | Why it stays |
|---|---|
| Leaked-password protection off | Dashboard setting, not reachable from SQL. Turn it on in Authentication, then password security (needs the Pro plan). |
| 8 `SECURITY DEFINER` functions callable by `anon` | All used by pages that run signed out: the shift tracker on a company code (`check_team_code`, `code_add_brief`, `code_live_check`, `code_live_update`, `log_shift`, `team_agents`; guesses are limited through `private.code_attempts`), site stats (`log_visit`, capped at 120 rows an hour per device) and public certificate lookup (`certificate_check`, returns no name for revoked certificates). |
| 114 `SECURITY DEFINER` functions callable by signed-in users | The app's API. Each checks the caller (sign-in, admin, company code or a tool-access helper). The only one without a check is `fx_rate_on`, which returns an exchange rate. |
| RLS on with no policies (23 tables) | Intended: these tables are only read and written through definer functions (course content, private logs, secrets, backups). No direct access is the point. |
| Multiple permissive SELECT policies (17 tables) | Each table has an owner/admin policy plus a member policy. Merging them changes who can see what, so it isn't worth the risk at this size. |
| Unused indexes (36) | The site is new and quiet; most are the foreign-key indexes added today. Review in a few months. |
| No primary key (8 tables) | Seven are dated backups; `private.code_attempts` is an append-only attempt log. |
