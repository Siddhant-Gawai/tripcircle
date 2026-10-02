begin;
-- Self-reported group identity; possession of a random device token controls writes.
-- No phone lookup or recovery endpoint: a phone number never grants access.
create table tripcircle_private.participants(
 token_hash text primary key, name text not null check(length(name) between 2 and 60),
 phone text not null check(phone ~ '^\+[1-9][0-9]{7,14}$'), created_at timestamptz not null default now());
create table tripcircle_private.guest_votes(
 token_hash text primary key references tripcircle_private.participants(token_hash),
 destination_id text not null references public.tripcircle_destinations(id), updated_at timestamptz not null default now());
create table tripcircle_private.discussion(
 id uuid primary key default gen_random_uuid(), token_hash text not null references tripcircle_private.participants(token_hash),
 kind text not null check(kind in ('comment','suggestion')), body text not null check(length(body) between 1 and 1500),
 destination_id text references public.tripcircle_destinations(id), created_at timestamptz not null default now());
create index tripcircle_discussion_author_time on tripcircle_private.discussion(token_hash,created_at);
create index tripcircle_discussion_time on tripcircle_private.discussion(created_at desc);
alter table tripcircle_private.participants enable row level security;
alter table tripcircle_private.guest_votes enable row level security;
alter table tripcircle_private.discussion enable row level security;
revoke all on tripcircle_private.participants,tripcircle_private.guest_votes,tripcircle_private.discussion from public,anon,authenticated;
create function tripcircle_private.participant_action(p_token uuid,p_action text,p_name text default null,p_phone text default null,p_destination text default null,p_kind text default null,p_body text default null,p_post uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare h text; person tripcircle_private.participants; result jsonb;
begin
 if p_token is null then raise exception 'Please join the group first'; end if;
 h := encode(sha256(convert_to(p_token::text,'UTF8')),'hex');
 if p_action='join' then
  if p_name is null or length(trim(p_name)) not between 2 and 60 or p_phone is null or p_phone !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'Enter a name and a phone number with country code'; end if;
  insert into tripcircle_private.participants(token_hash,name,phone) values(h,trim(p_name),p_phone) on conflict(token_hash) do update set name=excluded.name,phone=excluded.phone;
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
 return jsonb_build_object('name',person.name,'vote',(select destination_id from tripcircle_private.guest_votes where token_hash=h),'post_ids',coalesce((select jsonb_agg(id) from tripcircle_private.discussion where token_hash=h),'[]'::jsonb));
end $$;
revoke all on function tripcircle_private.participant_action(uuid,text,text,text,text,text,text,uuid) from public;
grant execute on function tripcircle_private.participant_action(uuid,text,text,text,text,text,text,uuid) to anon,authenticated;
create function public.tripcircle_participate(p_token uuid,p_action text,p_name text default null,p_phone text default null,p_destination text default null,p_kind text default null,p_body text default null,p_post uuid default null)
returns jsonb language sql security invoker set search_path='' as $$ select tripcircle_private.participant_action(p_token,p_action,p_name,p_phone,p_destination,p_kind,p_body,p_post) $$;
revoke all on function public.tripcircle_participate(uuid,text,text,text,text,text,text,uuid) from public;
grant execute on function public.tripcircle_participate(uuid,text,text,text,text,text,text,uuid) to anon,authenticated;
create function tripcircle_private.discussion_feed() returns table(id uuid,name text,kind text,body text,destination_id text,created_at timestamptz) language sql stable security definer set search_path='' as $$
 select d.id,p.name,d.kind,d.body,d.destination_id,d.created_at from tripcircle_private.discussion d join tripcircle_private.participants p using(token_hash) order by d.created_at desc limit 100 $$;
revoke all on function tripcircle_private.discussion_feed() from public;
grant execute on function tripcircle_private.discussion_feed() to anon,authenticated;
create function public.tripcircle_discussion_feed() returns table(id uuid,name text,kind text,body text,destination_id text,created_at timestamptz) language sql stable security invoker set search_path='' as $$ select * from tripcircle_private.discussion_feed() $$;
revoke all on function public.tripcircle_discussion_feed() from public;
grant execute on function public.tripcircle_discussion_feed() to anon,authenticated;
create or replace function tripcircle_private.vote_totals() returns table(destination_id text,votes bigint) language sql stable security definer set search_path='' as $$
 select all_votes.destination_id,count(*) from (select destination_id from public.tripcircle_votes union all select destination_id from tripcircle_private.guest_votes) all_votes group by all_votes.destination_id $$;
notify pgrst,'reload schema';
commit;
