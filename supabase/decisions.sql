-- Apply after rooms.sql. Existing room membership remains the source of authorization.
create table tripcircle_private.room_choices (
 id uuid primary key default gen_random_uuid(), room_id uuid not null references tripcircle_private.rooms(id),
 created_by uuid not null references auth.users(id), kind text not null check(kind in ('date','stay','transport')),
 title text not null check(length(title) between 2 and 150), notes text not null default '' check(length(notes)<=1000),
 url text not null default '' check(length(url)<=2000 and (url='' or url ~ '^https://[^[:space:]]+$')),
 price numeric(12,2) check(price between 0 and 10000000), starts date, ends date,
 archived boolean not null default false, created_at timestamptz not null default now(),
 check((kind='date' and starts is not null and ends is not null and ends>=starts and ends-starts<=20) or (kind<>'date' and starts is null and ends is null)));
create index tripcircle_choices_room on tripcircle_private.room_choices(room_id,kind,created_at);
create index tripcircle_choices_author on tripcircle_private.room_choices(created_by,created_at);
create table tripcircle_private.choice_votes (
 choice_id uuid not null references tripcircle_private.room_choices(id), user_id uuid not null references auth.users(id),
 primary key(choice_id,user_id));
create index tripcircle_choice_votes_user on tripcircle_private.choice_votes(user_id);
create table tripcircle_private.room_overview (
 room_id uuid primary key references tripcircle_private.rooms(id),
 destination_id text references public.tripcircle_destinations(id), date_id uuid references tripcircle_private.room_choices(id),
 stay_id uuid references tripcircle_private.room_choices(id), transport_id uuid references tripcircle_private.room_choices(id),
 meeting_point text not null default '' check(length(meeting_point)<=300), meeting_time text not null default '' check(length(meeting_time)<=100),
 updated_at timestamptz not null default now());
create index tripcircle_overview_destination on tripcircle_private.room_overview(destination_id);
create index tripcircle_overview_date on tripcircle_private.room_overview(date_id);
create index tripcircle_overview_stay on tripcircle_private.room_overview(stay_id);
create index tripcircle_overview_transport on tripcircle_private.room_overview(transport_id);
alter table tripcircle_private.room_choices enable row level security;
alter table tripcircle_private.choice_votes enable row level security;
alter table tripcircle_private.room_overview enable row level security;
revoke all on tripcircle_private.room_choices,tripcircle_private.choice_votes,tripcircle_private.room_overview from public,anon,authenticated;
create function tripcircle_private.decision_action(p_action text,p_room uuid,p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); access jsonb; owner boolean; c tripcircle_private.room_choices; o tripcircle_private.room_overview;
 k text; n text; choice uuid; did text; dateid uuid; stayid uuid; transportid uuid; datechoice tripcircle_private.room_choices;
begin
 -- room_action checks a confirmed, non-anonymous Auth user, approval, and room ownership.
 access:=tripcircle_private.room_action('view',p_room);
 if not (access ? 'plan') then
  if p_action='view' then return '{}'::jsonb; end if;
  raise exception 'Organizer approval is needed';
 end if;
 owner:=(access->>'organizer')::boolean;
 if p_action='view' then
  return jsonb_build_object('choices',coalesce((select jsonb_agg(x) from (
   select cc.id,cc.kind,cc.title,cc.notes,cc.url,cc.price,cc.starts,cc.ends,cc.created_by=uid as mine,
    (select count(*) from tripcircle_private.choice_votes v join tripcircle_private.room_members m on m.user_id=v.user_id and m.room_id=cc.room_id and m.status='approved' where v.choice_id=cc.id) as votes,
    exists(select 1 from tripcircle_private.choice_votes v where v.choice_id=cc.id and v.user_id=uid) as voted
   from tripcircle_private.room_choices cc where cc.room_id=p_room and not cc.archived order by cc.created_at,cc.id) x),'[]'),
   'overview',coalesce((select to_jsonb(ov)-'room_id' from tripcircle_private.room_overview ov where room_id=p_room),'{}'));
 end if;
 if p_action='add_choice' then
  k:=p_data->>'kind';n:=trim(p_data->>'title');
  if k='date' and not owner then raise exception 'Only the organizer can add date polls'; end if;
  if (select count(*) from tripcircle_private.room_choices where room_id=p_room and kind=k and not archived)>=20 then raise exception 'Use up to 20 options per category'; end if;
  if (select count(*) from tripcircle_private.room_choices where created_by=uid and created_at>now()-interval '1 hour')>=10 then raise exception 'Please wait before adding more options'; end if;
  insert into tripcircle_private.room_choices(room_id,created_by,kind,title,notes,url,price,starts,ends)
   values(p_room,uid,k,n,coalesce(p_data->>'notes',''),trim(coalesce(p_data->>'url','')),nullif(p_data->>'price','')::numeric,
    case when k='date' then (p_data->>'starts')::date end,case when k='date' then (p_data->>'ends')::date end) returning id into choice;
  return jsonb_build_object('id',choice);
 elsif p_action in ('vote','archive_choice') then
  choice:=(p_data->>'choice_id')::uuid;
  select * into c from tripcircle_private.room_choices where id=choice and room_id=p_room and not archived;
  if c.id is null then raise exception 'Option not found in this room'; end if;
  if p_action='archive_choice' then
   if not owner then raise exception 'Only the organizer can remove options'; end if;
   update tripcircle_private.room_choices set archived=true where id=choice;
   select * into o from tripcircle_private.room_overview where room_id=p_room;
   update tripcircle_private.room_overview set date_id=case when date_id=choice then null else date_id end,
    stay_id=case when stay_id=choice then null else stay_id end,transport_id=case when transport_id=choice then null else transport_id end,updated_at=now() where room_id=p_room;
   if o.date_id=choice then update tripcircle_private.rooms set dates='' where id=p_room; end if;
  else
   if exists(select 1 from tripcircle_private.choice_votes where choice_id=choice and user_id=uid) then
    delete from tripcircle_private.choice_votes where choice_id=choice and user_id=uid;
   else
    if c.kind<>'date' then delete from tripcircle_private.choice_votes v using tripcircle_private.room_choices cc where v.choice_id=cc.id and v.user_id=uid and cc.room_id=p_room and cc.kind=c.kind; end if;
    insert into tripcircle_private.choice_votes(choice_id,user_id) values(choice,uid);
   end if;
  end if;
 elsif p_action='save_overview' then
  if not owner then raise exception 'Only the organizer can confirm the final trip'; end if;
  did:=nullif(p_data->>'destination_id','');dateid:=nullif(p_data->>'date_id','')::uuid;stayid:=nullif(p_data->>'stay_id','')::uuid;transportid:=nullif(p_data->>'transport_id','')::uuid;
  if did is not null and not (access->'plan'->'destinations' ? did) then raise exception 'Confirm a shortlisted destination'; end if;
  if dateid is not null then select * into datechoice from tripcircle_private.room_choices where id=dateid and room_id=p_room and kind='date' and not archived; if datechoice.id is null then raise exception 'Choose a date option from this room'; end if; end if;
  if stayid is not null and not exists(select 1 from tripcircle_private.room_choices where id=stayid and room_id=p_room and kind='stay' and not archived) then raise exception 'Choose a stay option from this room'; end if;
  if transportid is not null and not exists(select 1 from tripcircle_private.room_choices where id=transportid and room_id=p_room and kind='transport' and not archived) then raise exception 'Choose a transport option from this room'; end if;
  select * into o from tripcircle_private.room_overview where room_id=p_room;
  insert into tripcircle_private.room_overview(room_id,destination_id,date_id,stay_id,transport_id,meeting_point,meeting_time)
   values(p_room,did,dateid,stayid,transportid,trim(coalesce(p_data->>'meeting_point','')),trim(coalesce(p_data->>'meeting_time','')))
   on conflict(room_id) do update set destination_id=excluded.destination_id,date_id=excluded.date_id,stay_id=excluded.stay_id,transport_id=excluded.transport_id,meeting_point=excluded.meeting_point,meeting_time=excluded.meeting_time,updated_at=now();
  update tripcircle_private.rooms set budget=trim(coalesce(p_data->>'budget',budget)),dates=case when dateid is not null then to_char(datechoice.starts,'DD Mon YYYY')||' – '||to_char(datechoice.ends,'DD Mon YYYY') when o.date_id is not null then '' else dates end where id=p_room;
 else raise exception 'Unknown decision action'; end if;
 return jsonb_build_object('saved',true);
end $$;
revoke all on function tripcircle_private.decision_action(text,uuid,jsonb) from public;
grant execute on function tripcircle_private.decision_action(text,uuid,jsonb) to anon,authenticated;
create function public.tripcircle_decisions(p_action text,p_room uuid,p_data jsonb default '{}')
returns jsonb language sql security invoker set search_path='' as $$ select tripcircle_private.decision_action(p_action,p_room,p_data) $$;
revoke all on function public.tripcircle_decisions(text,uuid,jsonb) from public;
grant execute on function public.tripcircle_decisions(text,uuid,jsonb) to anon,authenticated;
notify pgrst,'reload schema';
