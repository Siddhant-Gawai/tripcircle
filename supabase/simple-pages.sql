-- Browse and vote without signup; names are only needed for comments.
alter table tripcircle_private.participants alter column phone drop not null;
alter table public.tripcircle_destinations add column if not exists details jsonb not null default '{}'::jsonb;
create or replace function tripcircle_private.participant_action(p_token uuid,p_action text,p_name text default null,p_phone text default null,p_destination text default null,p_kind text default null,p_body text default null,p_post uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare h text; person tripcircle_private.participants; result jsonb;
begin
 if p_token is null then raise exception 'Please join the group first'; end if;
 h := encode(sha256(convert_to(p_token::text,'UTF8')),'hex');
 if p_action='join' then
  if p_name is null or length(trim(p_name)) not between 2 and 60 or (p_phone is not null and p_phone !~ '^\+[1-9][0-9]{7,14}$') then raise exception 'Enter a name (2–60 characters)'; end if;
  insert into tripcircle_private.participants(token_hash,name,phone) values(h,trim(p_name),p_phone) on conflict(token_hash) do update set name=excluded.name,phone=coalesce(excluded.phone,participants.phone);
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
notify pgrst,'reload schema';
