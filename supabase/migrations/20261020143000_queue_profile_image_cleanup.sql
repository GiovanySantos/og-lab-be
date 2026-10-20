create table public.profile_image_cleanup (
  id uuid primary key default gen_random_uuid(),
  object_key text not null unique,
  owner_id uuid not null,
  created_at timestamptz not null default now(),
  next_attempt_at timestamptz not null default now()
);

create index profile_image_cleanup_pending_idx
  on public.profile_image_cleanup (next_attempt_at, created_at);

create index profile_image_cleanup_owner_idx
  on public.profile_image_cleanup (owner_id, created_at);

alter table public.profile_image_cleanup enable row level security;
revoke all on public.profile_image_cleanup from anon, authenticated;
grant all on public.profile_image_cleanup to service_role;

create function public.queue_profile_image_cleanup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.profile_image_key is not null
    and old.profile_image_key is distinct from new.profile_image_key
  then
    insert into public.profile_image_cleanup (object_key, owner_id)
    values (old.profile_image_key, old.id)
    on conflict do nothing;
  end if;

  return new;
end;
$$;

revoke all on function public.queue_profile_image_cleanup() from public;
revoke all on function public.queue_profile_image_cleanup() from anon, authenticated;

create trigger users_queue_profile_image_cleanup
after update of profile_image_key on public.users
for each row
execute function public.queue_profile_image_cleanup();
