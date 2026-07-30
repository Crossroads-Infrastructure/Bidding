-- Round 2 additions: company-level markup, per-line labor/equipment overrides,
-- subcontracting split, custom line items, crew/equipment groups, documents.

-- ============================================================
-- Company-level overhead & contingency (replaces per-project defaults)
-- ============================================================
-- Same fluid-history pattern as crew_rates/equipment_rates/materials: there
-- is only ever one "current" row company-wide (no name key to partition on).

create table company_defaults (
  id uuid primary key default gen_random_uuid(),
  overhead_pct numeric(6,4) not null check (overhead_pct >= 0),
  contingency_pct numeric(6,4) not null check (contingency_pct >= 0),
  effective_date date not null default current_date,
  is_current boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index company_defaults_current_uidx
  on company_defaults ((true))
  where is_current;

alter table projects
  drop column default_overhead_pct,
  drop column default_contingency_pct;
-- projects.default_profit_pct is kept: it now means "last used profit %",
-- a starting point offered on the Review screen rather than an
-- auto-applied project setting.

-- ============================================================
-- Bid item catalog: one-off custom items
-- ============================================================

alter table bid_items
  add column is_saved_to_library boolean not null default true;
-- Items created inline mid-estimate default this to false at the app layer;
-- they behave identically otherwise and only appear in Bid Item Library
-- search once explicitly saved (flag flipped to true).

-- ============================================================
-- Project line items: per-project customization + subcontracting
-- ============================================================

alter table project_line_items
  add column notes_override text,
  add column item_number_override text,
  add column item_name_override text,
  add column is_subcontracted boolean not null default false,
  add column sub_markup_pct numeric(6,4),
  drop column vendor_name,
  drop column vendor_quote_amount,
  drop column markup_pct;
-- The old single vendor_name/vendor_quote_amount/markup_pct fields are
-- superseded by project_line_item_vendor_quotes (multiple quotes per line,
-- one selected) + sub_markup_pct. is_subcontracted is available on any
-- item regardless of its library item_type; the app defaults it to true
-- when adding an item whose item_type is 'sub_quote'.

create table project_line_item_vendor_quotes (
  id uuid primary key default gen_random_uuid(),
  project_line_item_id uuid not null references project_line_items (id) on delete cascade,
  vendor_name text not null,
  quote_amount numeric(14,2) not null,
  is_selected boolean not null default false,
  notes text
);

create index pli_vendor_quotes_pli_idx on project_line_item_vendor_quotes (project_line_item_id);
create unique index pli_vendor_quotes_selected_uidx
  on project_line_item_vendor_quotes (project_line_item_id)
  where is_selected;

-- ============================================================
-- Per-line labor/equipment overrides (mirrors material override pattern)
-- ============================================================

create table project_line_item_labor_overrides (
  id uuid primary key default gen_random_uuid(),
  project_line_item_id uuid not null references project_line_items (id) on delete cascade,
  crew_role_id uuid not null references crew_rates (id),
  override_hours numeric(10,4),
  override_headcount integer
);

create index pli_labor_overrides_pli_idx on project_line_item_labor_overrides (project_line_item_id);
create unique index pli_labor_overrides_uidx
  on project_line_item_labor_overrides (project_line_item_id, crew_role_id);

create table project_line_item_equipment_overrides (
  id uuid primary key default gen_random_uuid(),
  project_line_item_id uuid not null references project_line_items (id) on delete cascade,
  equipment_id uuid not null references equipment_rates (id),
  override_hours numeric(10,4)
);

create index pli_equipment_overrides_pli_idx on project_line_item_equipment_overrides (project_line_item_id);
create unique index pli_equipment_overrides_uidx
  on project_line_item_equipment_overrides (project_line_item_id, equipment_id);

-- ============================================================
-- Documents
-- ============================================================

create table project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  category text not null check (category in ('Plans', 'Proposal', 'Addenda', 'Other')),
  file_name text not null,
  file_url text not null,
  file_size bigint not null,
  uploaded_date timestamptz not null default now()
);

create index project_documents_project_idx on project_documents (project_id);

-- ============================================================
-- Crew groups & equipment groups (recipe-building shortcuts)
-- ============================================================

create table crew_groups (
  id uuid primary key default gen_random_uuid(),
  group_name text not null,
  description text
);

create table crew_group_members (
  id uuid primary key default gen_random_uuid(),
  crew_group_id uuid not null references crew_groups (id) on delete cascade,
  crew_role_id uuid not null references crew_rates (id),
  default_headcount integer not null default 1 check (default_headcount >= 1)
);

create index crew_group_members_group_idx on crew_group_members (crew_group_id);

create table equipment_groups (
  id uuid primary key default gen_random_uuid(),
  group_name text not null,
  description text
);

create table equipment_group_members (
  id uuid primary key default gen_random_uuid(),
  equipment_group_id uuid not null references equipment_groups (id) on delete cascade,
  equipment_id uuid not null references equipment_rates (id)
);

create index equipment_group_members_group_idx on equipment_group_members (equipment_group_id);
