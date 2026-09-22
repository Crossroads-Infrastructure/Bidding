-- Storage has its own access-control layer, separate from the "without
-- RLS" we ran on the regular database tables -- creating the
-- project-documents bucket alone doesn't let the app's publishable key
-- actually read/write files in it. This creates the bucket if it
-- doesn't already exist, and grants the same open access the rest of
-- the app uses (no per-user auth system, matches the DB tables).
insert into storage.buckets (id, name, public)
values ('project-documents', 'project-documents', true)
on conflict (id) do nothing;

create policy "project-documents public read"
  on storage.objects for select
  using (bucket_id = 'project-documents');

create policy "project-documents public insert"
  on storage.objects for insert
  with check (bucket_id = 'project-documents');

create policy "project-documents public update"
  on storage.objects for update
  using (bucket_id = 'project-documents');

create policy "project-documents public delete"
  on storage.objects for delete
  using (bucket_id = 'project-documents');
