-- Transactional regression check. Everything, including test identities, rolls back.
begin;
select set_config('tripcircle.test_id',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role,email,email_confirmed_at) values(current_setting('tripcircle.test_id')::uuid,'authenticated','authenticated','tripcircle-test@example.invalid',now());
select set_config('request.jwt.claims',json_build_object('sub',current_setting('tripcircle.test_id'),'role','authenticated')::text,true);
set local role authenticated;
do $$ begin
 if public.tripcircle_can_edit() then raise exception 'Unlisted user received editor access'; end if;
 insert into public.tripcircle_votes(user_id,destination_id) values(auth.uid(),'jawhar');
 update public.tripcircle_votes set destination_id='bordi' where user_id=auth.uid();
 if not exists(select 1 from public.tripcircle_votes where destination_id='bordi') then raise exception 'Own vote update failed'; end if;
 update public.tripcircle_plan set title='Unauthorized edit' where id=1;
 if found then raise exception 'Non-editor changed shared plan'; end if;
 begin
 insert into public.tripcircle_votes(user_id,destination_id) values(gen_random_uuid(),'jawhar');
 raise exception 'Forged vote was accepted';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
insert into tripcircle_private.editors(email) values('tripcircle-test@example.invalid');
set local role authenticated;
do $$ begin
 if not public.tripcircle_can_edit() then raise exception 'Verified editor cannot edit'; end if;
 update public.tripcircle_plan set title='Verified edit' where id=1;
 if not found then raise exception 'Verified editor update failed'; end if;
end $$;
reset role;
update auth.users set email_confirmed_at=null where id=current_setting('tripcircle.test_id')::uuid;
set local role authenticated;
do $$ begin
 if public.tripcircle_can_edit() then raise exception 'Unconfirmed editor gained access'; end if;
end $$;
reset role;
set local role anon;
do $$ declare n integer; begin
 select count(*) into n from public.tripcircle_destinations;
 if n<>5 then raise exception 'Public shortlist read failed'; end if;
 if not exists(select 1 from public.tripcircle_vote_totals() where destination_id='bordi' and votes>=1) then raise exception 'Aggregate vote read failed'; end if;
 begin
 if exists(select 1 from public.tripcircle_votes) then raise exception 'Individual votes exposed to anonymous readers'; end if;
 exception when insufficient_privilege then null;
 end;
end $$;
rollback;
