begin;
set local role anon;
select public.tripcircle_participate('10000000-0000-4000-8000-000000000099','join','A friend');
select public.tripcircle_participate('10000000-0000-4000-8000-000000000099','vote',p_destination=>'jawhar');
select public.tripcircle_participate('10000000-0000-4000-8000-000000000099','join','TripCircle QA');
select public.tripcircle_participate('10000000-0000-4000-8000-000000000099','post',p_destination=>'jawhar',p_kind=>'suggestion',p_body=>'Transactional test only');
do $$ declare p jsonb; begin
 p:=public.tripcircle_participate('10000000-0000-4000-8000-000000000099','me');
 if p->>'name'<>'TripCircle QA' or p->>'vote'<>'jawhar' or jsonb_array_length(p->'post_ids')<>1 then raise exception 'Anonymous participation regression'; end if;
 if p ? 'phone' or p ? 'token_hash' then raise exception 'Private data exposed'; end if;
 if (select count(*) from public.tripcircle_destinations where jsonb_array_length(details->'spots')>0 and jsonb_array_length(details->'stays')>0)<>5 then raise exception 'Missing destination details'; end if;
end $$;
rollback;
