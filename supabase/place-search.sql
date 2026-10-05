-- Apply after the existing destination and room schemas.
create table public.tripcircle_saved_places (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  destination_id text not null references public.tripcircle_destinations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, destination_id)
);
alter table public.tripcircle_saved_places enable row level security;
revoke all on public.tripcircle_saved_places from anon, authenticated;
grant select, insert, delete on public.tripcircle_saved_places to authenticated;
create policy saved_select on public.tripcircle_saved_places for select to authenticated using ((select auth.uid()) = user_id);
create policy saved_insert on public.tripcircle_saved_places for insert to authenticated with check ((select auth.uid()) = user_id and (select auth.jwt()->>'is_anonymous') is distinct from 'true');
create policy saved_delete on public.tripcircle_saved_places for delete to authenticated using ((select auth.uid()) = user_id);

create table tripcircle_private.search_usage (
  day date not null, scope text not null, requests integer not null default 0,
  primary key (day, scope)
);
alter table tripcircle_private.search_usage enable row level security;
revoke all on tripcircle_private.search_usage from public, anon, authenticated;
-- Only the backend may reserve calls. Global lock serializes quota checks.
create function tripcircle_private.reserve_search(p_user uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare d date := (now() at time zone 'UTC')::date; n integer;
begin
  if p_user is null then return false; end if;
  insert into tripcircle_private.search_usage(day,scope) values(d,'global') on conflict do nothing;
  select requests into n from tripcircle_private.search_usage where day=d and scope='global' for update;
  if n >= 50 then return false; end if;
  insert into tripcircle_private.search_usage(day,scope) values(d,p_user::text) on conflict do nothing;
  select requests into n from tripcircle_private.search_usage where day=d and scope=p_user::text for update;
  if n >= 20 then return false; end if;
  update tripcircle_private.search_usage set requests=requests+1 where day=d and scope in ('global',p_user::text);
  delete from tripcircle_private.search_usage where day < d - 7;
  return true;
end $$;
revoke all on function tripcircle_private.reserve_search(uuid) from public, anon, authenticated;
grant usage on schema tripcircle_private to service_role;
grant execute on function tripcircle_private.reserve_search(uuid) to service_role;
create function public.tripcircle_reserve_search(p_user uuid) returns boolean
language sql security invoker set search_path = '' as $$ select tripcircle_private.reserve_search(p_user) $$;
revoke all on function public.tripcircle_reserve_search(uuid) from public, anon, authenticated;
grant execute on function public.tripcircle_reserve_search(uuid) to service_role;
