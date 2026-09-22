-- Round 7: company profile (quote header info) + a reusable bank of
-- inclusion/exclusion snippets, plus the per-project copies that actually
-- render on the Quote screen. Same "populate as a shortcut, no persistent
-- link" pattern as crew/equipment groups: picking a bank item copies its
-- text into a project_inclusions row that's then freely editable per job.

create table company_profile (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  address_line1 text,
  city_state_zip text,
  contact_name text,
  contact_phone text,
  contact_email text,
  certification_tagline text,
  quote_validity_days integer not null default 30,
  updated_at timestamptz not null default now()
);

create table inclusion_exclusion_items (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('scope_of_work','gc_responsibility')),
  text text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table project_inclusions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  category text not null check (category in ('scope_of_work','gc_responsibility')),
  text text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index project_inclusions_project_idx on project_inclusions (project_id);

-- Seeded with the real values from the City of High Point quote you sent --
-- edit any of it from the new Company Profile card on the Rate Library
-- screen if anything needs to change.
insert into company_profile
  (company_name, address_line1, city_state_zip, contact_name, contact_phone, contact_email, certification_tagline, quote_validity_days)
values
  ('Crossroads Infrastructure Inc.', 'P.O. Box 1128', 'Summerfield, NC 27358', 'Essa Rizkallah', '(443) 622-4310', 'essa@crossroadsinfrastructure.com', 'CERTIFIED NCDOT DBE-WBE', 30);

-- Starter bank, pulled from the same quote's boilerplate -- a starting
-- point, not gospel; add/remove from the new Inclusions/Exclusions tab.
insert into inclusion_exclusion_items (category, text, sort_order) values
  ('scope_of_work', 'Mobilization, Material, Equipment, Traffic Control & Insurance included in bid proposal.', 0),
  ('scope_of_work', 'Bond NOT included in bid prices above. If Bond Required add 2.5%', 1),
  ('scope_of_work', 'All work to be completed in accordance with 2024 NCDOT Standard Specifications', 2),
  ('scope_of_work', 'Concrete for Curb to be NCDOT Class A Concrete with a broom finish.', 3),
  ('scope_of_work', 'Asphalt for ramping and/or lowering adjustment to be provided by others.', 4),
  ('gc_responsibility', 'Crossroads Infrastructure requires 14 day notice before mobilization to project.', 0),
  ('gc_responsibility', 'GC shall provide asphalt for lowering of any structures at no cost to Crossroads Infrastructure', 1),
  ('gc_responsibility', 'GC shall provide traffic control on any street where speed limit exceeds 45 MPH', 2),
  ('gc_responsibility', 'Unit Prices are for entire bid, Bid not divisible.', 3);
