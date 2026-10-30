# Staging (the test copy)

Supabase project **"staging (test copy of team-tracker)"**, ref `klwwylrqltuqvijzriov`. It's the second project on the free plan; it was the empty "Marketing Course" project.

It holds the live database's **structure** only: tables, functions, rules, grants and storage buckets. It has no live data, no users and no files. Scheduled jobs (pg_cron), edge functions (`team-access`) and Auth settings aren't copied, so it never sends emails or runs live jobs.

## Every round

1. Run the round's migration on staging first, then a read-only check as the owner:
   ```sql
   select set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'aal', 'aal2', 'role', 'authenticated',
     'email', substring(pg_get_functiondef('public.is_tracker_admin()'::regprocedure) from '''([^'']+@[^'']+)'''))::text, false);
   ```
   This sets the owner's sign-in without anyone typing the address, because it's read from `is_tracker_admin()`.
2. Only then run it on live.
3. Add a line to the change log on live: `select public.log_change('<title>', '<what>', '<migration file>', '<PR link>');`

## Refreshing staging from live

1. In live's SQL editor, run `export-schema.sql`. It's read-only, and it returns one text cell: the whole structure as a script.
2. Run that script in staging's SQL editor. It creates what's missing and leaves what's there.
3. Run `export-schema.sql` on staging and compare it with live's. They should match line for line. The one known difference: staging's `service_role` has a few extra table grants. The site never uses that role.

To rebuild staging from scratch, drop and recreate its `public` schema first, then do step 2.

The script was tested on a local Postgres: export, apply to an empty database, export again. The two exports were identical.
