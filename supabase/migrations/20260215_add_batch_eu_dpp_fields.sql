-- EU Digital Product Passport (DPP) / ESPR 2026 fields for batches
-- Material composition: JSONB array of { material: text, percentage: number }
ALTER TABLE batches ADD COLUMN IF NOT EXISTS material_composition jsonb DEFAULT '[]'::jsonb;

-- Circularity & care
ALTER TABLE batches ADD COLUMN IF NOT EXISTS maintenance_instructions text;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS end_of_life_instructions text;

-- Traceability: facility/workshop where final assembly happened
ALTER TABLE batches ADD COLUMN IF NOT EXISTS facility_info text;
