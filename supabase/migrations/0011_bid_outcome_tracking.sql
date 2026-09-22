-- Records a frozen final bid total on the project when its status is set
-- to won/lost, alongside the per-line bid_history rows already supported
-- by the schema (see 0001_initial_schema.sql) but never actually written
-- to until now.

alter table projects add column final_bid_total numeric(14,4);
