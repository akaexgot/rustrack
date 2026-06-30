create extension if not exists "pgcrypto";

create type public.subscription_plan as enum ('free', 'pro');
create type public.player_event_type as enum ('connected', 'disconnected');
create type public.wipe_role as enum ('owner', 'admin', 'member', 'readonly');
create type public.subscription_status as enum (
  'incomplete',
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'paused'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  auth_provider text not null default 'email',
  plan public.subscription_plan not null default 'free',
  created_at timestamptz not null default now()
);

create table public.favorite_servers (
  user_id uuid not null references public.profiles(id) on delete cascade,
  battlemetrics_server_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, battlemetrics_server_id)
);

create table public.tracked_players (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  battlemetrics_server_id text not null,
  battlemetrics_player_id text not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, battlemetrics_server_id, battlemetrics_player_id)
);

create table public.player_notes (
  id uuid primary key default gen_random_uuid(),
  tracked_player_id uuid not null references public.tracked_players(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.player_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 48),
  color text not null default '#7dd3fc',
  created_at timestamptz not null default now()
);

create table public.tracked_player_tags (
  tracked_player_id uuid not null references public.tracked_players(id) on delete cascade,
  tag_id uuid not null references public.player_tags(id) on delete cascade,
  primary key (tracked_player_id, tag_id)
);

create table public.player_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 64),
  created_at timestamptz not null default now()
);

create table public.tracked_player_groups (
  tracked_player_id uuid not null references public.tracked_players(id) on delete cascade,
  group_id uuid not null references public.player_groups(id) on delete cascade,
  primary key (tracked_player_id, group_id)
);

create table public.player_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  battlemetrics_server_id text not null,
  battlemetrics_player_id text not null,
  event_type public.player_event_type not null,
  created_at timestamptz not null default now()
);

create table public.wipes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  battlemetrics_server_id text not null,
  name text not null check (char_length(name) between 1 and 120),
  created_at timestamptz not null default now()
);

create table public.wipe_members (
  wipe_id uuid not null references public.wipes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.wipe_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (wipe_id, user_id)
);

create table public.wipe_tracked_players (
  id uuid primary key default gen_random_uuid(),
  wipe_id uuid not null references public.wipes(id) on delete cascade,
  battlemetrics_server_id text not null,
  battlemetrics_player_id text not null,
  display_name text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (wipe_id, battlemetrics_server_id, battlemetrics_player_id)
);

create table public.wipe_notes (
  id uuid primary key default gen_random_uuid(),
  wipe_id uuid not null references public.wipes(id) on delete cascade,
  wipe_tracked_player_id uuid references public.wipe_tracked_players(id) on delete set null,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.wipe_chat_messages (
  id uuid primary key default gen_random_uuid(),
  wipe_id uuid not null references public.wipes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table public.map_markers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  wipe_id uuid references public.wipes(id) on delete cascade,
  battlemetrics_server_id text not null,
  label text not null check (char_length(label) between 1 and 120),
  grid_ref text,
  x numeric(8, 5) check (x is null or (x >= 0 and x <= 1)),
  y numeric(8, 5) check (y is null or (y >= 0 and y <= 1)),
  note text check (note is null or char_length(note) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notification_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  unique (user_id, endpoint)
);

create table public.billing_customers (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  subscription_status public.subscription_status,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create index favorite_servers_user_id_idx on public.favorite_servers(user_id);
create index tracked_players_user_server_idx on public.tracked_players(user_id, battlemetrics_server_id);
create index tracked_players_player_idx on public.tracked_players(battlemetrics_player_id);
create index player_notes_player_created_idx on public.player_notes(tracked_player_id, created_at desc);
create index player_tags_user_id_idx on public.player_tags(user_id);
create unique index player_tags_user_lower_name_idx on public.player_tags(user_id, lower(name));
create index player_groups_user_id_idx on public.player_groups(user_id);
create unique index player_groups_user_lower_name_idx on public.player_groups(user_id, lower(name));
create index player_events_user_server_created_idx on public.player_events(user_id, battlemetrics_server_id, created_at desc);
create index player_events_player_created_idx on public.player_events(battlemetrics_player_id, created_at desc);
create index wipes_owner_id_idx on public.wipes(owner_id);
create index wipes_server_id_idx on public.wipes(battlemetrics_server_id);
create index wipe_members_user_id_idx on public.wipe_members(user_id);
create index wipe_tracked_players_wipe_id_idx on public.wipe_tracked_players(wipe_id);
create index wipe_notes_wipe_created_idx on public.wipe_notes(wipe_id, created_at desc);
create index wipe_chat_messages_wipe_created_idx on public.wipe_chat_messages(wipe_id, created_at desc);
create index map_markers_user_server_idx on public.map_markers(user_id, battlemetrics_server_id);
create index map_markers_wipe_id_idx on public.map_markers(wipe_id) where wipe_id is not null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tracked_players_set_updated_at
before update on public.tracked_players
for each row execute function public.set_updated_at();

create trigger player_notes_set_updated_at
before update on public.player_notes
for each row execute function public.set_updated_at();

create trigger wipe_notes_set_updated_at
before update on public.wipe_notes
for each row execute function public.set_updated_at();

create trigger map_markers_set_updated_at
before update on public.map_markers
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, auth_provider)
  values (
    new.id,
    coalesce(new.raw_app_meta_data ->> 'provider', 'email')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.add_wipe_owner_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.wipe_members (wipe_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (wipe_id, user_id) do update
    set role = 'owner';

  return new;
end;
$$;

create trigger wipes_add_owner_member
after insert on public.wipes
for each row execute function public.add_wipe_owner_member();

create or replace function public.is_wipe_member(target_wipe_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.wipe_members wm
    where wm.wipe_id = target_wipe_id
      and wm.user_id = auth.uid()
  );
$$;

create or replace function public.can_edit_wipe(target_wipe_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.wipe_members wm
    where wm.wipe_id = target_wipe_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin', 'member')
  );
$$;

create or replace function public.can_admin_wipe(target_wipe_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.wipe_members wm
    where wm.wipe_id = target_wipe_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin')
  );
$$;

alter table public.profiles enable row level security;
alter table public.favorite_servers enable row level security;
alter table public.tracked_players enable row level security;
alter table public.player_notes enable row level security;
alter table public.player_tags enable row level security;
alter table public.tracked_player_tags enable row level security;
alter table public.player_groups enable row level security;
alter table public.tracked_player_groups enable row level security;
alter table public.player_events enable row level security;
alter table public.wipes enable row level security;
alter table public.wipe_members enable row level security;
alter table public.wipe_tracked_players enable row level security;
alter table public.wipe_notes enable row level security;
alter table public.wipe_chat_messages enable row level security;
alter table public.map_markers enable row level security;
alter table public.notification_subscriptions enable row level security;
alter table public.billing_customers enable row level security;

create policy "profiles_select_own" on public.profiles
for select using (id = auth.uid());

create policy "profiles_update_own" on public.profiles
for update using (id = auth.uid()) with check (id = auth.uid());

create policy "favorite_servers_own_all" on public.favorite_servers
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "tracked_players_own_all" on public.tracked_players
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "player_notes_own_select" on public.player_notes
for select using (
  user_id = auth.uid()
  and exists (
    select 1 from public.tracked_players tp
    where tp.id = tracked_player_id and tp.user_id = auth.uid()
  )
);

create policy "player_notes_own_insert" on public.player_notes
for insert with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.tracked_players tp
    where tp.id = tracked_player_id and tp.user_id = auth.uid()
  )
);

create policy "player_notes_own_update" on public.player_notes
for update using (
  user_id = auth.uid()
  and exists (
    select 1 from public.tracked_players tp
    where tp.id = tracked_player_id and tp.user_id = auth.uid()
  )
) with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.tracked_players tp
    where tp.id = tracked_player_id and tp.user_id = auth.uid()
  )
);

create policy "player_notes_own_delete" on public.player_notes
for delete using (
  user_id = auth.uid()
  and exists (
    select 1 from public.tracked_players tp
    where tp.id = tracked_player_id and tp.user_id = auth.uid()
  )
);

create policy "player_tags_own_all" on public.player_tags
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "tracked_player_tags_own_select" on public.tracked_player_tags
for select using (
  exists (
    select 1 from public.tracked_players tp
    where tp.id = tracked_player_id and tp.user_id = auth.uid()
  )
);

create policy "tracked_player_tags_own_insert" on public.tracked_player_tags
for insert with check (
  exists (
    select 1 from public.tracked_players tp
    where tp.id = tracked_player_id and tp.user_id = auth.uid()
  )
  and exists (
    select 1 from public.player_tags pt
    where pt.id = tag_id and pt.user_id = auth.uid()
  )
);

create policy "tracked_player_tags_own_delete" on public.tracked_player_tags
for delete using (
  exists (
    select 1 from public.tracked_players tp
    where tp.id = tracked_player_id and tp.user_id = auth.uid()
  )
);

create policy "player_groups_own_all" on public.player_groups
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "tracked_player_groups_own_select" on public.tracked_player_groups
for select using (
  exists (
    select 1 from public.tracked_players tp
    where tp.id = tracked_player_id and tp.user_id = auth.uid()
  )
);

create policy "tracked_player_groups_own_insert" on public.tracked_player_groups
for insert with check (
  exists (
    select 1 from public.tracked_players tp
    where tp.id = tracked_player_id and tp.user_id = auth.uid()
  )
  and exists (
    select 1 from public.player_groups pg
    where pg.id = group_id and pg.user_id = auth.uid()
  )
);

create policy "tracked_player_groups_own_delete" on public.tracked_player_groups
for delete using (
  exists (
    select 1 from public.tracked_players tp
    where tp.id = tracked_player_id and tp.user_id = auth.uid()
  )
);

create policy "player_events_own_all" on public.player_events
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "wipes_member_select" on public.wipes
for select using (public.is_wipe_member(id));

create policy "wipes_owner_insert" on public.wipes
for insert with check (owner_id = auth.uid());

create policy "wipes_admin_update" on public.wipes
for update using (public.can_admin_wipe(id)) with check (public.can_admin_wipe(id));

create policy "wipes_owner_delete" on public.wipes
for delete using (owner_id = auth.uid());

create policy "wipe_members_member_select" on public.wipe_members
for select using (public.is_wipe_member(wipe_id));

create policy "wipe_members_admin_insert" on public.wipe_members
for insert with check (public.can_admin_wipe(wipe_id));

create policy "wipe_members_admin_update" on public.wipe_members
for update using (public.can_admin_wipe(wipe_id)) with check (public.can_admin_wipe(wipe_id));

create policy "wipe_members_admin_delete" on public.wipe_members
for delete using (public.can_admin_wipe(wipe_id));

create policy "wipe_tracked_players_member_select" on public.wipe_tracked_players
for select using (public.is_wipe_member(wipe_id));

create policy "wipe_tracked_players_editor_insert" on public.wipe_tracked_players
for insert with check (public.can_edit_wipe(wipe_id) and created_by = auth.uid());

create policy "wipe_tracked_players_editor_update" on public.wipe_tracked_players
for update using (public.can_edit_wipe(wipe_id)) with check (public.can_edit_wipe(wipe_id));

create policy "wipe_tracked_players_editor_delete" on public.wipe_tracked_players
for delete using (public.can_edit_wipe(wipe_id));

create policy "wipe_notes_member_select" on public.wipe_notes
for select using (public.is_wipe_member(wipe_id));

create policy "wipe_notes_editor_insert" on public.wipe_notes
for insert with check (public.can_edit_wipe(wipe_id) and author_id = auth.uid());

create policy "wipe_notes_author_or_admin_update" on public.wipe_notes
for update using (author_id = auth.uid() or public.can_admin_wipe(wipe_id))
with check (public.can_edit_wipe(wipe_id));

create policy "wipe_notes_author_or_admin_delete" on public.wipe_notes
for delete using (author_id = auth.uid() or public.can_admin_wipe(wipe_id));

create policy "wipe_chat_member_select" on public.wipe_chat_messages
for select using (public.is_wipe_member(wipe_id));

create policy "wipe_chat_editor_insert" on public.wipe_chat_messages
for insert with check (public.can_edit_wipe(wipe_id) and user_id = auth.uid());

create policy "map_markers_private_or_wipe_select" on public.map_markers
for select using (
  user_id = auth.uid()
  or (wipe_id is not null and public.is_wipe_member(wipe_id))
);

create policy "map_markers_private_or_wipe_insert" on public.map_markers
for insert with check (
  user_id = auth.uid()
  and (wipe_id is null or public.can_edit_wipe(wipe_id))
);

create policy "map_markers_private_or_wipe_update" on public.map_markers
for update using (
  user_id = auth.uid()
  or (wipe_id is not null and public.can_edit_wipe(wipe_id))
) with check (
  user_id = auth.uid()
  and (wipe_id is null or public.can_edit_wipe(wipe_id))
);

create policy "map_markers_private_or_wipe_delete" on public.map_markers
for delete using (
  user_id = auth.uid()
  or (wipe_id is not null and public.can_edit_wipe(wipe_id))
);

create policy "notification_subscriptions_own_all" on public.notification_subscriptions
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "billing_customers_own_select" on public.billing_customers
for select using (user_id = auth.uid());

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.wipes,
      public.wipe_members,
      public.wipe_tracked_players,
      public.wipe_notes,
      public.wipe_chat_messages;
  else
    create publication supabase_realtime for table
      public.wipes,
      public.wipe_members,
      public.wipe_tracked_players,
      public.wipe_notes,
      public.wipe_chat_messages;
  end if;
end;
$$;
