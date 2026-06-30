insert into public.player_tags (id, user_id, name, color)
select gen_random_uuid(), id, 'Muy activo', '#22c55e'
from public.profiles
on conflict do nothing;

insert into public.player_tags (id, user_id, name, color)
select gen_random_uuid(), id, 'Posible aliado', '#38bdf8'
from public.profiles
on conflict do nothing;

insert into public.player_tags (id, user_id, name, color)
select gen_random_uuid(), id, 'Clan enemigo', '#ef4444'
from public.profiles
on conflict do nothing;

insert into public.player_groups (id, user_id, name)
select gen_random_uuid(), id, 'Vecinos'
from public.profiles
on conflict do nothing;

insert into public.player_groups (id, user_id, name)
select gen_random_uuid(), id, 'Raid Targets'
from public.profiles
on conflict do nothing;

