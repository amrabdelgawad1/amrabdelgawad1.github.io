-- Review center fixes after review. Safe to run more than once.

-- 1. A "recording" must be an audio file
alter table public.hub_uploads drop constraint if exists hub_uploads_rec_audio;
alter table public.hub_uploads add constraint hub_uploads_rec_audio check (kind <> 'recording' or coalesce(mime, '') like 'audio/%') not valid; -- not valid: checks every new row, leaves any older row as it is

-- 2. Exactly the privileges the app needs (Supabase grants new tables everything by default)
revoke all on public.hub_uploads from authenticated, anon;
revoke all on public.hub_upload_comments from authenticated, anon;
grant select, insert, delete on public.hub_uploads to authenticated;
grant select, insert, delete on public.hub_upload_comments to authenticated;

-- 3. Stricter scorecard check: 10 whole numbers from 1 to 5, nothing else
create or replace function public.hub_review(p_id uuid, p_status text, p_score jsonb)
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare n int;
begin
  if not coalesce(public.is_tracker_admin(), false) then raise exception 'hub: admin only' using errcode = '42501'; end if;
  if p_status is null or p_status not in ('waiting', 'approved', 'redo') then raise exception 'hub: bad status' using errcode = '22023'; end if;
  if p_score is not null then
    if coalesce(jsonb_typeof(p_score -> 'cats'), '') <> 'array' or jsonb_array_length(p_score -> 'cats') <> 10
       or exists (select 1 from jsonb_array_elements(p_score -> 'cats') c
                   where jsonb_typeof(c) <> 'number' or (c #>> '{}') !~ '^[1-5]$') then
      raise exception 'hub: the scorecard needs 10 scores from 1 to 5' using errcode = '22023';
    end if;
    p_score := jsonb_build_object('cats', p_score -> 'cats',
      'total', (select sum((c #>> '{}')::int) from jsonb_array_elements(p_score -> 'cats') c));
  end if;
  update public.hub_uploads
     set status = p_status, score = p_score,
         reviewed_at = case when p_status = 'waiting' then null else now() end,
         reviewed_by = case when p_status = 'waiting' then null else auth.uid() end
   where id = p_id;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'hub: not found' using errcode = '22023'; end if;
end $$;
revoke all on function public.hub_review(uuid, text, jsonb) from public;
grant execute on function public.hub_review(uuid, text, jsonb) to authenticated;

-- 4. Two more audio types some phones send
update storage.buckets
   set allowed_mime_types = (select array_agg(distinct t) from unnest(allowed_mime_types || array['audio/wave', 'audio/flac', 'audio/x-flac']) t)
 where id = 'hub-uploads';
