begin;
create schema if not exists tripcircle_private;
revoke all on schema tripcircle_private from public;
grant usage on schema tripcircle_private to anon, authenticated;
create table tripcircle_private.editors(email text primary key check(email=lower(email)));
create table public.tripcircle_destinations(
 id text primary key check(id ~ '^[a-z0-9-]+$'), name text not null check(length(name) between 1 and 100),
 landscape text not null check(landscape in ('Hills','Forest','Beach')),
 journey text not null check(length(journey)<100), duration text not null check(length(duration)<100),
 summary text not null check(length(summary)<2000), caveat text not null check(length(caveat)<1000),
 source_url text not null check(source_url ~ '^https://'), stay_url text check(stay_url ~ '^https://'),
 itinerary text not null check(length(itinerary)<3000), position integer not null default 0,
 updated_at timestamptz not null default now());
create table public.tripcircle_plan(id integer primary key check(id=1), title text not null check(length(title)<120), dates text not null check(length(dates)<200), notes text not null check(length(notes)<4000),updated_at timestamptz not null default now());
create table public.tripcircle_votes(user_id uuid primary key references auth.users(id) on delete cascade, destination_id text not null references public.tripcircle_destinations(id) on delete cascade,updated_at timestamptz not null default now());
create index tripcircle_votes_destination on public.tripcircle_votes(destination_id);
alter table public.tripcircle_destinations enable row level security;
alter table public.tripcircle_plan enable row level security;
alter table public.tripcircle_votes enable row level security;
alter table tripcircle_private.editors enable row level security;
-- The protected lookup verifies the user's confirmed identity, never editable user_metadata.
create function tripcircle_private.is_editor() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u join tripcircle_private.editors e on e.email=lower(u.email) where u.id=(select auth.uid()) and u.email_confirmed_at is not null)
$$;
revoke all on function tripcircle_private.is_editor() from public;
grant execute on function tripcircle_private.is_editor() to authenticated;
create function public.tripcircle_can_edit() returns boolean language sql stable security invoker set search_path='' as $$ select tripcircle_private.is_editor() $$;
revoke all on function public.tripcircle_can_edit() from public;
grant execute on function public.tripcircle_can_edit() to authenticated;
create policy destinations_read on public.tripcircle_destinations for select to anon,authenticated using(true);
create policy destinations_update on public.tripcircle_destinations for update to authenticated using((select tripcircle_private.is_editor())) with check((select tripcircle_private.is_editor()));
create policy plan_read on public.tripcircle_plan for select to anon,authenticated using(true);
create policy plan_update on public.tripcircle_plan for update to authenticated using((select tripcircle_private.is_editor())) with check((select tripcircle_private.is_editor()));
create policy votes_read_own on public.tripcircle_votes for select to authenticated using(user_id=(select auth.uid()));
create policy votes_insert_own on public.tripcircle_votes for insert to authenticated with check(user_id=(select auth.uid()));
create policy votes_update_own on public.tripcircle_votes for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy votes_delete_own on public.tripcircle_votes for delete to authenticated using(user_id=(select auth.uid()));
-- Fixed aggregate output only; individual voter identities stay private.
create function tripcircle_private.vote_totals() returns table(destination_id text,votes bigint) language sql stable security definer set search_path='' as $$ select destination_id,count(*) from public.tripcircle_votes group by destination_id $$;
revoke all on function tripcircle_private.vote_totals() from public;
grant execute on function tripcircle_private.vote_totals() to anon,authenticated;
create function public.tripcircle_vote_totals() returns table(destination_id text,votes bigint) language sql stable security invoker set search_path='' as $$ select * from tripcircle_private.vote_totals() $$;
revoke all on function public.tripcircle_vote_totals() from public;
grant execute on function public.tripcircle_vote_totals() to anon,authenticated;
grant select on public.tripcircle_destinations,public.tripcircle_plan to anon,authenticated;
grant update on public.tripcircle_destinations,public.tripcircle_plan to authenticated;
grant select,insert,update,delete on public.tripcircle_votes to authenticated;
commit;
