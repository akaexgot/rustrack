alter table public.tracked_players
add column if not exists group_name text not null default 'General'
check (char_length(group_name) between 1 and 64);

alter table public.tracked_players
add column if not exists base_location text
check (base_location is null or char_length(base_location) <= 80);

update public.tracked_players
set group_name = 'General'
where group_name is null or btrim(group_name) = '';
