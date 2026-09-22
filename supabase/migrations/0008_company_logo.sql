-- Logo image for the Quote header. Stored in the existing
-- project-documents Storage bucket under company/logo-* (no new bucket
-- needed) -- this column just holds its public URL.
alter table company_profile
  add column logo_url text;
