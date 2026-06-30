create table if not exists public.user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  voice_enabled boolean not null default false,
  alert_settings jsonb not null default '{
    "trackedOnline": true,
    "trackedOffline": true,
    "queue": false,
    "wipe": true,
    "notes": false
  }'::jsonb,
  ui_settings jsonb not null default '{
    "compactPlayers": true,
    "mapLabels": true,
    "autoOpenTracked": false
  }'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_settings_set_updated_at
before update on public.user_settings
for each row execute function public.set_updated_at();

alter table public.user_settings enable row level security;

create policy "user_settings_own_all" on public.user_settings
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.create_default_intel_for_profile(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_settings (user_id)
  values (target_user_id)
  on conflict (user_id) do nothing;

  insert into public.player_tags (user_id, name, color)
  values
    (target_user_id, 'Muy activo', '#22c55e'),
    (target_user_id, 'Posible aliado', '#38bdf8'),
    (target_user_id, 'Clan enemigo', '#ef4444'),
    (target_user_id, 'Vive cerca', '#f97316'),
    (target_user_id, 'Tiene AK', '#eab308')
  on conflict do nothing;

  insert into public.player_groups (user_id, name)
  values
    (target_user_id, 'Vecinos'),
    (target_user_id, 'Raid Targets'),
    (target_user_id, 'Aliados'),
    (target_user_id, 'Clan Enemigo')
  on conflict do nothing;
end;
$$;

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

  perform public.create_default_intel_for_profile(new.id);

  return new;
end;
$$;

do $$
declare
  profile_record record;
begin
  for profile_record in select id from public.profiles loop
    perform public.create_default_intel_for_profile(profile_record.id);
  end loop;
end;
$$;

grant usage on schema public to anon, authenticated;

grant select on all tables in schema public to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;

grant usage, select on all sequences in schema public to anon, authenticated;

alter default privileges in schema public
grant select on tables to anon;

alter default privileges in schema public
grant select, insert, update, delete on tables to authenticated;

alter default privileges in schema public
grant usage, select on sequences to anon, authenticated;
