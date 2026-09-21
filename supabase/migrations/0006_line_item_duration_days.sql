-- Round 6: lump-sum items are always quantity=1, which can't convey how
-- long the work actually takes -- Grading might be 20 days on one job and
-- 100 on another, at the same lump-sum pay item. duration_days scales
-- every labor/equipment hour on the line (in calc-engine.ts) so the
-- library recipe can be entered as "hours per day" once, and each project
-- only needs a day count. Null/unset behaves as 1 (no change).
alter table project_line_items
  add column duration_days numeric(10,2);
