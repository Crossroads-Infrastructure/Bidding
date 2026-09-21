-- Widen bid_items.unit to cover the standard DOT pay-item units that show
-- up on real bid proposal sheets beyond the original 8 (acres, per-day,
-- per-pound, and man-hour line items -- e.g. clearing & grubbing, flagger,
-- seed, specialized hand mowing).
alter table bid_items
  drop constraint bid_items_unit_check;

alter table bid_items
  add constraint bid_items_unit_check
  check (unit in ('SF','LF','EA','SY','LS','CY','TON','GAL','ACR','DAY','LB','MHR'));
