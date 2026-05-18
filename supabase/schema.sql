create extension if not exists pgcrypto;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  topic text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_slides (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  position integer not null,
  name text not null,
  background text not null,
  elements jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public)
values ('carousel-assets', 'carousel-assets', true)
on conflict (id) do nothing;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_projects_set_updated_at on public.projects;

create trigger trg_projects_set_updated_at
before update on public.projects
for each row
execute function public.set_updated_at();

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  role text,
  topic text,
  login text unique,
  credits integer not null default 5,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists name text,
  add column if not exists role text,
  add column if not exists topic text,
  add column if not exists login text,
  add column if not exists credits integer not null default 5,
  add column if not exists is_admin boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.credits_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);

drop trigger if exists trg_profiles_set_updated_at on public.profiles;

create trigger trg_profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

revoke insert, update, delete on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant insert (id, name, role, topic, login) on public.profiles to authenticated;
grant update (name, role, topic, login) on public.profiles to authenticated;
revoke insert, update, delete on public.credits_log from authenticated;
grant select on public.credits_log to authenticated;

alter table public.profiles enable row level security;
alter table public.credits_log enable row level security;
alter table public.projects enable row level security;
alter table public.project_slides enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
  loop
    execute format('drop policy if exists %I on public.profiles', policy_record.policyname);
  end loop;
end;
$$;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles
for insert
with check (auth.uid() = id);

drop policy if exists "Users can update own profile basics" on public.profiles;
create policy "Users can update own profile basics"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Users can view own credits log" on public.credits_log;
create policy "Users can view own credits log"
on public.credits_log
for select
using (auth.uid() = user_id);

drop policy if exists "Users can view own projects" on public.projects;
create policy "Users can view own projects"
on public.projects
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own projects" on public.projects;
create policy "Users can insert own projects"
on public.projects
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own projects" on public.projects;
create policy "Users can update own projects"
on public.projects
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own projects" on public.projects;
create policy "Users can delete own projects"
on public.projects
for delete
using (auth.uid() = user_id);

drop policy if exists "Users can view own slides" on public.project_slides;
create policy "Users can view own slides"
on public.project_slides
for select
using (
  exists (
    select 1
    from public.projects
    where projects.id = project_slides.project_id
      and projects.user_id = auth.uid()
  )
);

drop policy if exists "Users can insert own slides" on public.project_slides;
create policy "Users can insert own slides"
on public.project_slides
for insert
with check (
  exists (
    select 1
    from public.projects
    where projects.id = project_slides.project_id
      and projects.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own slides" on public.project_slides;
create policy "Users can update own slides"
on public.project_slides
for update
using (
  exists (
    select 1
    from public.projects
    where projects.id = project_slides.project_id
      and projects.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.projects
    where projects.id = project_slides.project_id
      and projects.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own slides" on public.project_slides;
create policy "Users can delete own slides"
on public.project_slides
for delete
using (
  exists (
    select 1
    from public.projects
    where projects.id = project_slides.project_id
      and projects.user_id = auth.uid()
  )
);

drop policy if exists "Users can upload own carousel assets" on storage.objects;
create policy "Users can upload own carousel assets"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'carousel-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can update own carousel assets" on storage.objects;
create policy "Users can update own carousel assets"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'carousel-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'carousel-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete own carousel assets" on storage.objects;
create policy "Users can delete own carousel assets"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'carousel-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Public can read carousel assets" on storage.objects;
create policy "Public can read carousel assets"
on storage.objects
for select
to public
using (bucket_id = 'carousel-assets');
