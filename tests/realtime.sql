-- Run after realtime.sql; every fixture and notification rolls back.
begin;
select set_config('tripcircle.owner',gen_random_uuid()::text,true);
select set_config('tripcircle.pending',gen_random_uuid()::text,true);
select set_config('tripcircle.stranger',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role,email,email_confirmed_at) values
(current_setting('tripcircle.owner')::uuid,'authenticated','authenticated','rt-owner@example.invalid',now()),
(current_setting('tripcircle.pending')::uuid,'authenticated','authenticated','rt-pending@example.invalid',now()),
(current_setting('tripcircle.stranger')::uuid,'authenticated','authenticated','rt-stranger@example.invalid',now());
select set_config('request.jwt.claims',json_build_object('sub',current_setting('tripcircle.owner'),'role','authenticated')::text,true);
set local role authenticated;
do $$ declare r jsonb; begin
 r:=public.tripcircle_rooms('create',null,'{"name":"Owner","title":"Realtime QA","origin":"Ahmedabad"}');
 perform set_config('tripcircle.room',r->>'id',true);perform set_config('tripcircle.code',r->>'code',true);
 if not tripcircle_private.can_receive_room_updates('tripcircle:room:'||(r->>'id')) then raise exception 'Owner cannot receive room updates'; end if;
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('tripcircle.pending'),'role','authenticated')::text,true);
set local role authenticated;
select public.tripcircle_rooms('join',null,jsonb_build_object('name','Pending','code',current_setting('tripcircle.code')));
do $$ begin
 if tripcircle_private.can_receive_room_updates('tripcircle:room:'||current_setting('tripcircle.room')) then raise exception 'Pending membership grants room channel access'; end if;
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('tripcircle.owner'),'role','authenticated')::text,true);
set local role authenticated;
select public.tripcircle_rooms('approve',current_setting('tripcircle.room')::uuid,jsonb_build_object('user_id',current_setting('tripcircle.pending')));
reset role;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('tripcircle.pending'),'role','authenticated')::text,true);
set local role authenticated;
do $$ begin
 if not tripcircle_private.can_receive_room_updates('tripcircle:room:'||current_setting('tripcircle.room')) then raise exception 'Approved member denied room channel'; end if;
 if tripcircle_private.can_receive_room_updates('tripcircle:room:not-a-uuid') then raise exception 'Malformed topic accepted'; end if;
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('tripcircle.stranger'),'role','authenticated')::text,true);
set local role authenticated;
do $$ begin
 if tripcircle_private.can_receive_room_updates('tripcircle:room:'||current_setting('tripcircle.room')) then raise exception 'Stranger received private room topic'; end if;
end $$;
reset role;
do $$ begin
 if exists(select 1 from realtime.messages where topic in ('tripcircle:room:'||current_setting('tripcircle.room'),'tripcircle:user:'||current_setting('tripcircle.pending')) and payload<>'{}'::jsonb) then raise exception 'Notification contains private row data'; end if;
 if to_regprocedure('public.tripcircle_number_login(text,uuid,text)') is not null then
  if has_function_privilege('anon','public.tripcircle_number_login(text,uuid,text)','execute') then raise exception 'Legacy number login still callable'; end if;
 end if;
end $$;
rollback;
