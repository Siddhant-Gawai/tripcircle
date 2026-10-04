-- Empty change signals. Private content continues through checked room RPCs.
create or replace function tripcircle_private.can_receive_room_updates(topic text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from tripcircle_private.rooms r
 where topic='tripcircle:room:'||r.id::text and (r.owner_id=auth.uid() or exists(
 select 1 from tripcircle_private.room_members m where m.room_id=r.id and m.user_id=auth.uid() and m.status='approved')))
$$;
revoke all on function tripcircle_private.can_receive_room_updates(text) from public;
grant execute on function tripcircle_private.can_receive_room_updates(text) to authenticated;
drop policy if exists tripcircle_receive_updates on realtime.messages;
create policy tripcircle_receive_updates on realtime.messages for select to authenticated
 using(extension='broadcast' and (realtime.topic()='tripcircle:user:'||(select auth.uid())::text
 or tripcircle_private.can_receive_room_updates(realtime.topic())));
create or replace function tripcircle_private.notify_room_update()
returns trigger language plpgsql security definer set search_path='' as $$
declare room uuid; visible boolean; person uuid;
begin
 if tg_table_name='rooms' then room:=coalesce(new.id,old.id); else room:=coalesce(new.room_id,old.room_id); end if;
 perform realtime.send('{}'::jsonb,'changed','tripcircle:room:'||room::text,true);
 if tg_table_name='room_members' then
  person:=coalesce(new.user_id,old.user_id);
  perform realtime.send('{}'::jsonb,'changed','tripcircle:user:'||person::text,true);
 end if;
 if tg_table_name in ('rooms','room_members') then
  select visibility='public' into visible from tripcircle_private.rooms where id=room;
  if visible then
   perform realtime.send('{}'::jsonb,'changed','tripcircle:public',false);
  elsif tg_table_name='rooms' and tg_op='UPDATE' then
   if old.visibility='public' then perform realtime.send('{}'::jsonb,'changed','tripcircle:public',false); end if;
  end if;
 end if;
 return null;
end $$;
revoke all on function tripcircle_private.notify_room_update() from public,anon,authenticated;
do $$ declare t text; begin
 foreach t in array array['rooms','room_members','room_plans','room_posts','room_votes','room_choices','room_overview'] loop
  execute format('drop trigger if exists tripcircle_notify_update on tripcircle_private.%I',t);
  execute format('create trigger tripcircle_notify_update after insert or update or delete on tripcircle_private.%I for each row execute function tripcircle_private.notify_room_update()',t);
 end loop;
end $$;
create or replace function tripcircle_private.notify_choice_vote_update()
returns trigger language plpgsql security definer set search_path='' as $$
declare room uuid; begin
 select room_id into room from tripcircle_private.room_choices where id=coalesce(new.choice_id,old.choice_id);
 if room is not null then perform realtime.send('{}'::jsonb,'changed','tripcircle:room:'||room::text,true); end if;
 return null;
end $$;
revoke all on function tripcircle_private.notify_choice_vote_update() from public,anon,authenticated;
drop trigger if exists tripcircle_notify_vote on tripcircle_private.choice_votes;
create trigger tripcircle_notify_vote after insert or update or delete on tripcircle_private.choice_votes for each row execute function tripcircle_private.notify_choice_vote_update();
