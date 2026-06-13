-- Phase 3.5 — Buyer-trust project metadata.
--
-- The full project detail page needs due-diligence fields the projects table
-- doesn't carry yet. All optional; existing projects keep working.
--   methodology  — e.g. 'VM0007 REDD+', surfaced on the detail page.
--   vintage      — project-level vintage year (project_credits also has one).
--   co_benefits  — JSONB array of SDG / co-benefit tags, e.g. ["SDG 13", ...].
--   boundary     — GeoJSON Feature/Geometry for the project-boundary polygon
--                  (geo_coordinates remains the simple "lat,lng" centroid).

alter table public.projects
  add column if not exists methodology text;

alter table public.projects
  add column if not exists vintage integer;

alter table public.projects
  add column if not exists co_benefits jsonb default '[]'::jsonb;

alter table public.projects
  add column if not exists boundary jsonb;

notify pgrst, 'reload schema';
