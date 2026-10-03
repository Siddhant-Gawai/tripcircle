-- TripCircle room planner. Private tables are accessed only through checked RPCs.
create table tripcircle_private.rooms (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 code text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),
 title text not null check(length(title) between 2 and 100), origin text not null check(length(origin) between 2 and 100),
 summary text not null default '' check(length(summary)<=1000), dates text not null default '' check(length(dates)<=100),
 budget text not null default '' check(length(budget)<=100), capacity int not null default 7 check(capacity between 2 and 50),
 visibility text not null default 'private' check(visibility in ('private','public')), created_at timestamptz not null default now());
create index tripcircle_rooms_owner on tripcircle_private.rooms(owner_id);
create index tripcircle_rooms_public_time on tripcircle_private.rooms(created_at desc) where visibility='public';
create table tripcircle_private.room_members (
 room_id uuid not null references tripcircle_private.rooms(id), user_id uuid not null references auth.users(id),
 name text not null check(length(name) between 2 and 60), status text not null default 'pending' check(status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(), primary key(room_id,user_id));
create index tripcircle_room_members_user on tripcircle_private.room_members(user_id);
create table tripcircle_private.room_plans (
 room_id uuid primary key references tripcircle_private.rooms(id), days jsonb not null default '[]',
 notes text not null default '' check(length(notes)<=4000), checklist jsonb not null default '[]',
 destinations jsonb not null default '[]', updated_at timestamptz not null default now());
create table tripcircle_private.room_posts (
 id uuid primary key default gen_random_uuid(), room_id uuid not null references tripcircle_private.rooms(id),
 user_id uuid not null references auth.users(id), body text not null check(length(body) between 1 and 1500),
 kind text not null check(kind in ('comment','suggestion')), created_at timestamptz not null default now());
create index tripcircle_room_posts_time on tripcircle_private.room_posts(room_id,created_at desc);
create index tripcircle_room_posts_author on tripcircle_private.room_posts(user_id,created_at desc);
create table tripcircle_private.room_votes (
 room_id uuid not null references tripcircle_private.rooms(id), user_id uuid not null references auth.users(id),
 destination_id text not null references public.tripcircle_destinations(id), primary key(room_id,user_id));
create index tripcircle_room_votes_user on tripcircle_private.room_votes(user_id);
alter table tripcircle_private.rooms enable row level security;
alter table tripcircle_private.room_members enable row level security;
alter table tripcircle_private.room_plans enable row level security;
alter table tripcircle_private.room_posts enable row level security;
alter table tripcircle_private.room_votes enable row level security;
revoke all on tripcircle_private.rooms,tripcircle_private.room_members,tripcircle_private.room_plans,tripcircle_private.room_posts,tripcircle_private.room_votes from public,anon,authenticated;
create function tripcircle_private.room_action(p_action text,p_room uuid default null,p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); r tripcircle_private.rooms; m tripcircle_private.room_members; plan tripcircle_private.room_plans;
 owner boolean; result jsonb; target uuid; n text; ds jsonb; item jsonb;
begin
 if p_action='list' then
  return coalesce((select jsonb_agg(x) from (select id,title,origin,summary,dates,budget,capacity,visibility,
   (select count(*) from tripcircle_private.room_members mm where mm.room_id=rr.id and status='approved') as members
   from tripcircle_private.rooms rr where visibility='public' order by created_at desc limit 100) x),'[]');
 end if;
 if p_action='view' and uid is null then
  select * into r from tripcircle_private.rooms where id=p_room and visibility='public';
  if r.id is null then raise exception 'Sign in to join a private room'; end if;
  return jsonb_build_object('id',r.id,'title',r.title,'origin',r.origin,'summary',r.summary,'dates',r.dates,'budget',r.budget,'capacity',r.capacity,'visibility',r.visibility,'status','visitor','organizer',false);
 end if;
 if uid is null or not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null and not coalesce(is_anonymous,false)) then raise exception 'Sign in to continue'; end if;
 if p_action='mine' then
  return coalesce((select jsonb_agg(x) from (select rr.id,rr.title,rr.origin,rr.summary,rr.dates,rr.budget,rr.capacity,rr.visibility,
   mm.status,rr.owner_id=uid as organizer from tripcircle_private.rooms rr join tripcircle_private.room_members mm on mm.room_id=rr.id
   where mm.user_id=uid order by rr.created_at desc) x),'[]');
 end if;
 if p_action='create' then
  n:=trim(p_data->>'name');
  if n is null or length(n) not between 2 and 60 then raise exception 'Add your display name'; end if;
  if (select count(*) from tripcircle_private.rooms where owner_id=uid and created_at>now()-interval '1 day')>=10 then raise exception 'You can create up to 10 trips per day'; end if;
  insert into tripcircle_private.rooms(owner_id,title,origin,summary,dates,budget,capacity,visibility)
   values(uid,trim(p_data->>'title'),trim(p_data->>'origin'),coalesce(p_data->>'summary',''),coalesce(p_data->>'dates',''),coalesce(p_data->>'budget',''),coalesce((p_data->>'capacity')::int,7),coalesce(p_data->>'visibility','private')) returning * into r;
  insert into tripcircle_private.room_members(room_id,user_id,name,status) values(r.id,uid,n,'approved');
  insert into tripcircle_private.room_plans(room_id,checklist) values(r.id,'[{"id":"first-aid","title":"First-aid kit","owner":"","done":false},{"id":"water","title":"Water bottles","owner":"Everyone","done":false},{"id":"charger","title":"Chargers / power banks","owner":"Everyone","done":false}]');
  return jsonb_build_object('id',r.id,'code',r.code);
 end if;
 if p_action='join' and p_room is null then select * into r from tripcircle_private.rooms where code=upper(trim(p_data->>'code')) for update;
 else select * into r from tripcircle_private.rooms where id=p_room for update; end if;
 if r.id is null then raise exception 'Trip not found. Check the room code'; end if;
 owner:=r.owner_id=uid;
 select * into m from tripcircle_private.room_members where room_id=r.id and user_id=uid;
 if p_action='join' then
  if r.visibility='private' and r.code<>upper(trim(coalesce(p_data->>'code',''))) then raise exception 'Enter the room code'; end if;
  n:=trim(p_data->>'name');
  if n is null or length(n) not between 2 and 60 then raise exception 'Add your display name'; end if;
  if m.user_id is not null then return jsonb_build_object('id',r.id,'status',m.status); end if;
  if (select count(*) from tripcircle_private.room_members where room_id=r.id and status='pending')>=100 then raise exception 'This trip has too many pending requests'; end if;
  insert into tripcircle_private.room_members(room_id,user_id,name) values(r.id,uid,n);
  return jsonb_build_object('id',r.id,'status','pending');
 end if;
 if p_action='view' then
  if not owner and m.user_id is null and r.visibility<>'public' then raise exception 'Request to join with the room code'; end if;
  result:=jsonb_build_object('id',r.id,'title',r.title,'origin',r.origin,'summary',r.summary,'dates',r.dates,'budget',r.budget,'capacity',r.capacity,'visibility',r.visibility,'organizer',owner,'status',coalesce(m.status,'visitor'));
  if not owner and coalesce(m.status,'')<>'approved' then return result; end if;
  select * into plan from tripcircle_private.room_plans where room_id=r.id;
  result:=result||jsonb_build_object('plan',to_jsonb(plan)-'room_id','name',m.name,'members',coalesce((select jsonb_agg(jsonb_build_object('name',mm.name,'status',mm.status,'id',case when owner then mm.user_id else null end,'organizer',mm.user_id=r.owner_id)) from tripcircle_private.room_members mm where mm.room_id=r.id and (owner or mm.status='approved')),'[]'),
   'posts',coalesce((select jsonb_agg(x) from (select pp.id,mm.name,pp.body,pp.kind,pp.created_at,pp.user_id=uid as mine from tripcircle_private.room_posts pp join tripcircle_private.room_members mm on mm.room_id=pp.room_id and mm.user_id=pp.user_id where pp.room_id=r.id order by pp.created_at desc limit 100) x),'[]'),
   'votes',coalesce((select jsonb_object_agg(x.destination_id,x.n) from (select destination_id,count(*) n from tripcircle_private.room_votes where room_id=r.id group by destination_id) x),'{}'),
   'my_vote',(select destination_id from tripcircle_private.room_votes where room_id=r.id and user_id=uid));
  if owner then result:=result||jsonb_build_object('code',r.code); end if;
  return result;
 end if;
 if not owner and coalesce(m.status,'')<>'approved' then raise exception 'Organizer approval is needed'; end if;
 if p_action in ('approve','reject') then
  if not owner then raise exception 'Only the organizer can manage requests'; end if;
  target:=(p_data->>'user_id')::uuid;
  if target=uid then raise exception 'Organizer membership cannot be changed'; end if;
  if p_action='approve' and (select count(*) from tripcircle_private.room_members where room_id=r.id and status='approved')>=r.capacity then raise exception 'This trip is full'; end if;
  update tripcircle_private.room_members set status=case when p_action='approve' then 'approved' else 'rejected' end where room_id=r.id and user_id=target and status='pending';
  if not found then raise exception 'Joining request not found'; end if;
 elsif p_action='remove_member' then
  if not owner then raise exception 'Only the organizer can remove a member'; end if;
  target:=(p_data->>'user_id')::uuid;
  if target=uid then raise exception 'Organizer membership cannot be changed'; end if;
  update tripcircle_private.room_members set status='rejected' where room_id=r.id and user_id=target and status='approved';
  if not found then raise exception 'Member not found'; end if;
  delete from tripcircle_private.room_votes where room_id=r.id and user_id=target;
 elsif p_action='save_plan' then
  if not owner then raise exception 'Suggest changes in the discussion; the organizer saves the final plan'; end if;
  ds:=p_data->'days';
  if ds is null or jsonb_typeof(ds)<>'array' or jsonb_array_length(ds)>21 or octet_length(ds::text)>25000 then raise exception 'Use up to 21 days with shorter descriptions'; end if;
  for item in select value from jsonb_array_elements(ds) loop
   if jsonb_typeof(item)<>'object' or length(coalesce(item->>'title',''))>150 or length(coalesce(item->>'body',''))>3000 then raise exception 'Invalid day details'; end if;
  end loop;
  update tripcircle_private.room_plans set days=ds,notes=coalesce(p_data->>'notes',''),updated_at=now() where room_id=r.id;
  update tripcircle_private.rooms set dates=coalesce(p_data->>'dates',dates) where id=r.id;
 elsif p_action='visibility' then
  if not owner then raise exception 'Only the organizer can publish a trip'; end if;
  update tripcircle_private.rooms set visibility=p_data->>'visibility' where id=r.id;
 elsif p_action='shortlist' then
  if not owner then raise exception 'Suggest a place in the discussion'; end if;
  if not exists(select 1 from public.tripcircle_destinations where id=p_data->>'destination') then raise exception 'Place not found'; end if;
  select * into plan from tripcircle_private.room_plans where room_id=r.id;
  ds:=plan.destinations;
  if ds ? (p_data->>'destination') then ds:=ds-(p_data->>'destination'); delete from tripcircle_private.room_votes where room_id=r.id and destination_id=p_data->>'destination';
  else ds:=ds||jsonb_build_array(p_data->>'destination'); end if;
  update tripcircle_private.room_plans set destinations=ds,updated_at=now() where room_id=r.id;
 elsif p_action='vote' then
  if p_data->>'destination' is null then delete from tripcircle_private.room_votes where room_id=r.id and user_id=uid;
  else
   if not exists(select 1 from tripcircle_private.room_plans where room_id=r.id and destinations ? (p_data->>'destination')) then raise exception 'Pick a shortlisted place'; end if;
   insert into tripcircle_private.room_votes(room_id,user_id,destination_id) values(r.id,uid,p_data->>'destination') on conflict(room_id,user_id) do update set destination_id=excluded.destination_id;
  end if;
 elsif p_action='post' then
  if (select count(*) from tripcircle_private.room_posts where user_id=uid and created_at>now()-interval '1 hour')>=20 then raise exception 'Please wait before sharing more messages'; end if;
  insert into tripcircle_private.room_posts(room_id,user_id,body,kind) values(r.id,uid,trim(p_data->>'body'),coalesce(p_data->>'kind','comment'));
 elsif p_action='remove_post' then
  delete from tripcircle_private.room_posts where room_id=r.id and id=(p_data->>'post_id')::uuid and user_id=uid;
  if not found then raise exception 'You can only remove your own message'; end if;
 elsif p_action='add_task' then
  n:=trim(p_data->>'title');
  if n is null or length(n) not between 1 and 150 or length(coalesce(p_data->>'owner',''))>60 then raise exception 'Add a shorter item and assignee'; end if;
  select * into plan from tripcircle_private.room_plans where room_id=r.id;
  if jsonb_array_length(plan.checklist)>=100 then raise exception 'Use up to 100 checklist items'; end if;
  update tripcircle_private.room_plans set checklist=checklist||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title',n,'owner',coalesce(p_data->>'owner',''),'done',false)),updated_at=now() where room_id=r.id;
 elsif p_action='toggle_task' then
  update tripcircle_private.room_plans set checklist=(select coalesce(jsonb_agg(case when value->>'id'=p_data->>'task_id' then jsonb_set(value,'{done}',to_jsonb(not coalesce((value->>'done')::boolean,false))) else value end order by ord),'[]') from jsonb_array_elements(checklist) with ordinality as e(value,ord)),updated_at=now() where room_id=r.id;
 else raise exception 'Unknown room action'; end if;
 return jsonb_build_object('saved',true);
end $$;
revoke all on function tripcircle_private.room_action(text,uuid,jsonb) from public;
grant execute on function tripcircle_private.room_action(text,uuid,jsonb) to anon,authenticated;
create function public.tripcircle_rooms(p_action text,p_room uuid default null,p_data jsonb default '{}')
returns jsonb language sql security invoker set search_path='' as $$ select tripcircle_private.room_action(p_action,p_room,p_data) $$;
revoke all on function public.tripcircle_rooms(text,uuid,jsonb) from public;
grant execute on function public.tripcircle_rooms(text,uuid,jsonb) to anon,authenticated;
notify pgrst,'reload schema';
