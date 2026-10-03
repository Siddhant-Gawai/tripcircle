-- All test identities and room data roll back. Run in an administrative SQL session.
begin;
select set_config('tripcircle.owner',gen_random_uuid()::text,true);
select set_config('tripcircle.member',gen_random_uuid()::text,true);
select set_config('tripcircle.other',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role,email,email_confirmed_at) values
 (current_setting('tripcircle.owner')::uuid,'authenticated','authenticated','room-owner-test@example.invalid',now()),
 (current_setting('tripcircle.member')::uuid,'authenticated','authenticated','room-member-test@example.invalid',now()),
 (current_setting('tripcircle.other')::uuid,'authenticated','authenticated','room-other-test@example.invalid',now());
select set_config('request.jwt.claims',json_build_object('sub',current_setting('tripcircle.owner'),'role','authenticated')::text,true);
set local role authenticated;
do $$ declare r jsonb; begin
 r:=public.tripcircle_rooms('create',null,'{"name":"Owner QA","title":"Private test","origin":"Ahmedabad","capacity":2}');
 perform set_config('tripcircle.room',r->>'id',true);perform set_config('tripcircle.code',r->>'code',true);
 perform public.tripcircle_rooms('shortlist',(r->>'id')::uuid,'{"destination":"jawhar"}');
 perform public.tripcircle_rooms('save_plan',(r->>'id')::uuid,'{"days":[{"title":"Travel","body":"07:00 leave"}],"notes":"Member-only notes"}');
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('tripcircle.member'),'role','authenticated')::text,true);
set local role authenticated;
do $$ declare r jsonb; denied boolean; begin
 denied:=false;begin perform public.tripcircle_rooms('view',current_setting('tripcircle.room')::uuid);exception when others then denied:=true;end;
 if not denied then raise exception 'Private room visible before request'; end if;
 denied:=false;begin perform public.tripcircle_rooms('join',current_setting('tripcircle.room')::uuid,'{"name":"Member QA","code":"WRONG"}');exception when others then denied:=true;end;
 if not denied then raise exception 'Incorrect private room code accepted'; end if;
 r:=public.tripcircle_rooms('join',null,jsonb_build_object('name','Member QA','code',current_setting('tripcircle.code')));
 r:=public.tripcircle_rooms('view',current_setting('tripcircle.room')::uuid);
 if r ? 'plan' or r ? 'code' or r ? 'posts' or r->>'status'<>'pending' then raise exception 'Pending member received private plan'; end if;
 denied:=false;begin perform public.tripcircle_rooms('post',current_setting('tripcircle.room')::uuid,'{"body":"not approved"}');exception when others then denied:=true;end;
 if not denied then raise exception 'Pending member wrote to room'; end if;
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('tripcircle.owner'),'role','authenticated')::text,true);
set local role authenticated;
select public.tripcircle_rooms('approve',current_setting('tripcircle.room')::uuid,jsonb_build_object('user_id',current_setting('tripcircle.member')));
select public.tripcircle_rooms('visibility',current_setting('tripcircle.room')::uuid,'{"visibility":"public"}');
reset role;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('tripcircle.member'),'role','authenticated')::text,true);
set local role authenticated;
do $$ declare r jsonb; denied boolean; begin
 r:=public.tripcircle_rooms('view',current_setting('tripcircle.room')::uuid);
 if not(r ? 'plan') or r ? 'code' then raise exception 'Approved projection incorrect'; end if;
 if exists(select 1 from jsonb_array_elements(r->'members') e where e->>'id' is not null) then raise exception 'Member identities leaked'; end if;
 perform public.tripcircle_rooms('vote',current_setting('tripcircle.room')::uuid,'{"destination":"jawhar"}');
 perform public.tripcircle_rooms('post',current_setting('tripcircle.room')::uuid,'{"kind":"suggestion","body":"Leave earlier"}');
 perform public.tripcircle_rooms('add_task',current_setting('tripcircle.room')::uuid,'{"title":"Book train","owner":"Member QA"}');
 perform public.tripcircle_rooms('toggle_task',current_setting('tripcircle.room')::uuid,'{"task_id":"water"}');
 r:=public.tripcircle_rooms('view',current_setting('tripcircle.room')::uuid);
 if r->>'my_vote'<>'jawhar' or jsonb_array_length(r->'posts')<>1 then raise exception 'Member collaboration failed'; end if;
 perform set_config('tripcircle.post',r->'posts'->0->>'id',true);
 if not exists(select 1 from jsonb_array_elements(r->'plan'->'checklist') e where e->>'id'='water' and e->>'done'='true') then raise exception 'Checklist not saved'; end if;
 denied:=false;begin perform public.tripcircle_rooms('save_plan',current_setting('tripcircle.room')::uuid,'{"days":[]}');exception when others then denied:=true;end;
 if not denied then raise exception 'Participant replaced final plan'; end if;
 denied:=false;begin perform public.tripcircle_rooms('visibility',current_setting('tripcircle.room')::uuid,'{"visibility":"private"}');exception when others then denied:=true;end;
 if not denied then raise exception 'Participant changed visibility'; end if;
 denied:=false;begin perform public.tripcircle_rooms('approve',current_setting('tripcircle.room')::uuid,jsonb_build_object('user_id',current_setting('tripcircle.other')));exception when others then denied:=true;end;
 if not denied then raise exception 'Participant approved a member'; end if;
 denied:=false;begin perform public.tripcircle_rooms('vote',current_setting('tripcircle.room')::uuid,'{"destination":"bordi"}');exception when others then denied:=true;end;
 if not denied then raise exception 'Vote outside shortlist accepted'; end if;
 denied:=false;begin perform 1 from tripcircle_private.rooms;exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Direct private tables accessible'; end if;
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('tripcircle.other'),'role','authenticated')::text,true);
set local role authenticated;
do $$ declare r jsonb; denied boolean; begin
 r:=public.tripcircle_rooms('view',current_setting('tripcircle.room')::uuid);
 if r ? 'plan' or r ? 'code' or r ? 'posts' then raise exception 'Outsider received private plan'; end if;
 perform public.tripcircle_rooms('join',current_setting('tripcircle.room')::uuid,'{"name":"Other QA"}');
 denied:=false;begin perform public.tripcircle_rooms('remove_post',current_setting('tripcircle.room')::uuid,jsonb_build_object('post_id',current_setting('tripcircle.post')));exception when others then denied:=true;end;
 if not denied then raise exception 'Outsider deleted member post'; end if;
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('tripcircle.owner'),'role','authenticated')::text,true);
set local role authenticated;
do $$ declare denied boolean:=false; begin
 begin perform public.tripcircle_rooms('approve',current_setting('tripcircle.room')::uuid,jsonb_build_object('user_id',current_setting('tripcircle.other')));exception when others then denied:=true;end;
 if not denied then raise exception 'Group capacity exceeded'; end if;
 denied:=false;begin perform public.tripcircle_rooms('remove_post',current_setting('tripcircle.room')::uuid,jsonb_build_object('post_id',current_setting('tripcircle.post')));exception when others then denied:=true;end;
 if not denied then raise exception 'Owner removed someone else message'; end if;
 perform public.tripcircle_rooms('remove_member',current_setting('tripcircle.room')::uuid,jsonb_build_object('user_id',current_setting('tripcircle.member')));
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('tripcircle.member'),'role','authenticated')::text,true);
set local role authenticated;
do $$ declare r jsonb; denied boolean:=false; begin
 r:=public.tripcircle_rooms('view',current_setting('tripcircle.room')::uuid);
 if r ? 'plan' then raise exception 'Removed member retained private access'; end if;
 begin perform public.tripcircle_rooms('add_task',current_setting('tripcircle.room')::uuid,'{"title":"forbidden"}');exception when others then denied:=true;end;
 if not denied then raise exception 'Removed member retained write access'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
do $$ declare r jsonb; denied boolean:=false; begin
 r:=public.tripcircle_rooms('list');
 if exists(select 1 from jsonb_array_elements(r) e where e ? 'code' or e ? 'owner_id' or e ? 'plan') then raise exception 'Public list leaked private data'; end if;
 r:=public.tripcircle_rooms('view',current_setting('tripcircle.room')::uuid);
 if r ? 'plan' or r ? 'posts' or r ? 'code' then raise exception 'Anonymous preview leaked private data'; end if;
 begin perform public.tripcircle_rooms('create',null,'{"name":"Anon","title":"Bad","origin":"Ahmedabad"}');exception when others then denied:=true;end;
 if not denied then raise exception 'Anonymous creation accepted'; end if;
end $$;
reset role;
update auth.users set email_confirmed_at=null where id=current_setting('tripcircle.other')::uuid;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('tripcircle.other'),'role','authenticated')::text,true);
set local role authenticated;
do $$ declare denied boolean:=false; begin
 begin perform public.tripcircle_rooms('mine');exception when others then denied:=true;end;
 if not denied then raise exception 'Unconfirmed account accepted'; end if;
end $$;
rollback;
