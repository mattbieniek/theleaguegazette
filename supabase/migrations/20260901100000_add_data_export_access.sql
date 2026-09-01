create table if not exists public.data_export_readers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

alter table public.data_export_readers enable row level security;

drop policy if exists "Data readers can read their own access" on public.data_export_readers;
create policy "Data readers can read their own access"
  on public.data_export_readers for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Admins can manage data reader access" on public.data_export_readers;
create policy "Admins can manage data reader access"
  on public.data_export_readers for all
  to authenticated
  using (exists (
    select 1 from public.admin_users
    where admin_users.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.admin_users
    where admin_users.user_id = auth.uid()
  ));

grant select on public.data_export_readers to authenticated;

drop function if exists public.admin_site_accounts();
create function public.admin_site_accounts()
returns table (
  user_id uuid,
  email text,
  display_name text,
  digest_enabled boolean,
  is_contributor boolean,
  is_data_reader boolean,
  is_admin boolean,
  created_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select
    profile.user_id,
    auth_user.email::text,
    profile.display_name,
    profile.digest_enabled,
    contributor.user_id is not null,
    data_reader.user_id is not null,
    admin_user.user_id is not null,
    profile.created_at
  from public.reader_profiles as profile
  join auth.users as auth_user on auth_user.id = profile.user_id
  left join public.publication_contributors as contributor on contributor.user_id = profile.user_id
  left join public.data_export_readers as data_reader on data_reader.user_id = profile.user_id
  left join public.admin_users as admin_user on admin_user.user_id = profile.user_id
  where exists (
    select 1 from public.admin_users
    where admin_users.user_id = auth.uid()
  )
  order by profile.created_at desc;
$$;

create or replace function public.admin_set_data_export_access(
  target_user_id uuid,
  access_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_name text;
begin
  if not exists (
    select 1 from public.admin_users
    where admin_users.user_id = auth.uid()
  ) then
    raise exception 'Administrator access is required.';
  end if;

  if exists (
    select 1 from public.admin_users
    where admin_users.user_id = target_user_id
  ) then
    raise exception 'Administrator accounts already have full access.';
  end if;

  if access_enabled then
    select display_name into account_name
    from public.reader_profiles
    where user_id = target_user_id;

    if account_name is null then
      raise exception 'No Gazette account exists for that user.';
    end if;

    insert into public.data_export_readers (user_id, display_name)
    values (target_user_id, account_name)
    on conflict (user_id) do update
      set display_name = excluded.display_name;
  else
    delete from public.data_export_readers
    where user_id = target_user_id;
  end if;
end;
$$;

revoke all on function public.admin_site_accounts() from public;
revoke all on function public.admin_set_data_export_access(uuid, boolean) from public;
grant execute on function public.admin_site_accounts() to authenticated;
grant execute on function public.admin_set_data_export_access(uuid, boolean) to authenticated;
