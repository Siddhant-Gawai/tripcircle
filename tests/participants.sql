begin;
set local role anon;
select public.tripcircle_participate('00000000-0000-4000-8000-000000000011','join','Test participant','+919999999999');
select public.tripcircle_participate('00000000-0000-4000-8000-000000000012','join','Other participant','+919999999999');
select public.tripcircle_participate('00000000-0000-4000-8000-000000000011','vote',p_destination=>'bordi');
select public.tripcircle_participate('00000000-0000-4000-8000-000000000011','post',p_destination=>'bordi',p_kind=>'suggestion',p_body=>'Regression test');
do $$ declare result jsonb; post_id uuid; begin
 result:=public.tripcircle_participate('00000000-0000-4000-8000-000000000012','me');
 if result->>'vote' is not null then raise exception 'Phone number granted access to another vote'; end if;
 if result ? 'phone' or result ? 'token_hash' then raise exception 'Private fields exposed'; end if;
 begin
 perform public.tripcircle_participate('00000000-0000-4000-8000-000000000013','vote',p_destination=>'jawhar');
 raise exception 'Unregistered token accepted';
 exception when raise_exception then if sqlerrm='Unregistered token accepted' then raise; end if; end;
 select id into post_id from public.tripcircle_discussion_feed() where body='Regression test';
 if post_id is null then raise exception 'Shared feed missing post'; end if;
 begin
 perform public.tripcircle_participate('00000000-0000-4000-8000-000000000012','remove_post',p_post=>post_id);
 raise exception 'Another participant removed post';
 exception when raise_exception then if sqlerrm='Another participant removed post' then raise; end if; end;
 begin
 perform 1 from tripcircle_private.participants;
 raise exception 'Private phone table exposed';
 exception when insufficient_privilege then null; end;
 perform public.tripcircle_participate('00000000-0000-4000-8000-000000000011','remove_post',p_post=>post_id);
 if exists(select 1 from public.tripcircle_discussion_feed() where id=post_id) then raise exception 'Own post removal failed'; end if;
end $$;
rollback;
