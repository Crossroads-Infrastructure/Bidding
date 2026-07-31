-- Round 3 additions: archive/restore/permanent-delete for library entities.
--
-- is_active gates visibility only (search, dropdowns, "add new" pickers). It
-- never affects calculation: recipes, project line items, and bid_history
-- keep resolving against archived rows exactly as before. For crew_rates/
-- equipment_rates/materials (which already carry fluid rate history), only
-- the current row's is_active matters for filtering; permanent delete acts
-- on the whole name (all historical rows), gated by the reference guardrail
-- enforced at the application layer.

alter table bid_items
  add column is_active boolean not null default true;

alter table crew_rates
  add column is_active boolean not null default true;

alter table equipment_rates
  add column is_active boolean not null default true;

alter table materials
  add column is_active boolean not null default true;
