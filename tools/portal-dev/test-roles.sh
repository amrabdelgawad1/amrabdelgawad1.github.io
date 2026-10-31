#!/usr/bin/env bash
# Round 2 and round 7 database checks on a throwaway local Postgres (needs Postgres 15+ binaries; nothing touches Supabase).
#   bash tools/portal-dev/test-roles.sh
# 1. course-dev stubs (auth, storage), every repo migration before the roles one, then live-stubs.sql (what the live
#    database has that the repo doesn't, from the reviewer's exports), then today's team as sample people.
# 2. The roles migration, twice (it must be safe to run again).
# 3. test-roles.sql: every check prints "ok" or the run stops with FAIL.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
DIR="$(mktemp -d)"; PORT="${PORT:-54391}"
trap '"$BIN/pg_ctl" -D "$DIR" stop -m fast >/dev/null 2>&1 || true; rm -rf "$DIR"' EXIT
if [ "$(id -u)" = 0 ]; then chown -R postgres "$DIR"; RUN="runuser -u postgres --"; else RUN=""; fi
$RUN "$BIN/initdb" -D "$DIR" -U postgres -A trust >/dev/null
$RUN "$BIN/pg_ctl" -D "$DIR" -o "-p $PORT -k $DIR" -l "$DIR/log" start >/dev/null
P() { $RUN "$BIN/psql" -h "$DIR" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q "$@"; }
MIG="$ROOT/supabase/migrations/20261030120000_portal_roles.sql"

P -f "$ROOT/tools/course-dev/stubs.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do [ "$f" = "$MIG" ] && break; P -f "$f" >/dev/null; done
P -f "$ROOT/tools/portal-dev/live-stubs.sql"
P <<'SQL'
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-00000000000a', 'owner@example.com'), ('00000000-0000-0000-0000-000000000001', 'a@example.com'),
 ('00000000-0000-0000-0000-000000000002', 'x@example.com'), ('00000000-0000-0000-0000-000000000003', 'l@example.com'),
 ('00000000-0000-0000-0000-000000000004', 't@example.com'), ('00000000-0000-0000-0000-000000000005', 'f@example.com'),
 ('00000000-0000-0000-0000-000000000006', 'n@example.com'), ('00000000-0000-0000-0000-000000000007', 'm@example.com');
insert into public.members (user_id, name, email, active, access) values
 ('00000000-0000-0000-0000-000000000001', 'Agent A', 'a@example.com', true, '{}'),
 ('00000000-0000-0000-0000-000000000002', 'Learner X', 'x@example.com', true, '{learn,mkt}'),
 ('00000000-0000-0000-0000-000000000003', 'Live L', 'l@example.com', true, '{live}'),
 ('00000000-0000-0000-0000-000000000004', 'Team T', 't@example.com', true, '{team}'),
 ('00000000-0000-0000-0000-000000000005', 'Off F', 'f@example.com', false, '{live}');
insert into public.shifts (name, owner) values ('Amr', true), ('Agent A', false);
insert into public.learn_progress (user_id, course, data) values
 ('00000000-0000-0000-0000-000000000002', 'mkt2', '{"m":{"m01":{"quiz":{"best":85},"asg":{"done":true}},"m02":{"quiz":{"best":70}}}}'),
 ('00000000-0000-0000-0000-000000000001', 'psy', '{"kv":{"done:m1:exam":"1","exam:m2":"17","best:m3":"12","pad:m1":"private notes","ink:m1":"[drawing]"}}'),
 ('00000000-0000-0000-0000-00000000000a', 'psy', '{"kv":{}}');
SQL
echo "== migration, first run"; P -f "$MIG"
echo "== migration, second run"; P -f "$MIG"
P <<'SQL'
-- after the migration: a new invite (sent with the old role name) and a manager, and three requests
insert into public.members (user_id, name, email, active, access, role) values
 ('00000000-0000-0000-0000-000000000006', 'New N', 'n@example.com', true, '{}', 'member'),
 ('00000000-0000-0000-0000-000000000007', 'Manager M', 'm@example.com', true, '{}', 'manager');
insert into public.shift_requests (user_id, name, status) values
 ('00000000-0000-0000-0000-000000000001', 'A day', 'pending'), ('00000000-0000-0000-0000-000000000007', 'M day', 'pending'),
 ('00000000-0000-0000-0000-000000000006', 'N day', 'pending');
SQL
echo "== checks"; P -f "$ROOT/tools/portal-dev/test-roles.sql" 2>&1 | sed -n 's/^psql:[^:]*:[0-9]*: NOTICE:  /  /p; s/^.*ERROR: *//p'
# ---------- round 7: the Deal CRM as a team, and the weekly board ----------
MIG7="$ROOT/supabase/migrations/20261030160000_portal_deals_team.sql"
echo "== round 7 migration, first run"; P -f "$MIG7"
echo "== round 7 migration, second run"; P -f "$MIG7"
echo "== round 7 checks"; P -f "$ROOT/tools/portal-dev/test-deals.sql" 2>&1 | sed -n 's/^psql:[^:]*:[0-9]*: NOTICE:  /  /p; s/^.*ERROR: *//p'
# ---------- phase 0: logs ----------
MIGL="$ROOT/supabase/migrations/20261031090000_portal_logs.sql"
echo "== logs migration, first run"; P -f "$MIGL"
echo "== logs migration, second run"; P -f "$MIGL"
P -f "$ROOT/supabase/migrations/20261031100000_portal_signins.sql"
echo "== logs checks"; P -f "$ROOT/tools/portal-dev/test-logs.sql" 2>&1 | sed -n 's/^psql:[^:]*:[0-9]*: NOTICE:  /  /p; s/^.*ERROR: *//p'
# ---------- phase 1: call counter ----------
MIGC="$ROOT/supabase/migrations/20261031110000_call_events.sql"
P -f "$MIGC"; P -f "$MIGC"
echo "== call counter checks"; P -f "$ROOT/tools/portal-dev/test-calls.sql" 2>&1 | sed -n 's/^psql:[^:]*:[0-9]*: NOTICE:  /  /p; s/^.*ERROR: *//p'
MIGT="$ROOT/supabase/migrations/20261031120000_calls_today.sql"
P -f "$MIGT"; P -f "$MIGT"
echo "== calls today checks"; P -f "$ROOT/tools/portal-dev/test-calls-today.sql" 2>&1 | sed -n 's/^psql:[^:]*:[0-9]*: NOTICE:  /  /p; s/^.*ERROR: *//p'
MIGD="$ROOT/supabase/migrations/20261031130000_dnc.sql"
P -f "$MIGD"; P -f "$MIGD"
echo "== do-not-call checks"; P -f "$ROOT/tools/portal-dev/test-dnc.sql" 2>&1 | sed -n 's/^psql:[^:]*:[0-9]*: NOTICE:  /  /p; s/^.*ERROR: *//p'
MIGF="$ROOT/supabase/migrations/20261031140000_feedback_announcements.sql"
P -f "$MIGF"; P -f "$MIGF"
echo "== feedback and announcement checks"; P -f "$ROOT/tools/portal-dev/test-feedback.sql" 2>&1 | sed -n 's/^psql:[^:]*:[0-9]*: NOTICE:  /  /p; s/^.*ERROR: *//p'
MIGB="$ROOT/supabase/migrations/20261031150000_buyers.sql"
P -f "$MIGB"; P -f "$MIGB"
echo "== buyers checks"; P -f "$ROOT/tools/portal-dev/test-buyers.sql" 2>&1 | sed -n 's/^psql:[^:]*:[0-9]*: NOTICE:  /  /p; s/^.*ERROR: *//p'
MIGS="$ROOT/supabase/migrations/20261031160000_deals_split.sql"
P -f "$MIGS"; P -f "$MIGS"
echo "== deals split checks"; P -f "$ROOT/tools/portal-dev/test-deals-split.sql" 2>&1 | sed -n 's/^psql:[^:]*:[0-9]*: NOTICE:  /  /p; s/^.*ERROR: *//p'
MIGY="$ROOT/supabase/migrations/20261031170000_today.sql"
P -f "$MIGY"; P -f "$MIGY"
echo "== today checks"; P -f "$ROOT/tools/portal-dev/test-today.sql" 2>&1 | sed -n 's/^psql:[^:]*:[0-9]*: NOTICE:  /  /p; s/^.*ERROR: *//p'
MIGE="$ROOT/supabase/migrations/20261031180000_eod.sql"
P -f "$MIGE"; P -f "$MIGE"
echo "== end-of-day checks"; P -f "$ROOT/tools/portal-dev/test-eod.sql" 2>&1 | sed -n 's/^psql:[^:]*:[0-9]*: NOTICE:  /  /p; s/^.*ERROR: *//p'
MIGX="$ROOT/supabase/migrations/20261031190000_shift_dupes.sql"
P -f "$MIGX"; P -f "$MIGX"
echo "== shift saved once checks"; P -f "$ROOT/tools/portal-dev/test-shift-dupes.sql" 2>&1 | sed -n 's/^psql:[^:]*:[0-9]*: NOTICE:  /  /p; s/^.*ERROR: *//p'
echo "== all checks passed"
