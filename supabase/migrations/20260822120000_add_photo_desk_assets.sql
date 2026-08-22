create table if not exists public.gazette_photos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  caption text,
  image_alt text not null,
  image_url text not null unique,
  storage_path text not null unique,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gazette_photos_updated_at_idx
  on public.gazette_photos (updated_at desc);

alter table public.gazette_photos enable row level security;

grant select, insert, update, delete on public.gazette_photos to authenticated;

create policy "Admins can manage Photo Desk assets"
  on public.gazette_photos for all to authenticated
  using (public.is_gazette_admin())
  with check (public.is_gazette_admin());

drop trigger if exists set_gazette_photos_updated_at on public.gazette_photos;
create trigger set_gazette_photos_updated_at
  before update on public.gazette_photos
  for each row execute function public.set_updated_at();

create policy "Admins can upload Photo Desk assets"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'gazette-images'
    and name like 'photos/%'
    and public.is_gazette_admin()
  );

create policy "Admins can delete Photo Desk assets"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'gazette-images'
    and name like 'photos/%'
    and public.is_gazette_admin()
  );
