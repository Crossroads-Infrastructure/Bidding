-- Round 5: archive/restore/permanent-delete for projects, same pattern as
-- the library entities (bid_items, crew_rates, equipment_rates, materials).
-- Unlike those, nothing else references a project, so permanent delete
-- needs no reference guardrail -- the existing "on delete cascade" on
-- project_line_items, bid_history, and project_documents cleans up
-- everything that belongs to it.
alter table projects
  add column is_active boolean not null default true;
