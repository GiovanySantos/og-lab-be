create table public.users (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  email text not null check (email = lower(email)),
  password_hash text not null,
  profile_image_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_username_length check (char_length(username) between 3 and 32)
);

create unique index users_username_lower_unique
  on public.users (lower(username));

create unique index users_email_lower_unique
  on public.users (lower(email));

create function public.set_users_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_set_updated_at
before update on public.users
for each row
execute function public.set_users_updated_at();

alter table public.users enable row level security;

revoke all on public.users from anon, authenticated;
grant all on public.users to service_role;
