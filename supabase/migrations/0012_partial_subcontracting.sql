-- Lets a single project line item split its quantity between self-performed
-- (priced through the recipe) and subcontracted (priced through a vendor
-- quote) work, instead of a line being all-or-nothing -- DOT bids often
-- want one item number/unit price even when part of the work is subbed
-- out. Null (with is_subcontracted true) keeps meaning "fully
-- subcontracted", the original behavior.

alter table project_line_items add column subcontracted_quantity numeric(14,4);
