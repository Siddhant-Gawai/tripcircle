-- Fresh projects only. Existing projects already have this catalogue/schema.
create schema tripcircle_private;
revoke all on schema tripcircle_private from public;
grant usage on schema tripcircle_private to anon,authenticated;
create table public.tripcircle_destinations(
 id text primary key,name text not null,landscape text not null,journey text not null,
 duration text not null,summary text not null,caveat text not null,source_url text not null,
 stay_url text,itinerary text not null,position int not null,details jsonb not null default '{}');
alter table public.tripcircle_destinations enable row level security;
grant select on public.tripcircle_destinations to anon,authenticated;
create policy catalogue_read on public.tripcircle_destinations for select to anon,authenticated using(true);
