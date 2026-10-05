-- All identities, bookmarks and quota increments roll back.
begin;
select set_config('tripcircle.search_a', gen_random_uuid()::text, true);
select set_config('tripcircle.search_b', gen_random_uuid()::text, true);
insert into auth.users(id,aud,role,email,email_confirmed_at) values
 (current_setting('tripcircle.search_a')::uuid,'authenticated','authenticated','search-a@example.invalid',now()),
 (current_setting('tripcircle.search_b')::uuid,'authenticated','authenticated','search-b@example.invalid',now());
select set_config('request.jwt.claims',json_build_object('sub',current_setting('tripcircle.search_a'),'role','authenticated')::text,true);
set local role authenticated;
insert into public.tripcircle_saved_places(destination_id) values ('bordi');
do $$ begin
 if (select count(*) from public.tripcircle_saved_places) <> 1 then raise exception 'Own save missing'; end if;
 begin
  insert into public.tripcircle_saved_places(user_id,destination_id) values(current_setting('tripcircle.search_b')::uuid,'jawhar');
  raise exception 'Forged save accepted';
 exception when insufficient_privilege then null; end;
 begin perform public.tripcircle_reserve_search(current_setting('tripcircle.search_a')::uuid); raise exception 'Quota RPC exposed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('tripcircle.search_b'),'role','authenticated')::text,true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.tripcircle_saved_places) then raise exception 'Cross-user saved places exposed'; end if;
 delete from public.tripcircle_saved_places where user_id=current_setting('tripcircle.search_a')::uuid;
end $$;
reset role;
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
do $$ begin
 begin perform * from public.tripcircle_saved_places; raise exception 'Anonymous read accepted';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ declare n integer; u uuid := current_setting('tripcircle.search_a')::uuid; d date := (now() at time zone 'UTC')::date;
begin
 if not exists(select 1 from public.tripcircle_saved_places where user_id=u) then raise exception 'Cross-user delete succeeded'; end if;
 delete from tripcircle_private.search_usage where day=d;
 for n in 1..20 loop
  if not public.tripcircle_reserve_search(u) then raise exception 'Quota rejected early'; end if;
 end loop;
 if public.tripcircle_reserve_search(u) then raise exception 'User quota exceeded'; end if;
 update tripcircle_private.search_usage set requests=50 where day=d and scope='global';
 if public.tripcircle_reserve_search(current_setting('tripcircle.search_b')::uuid) then raise exception 'Global quota exceeded'; end if;
end $$;
rollback;
