-- Number-only, unverified group profiles. Never grants organizer access.
create table tripcircle_private.number_profiles (
 phone text primary key check(phone ~ '^[0-9]{10}$'),
 participant_hash text not null unique references tripcircle_private.participants(token_hash));
create table tripcircle_private.number_sessions (
 token_hash text primary key,
 participant_hash text not null references tripcircle_private.participants(token_hash),
 created_at timestamptz not null default now());
create index tripcircle_number_sessions_profile on tripcircle_private.number_sessions(participant_hash);
alter table tripcircle_private.number_profiles enable row level security;
alter table tripcircle_private.number_sessions enable row level security;
revoke all on tripcircle_private.number_profiles,tripcircle_private.number_sessions from public,anon,authenticated;
-- Preserve existing +91 profiles. Duplicate legacy numbers keep their historical
-- records; the earliest profile becomes the shared number profile.
insert into tripcircle_private.number_profiles(phone,participant_hash)
 select distinct on (phone) right(phone,10),token_hash from tripcircle_private.participants
 where phone ~ '^\+91[0-9]{10}$' order by phone,created_at,token_hash;
create or replace function tripcircle_private.participant_action(p_token uuid,p_action text,p_name text default null,p_phone text default null,p_destination text default null,p_kind text default null,p_body text default null,p_post uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare h text; person tripcircle_private.participants; result jsonb; session_h text; linked boolean := false;
begin
 if p_token is null then raise exception 'Please join the group first'; end if;
 h := encode(sha256(convert_to(p_token::text,'UTF8')),'hex');
 session_h:=h;
 select participant_hash into h from tripcircle_private.number_sessions where token_hash=session_h;
 linked:=found;
 if not linked then h:=session_h; end if;
 if p_action='logout' then
  delete from tripcircle_private.number_sessions where token_hash=session_h;
  return jsonb_build_object('signed_out',true);
 end if;
 if p_action='join' and linked then raise exception 'This profile is already saved'; end if;
 if p_action='join' then
  if p_name is null or length(trim(p_name)) not between 2 and 60 or (p_phone is not null and p_phone !~ '^\+[1-9][0-9]{7,14}$') then raise exception 'Enter a name (2–60 characters)'; end if;
  insert into tripcircle_private.participants(token_hash,name,phone) values(h,trim(p_name),p_phone) on conflict(token_hash) do update set name=excluded.name,phone=coalesce(excluded.phone,participants.phone);
 end if;
 select * into person from tripcircle_private.participants where token_hash=h for update;
 if not found then raise exception 'Please join the group first'; end if;
 if p_action='vote' then
  if p_destination is null then delete from tripcircle_private.guest_votes where token_hash=h;
  else insert into tripcircle_private.guest_votes(token_hash,destination_id) values(h,p_destination) on conflict(token_hash) do update set destination_id=excluded.destination_id,updated_at=now(); end if;
 elsif p_action='post' then
  if p_kind is null or p_kind not in ('comment','suggestion') or p_body is null or length(trim(p_body)) not between 1 and 1500 then raise exception 'Write a comment or suggestion (up to 1500 characters)'; end if;
  if (select count(*) from tripcircle_private.discussion where token_hash=h and created_at>now()-interval '1 hour')>=5 then raise exception 'Please wait before posting more (5 posts per hour)'; end if;
  insert into tripcircle_private.discussion(token_hash,kind,body,destination_id) values(h,p_kind,trim(p_body),p_destination);
 elsif p_action='remove_post' then
  delete from tripcircle_private.discussion where id=p_post and token_hash=h;
  if not found then raise exception 'You can only remove your own posts'; end if;
 elsif p_action not in ('join','me') then raise exception 'Unknown action';
 end if;
 return jsonb_build_object('number_profile',linked,'name',person.name,'vote',(select destination_id from tripcircle_private.guest_votes where token_hash=h),'post_ids',coalesce((select jsonb_agg(id) from tripcircle_private.discussion where token_hash=h),'[]'::jsonb));
end $$;
create function tripcircle_private.number_login(p_phone text,p_token uuid,p_name text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare h text; canonical text; result jsonb;
begin
 if p_phone is null or p_phone !~ '^[0-9]{10}$' or p_token is null then raise exception 'Enter a 10-digit phone number'; end if;
 h:=encode(sha256(convert_to(p_token::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_phone,0));
 select participant_hash into canonical from tripcircle_private.number_profiles where phone=p_phone;
 if canonical is null then
  if p_name is null then return jsonb_build_object('name_required',true); end if;
  if length(trim(p_name)) not between 2 and 60 then raise exception 'Enter your name (2–60 characters)'; end if;
  canonical:=encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex');
  insert into tripcircle_private.participants(token_hash,name,phone) values(canonical,trim(p_name),'+91'||p_phone);
  insert into tripcircle_private.number_profiles(phone,participant_hash) values(p_phone,canonical);
 end if;
 if exists(select 1 from tripcircle_private.participants where token_hash=h) then raise exception 'Please try again'; end if;
 insert into tripcircle_private.number_sessions(token_hash,participant_hash) values(h,canonical)
 on conflict(token_hash) do update set participant_hash=excluded.participant_hash,created_at=now();
 result:=tripcircle_private.participant_action(p_token,'me');
 return result;
end $$;
revoke all on function tripcircle_private.number_login(text,uuid,text) from public;
grant execute on function tripcircle_private.number_login(text,uuid,text) to anon,authenticated;
create function public.tripcircle_number_login(p_phone text,p_token uuid,p_name text default null)
returns jsonb language sql security invoker set search_path='' as $$ select tripcircle_private.number_login(p_phone,p_token,p_name) $$;
revoke all on function public.tripcircle_number_login(text,uuid,text) from public;
grant execute on function public.tripcircle_number_login(text,uuid,text) to anon,authenticated;
notify pgrst,'reload schema';
