-- Add is_active column to batches table
ALTER TABLE batches ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true NOT NULL;

-- Update existing batches to be active
UPDATE batches SET is_active = true WHERE is_active IS NULL;
