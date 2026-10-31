-- Phase 0: sign-ins in Amr's activity log. This project doesn't keep Supabase's own sign-in history in the database
-- (auth.audit_log_entries is empty), so the portal notes it: portal-shell.js calls log_sign_in() once per browser tab,
-- and the database keeps at most one line per person every 6 hours. Only the time and who, nothing else.
-- Safe to run more than once.
create or replace function public.log_sign_in()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return; end if;
  if exists (select 1 from public.activity_events e where e.kind = 'signed_in' and e.actor = auth.uid() and e.at > now() - interval '6 hours') then return; end if;
  insert into public.activity_events (actor, kind, target, detail) values (auth.uid(), 'signed_in', null, null);
end $$;
revoke all on function public.log_sign_in() from public, anon;
grant execute on function public.log_sign_in() to authenticated;
