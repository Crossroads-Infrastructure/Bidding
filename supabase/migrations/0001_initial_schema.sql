-- Heavy Highway Estimating App: initial schema
-- Rate fluidity: crew_rates / equipment_rates / materials are versioned by
-- (name, effective_date). Editing a rate inserts a new row and flips the old
-- row's is_current to false -- it never overwrites history. Recipes
-- (bid_item_labor/equipment/materials) reference a specific rate row's id,
-- but the calc engine resolves the *current* rate for that name at calc
-- time, so recipes automatically pick up rate updates. bid_history stores a
-- rates_snapshot so a bid, once submitted, is frozen regardless of later
-- rate changes.

create extension if not exists pgcrypto;

-- ============================================================
-- Rate tables
-- ============================================================

create table crew_rates (
  id uuid primary key default gen_random_uuid(),
  role_name text not null,
  hourly_rate numeric(10,2) not null check (hourly_rate >= 0),
  fringe numeric(10,2) not null default 0 check (fringe >= 0),
  effective_date date not null default current_date,
  is_current boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index crew_rates_current_uidx
  on crew_rates (role_name)
  where is_current;

create index crew_rates_role_name_idx on crew_rates (role_name);

create table equipment_rates (
  id uuid primary key default gen_random_uuid(),
  equipment_name text not null,
  hourly_rate numeric(10,2) not null check (hourly_rate >= 0),
  effective_date date not null default current_date,
  is_current boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index equipment_rates_current_uidx
  on equipment_rates (equipment_name)
  where is_current;

create index equipment_rates_name_idx on equipment_rates (equipment_name);

create table materials (
  id uuid primary key default gen_random_uuid(),
  material_name text not null,
  unit text not null,
  rate numeric(12,4) not null check (rate >= 0),
  vendor text,
  effective_date date not null default current_date,
  is_current boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index materials_current_uidx
  on materials (material_name)
  where is_current;

create index materials_name_idx on materials (material_name);

-- ============================================================
-- Bid item catalog (recipes)
-- ============================================================

create table bid_items (
  id uuid primary key default gen_random_uuid(),
  item_name text not null,
  description text,
  unit text not null check (unit in ('SF','LF','EA','SY','LS','CY','TON','GAL')),
  item_type text not null check (item_type in ('unit_price','lump_sum','sub_quote')),
  default_overhead_pct numeric(6,4),
  default_profit_pct numeric(6,4),
  default_contingency_pct numeric(6,4),
  notes text,
  created_date timestamptz not null default now(),
  last_used_date timestamptz
);

create index bid_items_item_name_idx on bid_items (item_name);

create table bid_item_labor (
  id uuid primary key default gen_random_uuid(),
  bid_item_id uuid not null references bid_items (id) on delete cascade,
  crew_role_id uuid not null references crew_rates (id),
  hours_per_unit numeric(10,4) not null check (hours_per_unit >= 0),
  headcount integer not null default 1 check (headcount >= 1)
);

create index bid_item_labor_bid_item_idx on bid_item_labor (bid_item_id);
create index bid_item_labor_crew_role_idx on bid_item_labor (crew_role_id);

create table bid_item_equipment (
  id uuid primary key default gen_random_uuid(),
  bid_item_id uuid not null references bid_items (id) on delete cascade,
  equipment_id uuid not null references equipment_rates (id),
  hours_per_unit numeric(10,4) not null check (hours_per_unit >= 0)
);

create index bid_item_equipment_bid_item_idx on bid_item_equipment (bid_item_id);
create index bid_item_equipment_equipment_idx on bid_item_equipment (equipment_id);

create table bid_item_materials (
  id uuid primary key default gen_random_uuid(),
  bid_item_id uuid not null references bid_items (id) on delete cascade,
  material_id uuid not null references materials (id),
  calc_method text not null check (calc_method in ('fixed_ratio','dimensional','liquid_application')),
  qty_per_unit numeric(12,6),
  thickness_in numeric(8,3),
  width_in numeric(8,3),
  depth_in numeric(8,3),
  output_unit text check (output_unit in ('CY','TON','EA','GAL')),
  density_factor numeric(10,3),
  application_rate numeric(10,4),
  waste_pct numeric(6,4) not null default 0 check (waste_pct >= 0),
  constraint bid_item_materials_fixed_ratio_ck
    check (calc_method <> 'fixed_ratio' or qty_per_unit is not null),
  constraint bid_item_materials_liquid_ck
    check (calc_method <> 'liquid_application' or application_rate is not null)
);

create index bid_item_materials_bid_item_idx on bid_item_materials (bid_item_id);
create index bid_item_materials_material_idx on bid_item_materials (material_id);

-- ============================================================
-- Projects and estimates
-- ============================================================

create table projects (
  id uuid primary key default gen_random_uuid(),
  project_name text not null,
  client text,
  location text,
  dot_or_municipality text,
  bid_date date,
  status text not null default 'estimating' check (status in ('estimating','submitted','won','lost')),
  default_overhead_pct numeric(6,4) not null default 0,
  default_profit_pct numeric(6,4) not null default 0,
  default_contingency_pct numeric(6,4) not null default 0,
  created_at timestamptz not null default now()
);

create index projects_status_idx on projects (status);

create table project_line_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  bid_item_id uuid not null references bid_items (id),
  quantity numeric(14,4) not null check (quantity >= 0),
  override_overhead_pct numeric(6,4),
  override_profit_pct numeric(6,4),
  override_contingency_pct numeric(6,4),
  manual_rounded_rate numeric(14,4),
  vendor_name text,
  vendor_quote_amount numeric(14,2),
  markup_pct numeric(6,4),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index project_line_items_project_idx on project_line_items (project_id);
create index project_line_items_bid_item_idx on project_line_items (bid_item_id);

create table project_line_item_material_overrides (
  id uuid primary key default gen_random_uuid(),
  project_line_item_id uuid not null references project_line_items (id) on delete cascade,
  material_id uuid not null references materials (id),
  override_rate numeric(12,4),
  override_qty numeric(14,4)
);

create index pli_material_overrides_pli_idx on project_line_item_material_overrides (project_line_item_id);
create unique index pli_material_overrides_uidx
  on project_line_item_material_overrides (project_line_item_id, material_id);

-- ============================================================
-- Bid history / outcome tracking
-- ============================================================

create table bid_history (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  bid_item_id uuid not null references bid_items (id),
  unit_price_bid numeric(14,4) not null,
  unit_price_awarded numeric(14,4),
  outcome text check (outcome in ('won','lost')),
  date date not null default current_date,
  rates_snapshot jsonb not null
);

create index bid_history_project_idx on bid_history (project_id);
create index bid_history_bid_item_idx on bid_history (bid_item_id);
