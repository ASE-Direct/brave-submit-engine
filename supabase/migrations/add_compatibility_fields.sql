-- Migration: Add compatibility fields for better product matching
-- Created: 2025-10-09
-- Purpose: Add compatibility_group and model_pattern columns to improve higher-yield recommendations

-- Add new columns to master_products table
ALTER TABLE master_products
ADD COLUMN IF NOT EXISTS compatibility_group TEXT,
ADD COLUMN IF NOT EXISTS model_pattern TEXT;

-- Add comments for documentation
COMMENT ON COLUMN master_products.compatibility_group IS 
  'Compatibility grouping for products that work with the same printers (e.g., "BROTHER_TN7XX_HLLSERIES")';

COMMENT ON COLUMN master_products.model_pattern IS 
  'Model number pattern for grouping compatible variants (e.g., "TN7xx" for TN730, TN760, TN750)';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_master_products_compatibility_group 
  ON master_products(compatibility_group) 
  WHERE compatibility_group IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_master_products_model_pattern 
  ON master_products(model_pattern) 
  WHERE model_pattern IS NOT NULL;

-- Update search vector to include new fields (optional but helpful)
-- Note: This updates the existing trigger function to include the new columns
CREATE OR REPLACE FUNCTION master_products_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.sku, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.product_name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.brand, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.model, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.replaces_products, ' '), '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.compatibility_group, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.model_pattern, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Example data updates for common Brother TN7xx series (compatible with same printers)
-- TN730, TN760, TN750 all work in: HL-L2350DW, HL-L2370DW, HL-L2390DW, MFC-L2710DW, etc.
UPDATE master_products
SET 
  compatibility_group = 'BROTHER_TN7XX_HLLSERIES',
  model_pattern = 'TN7xx'
WHERE sku IN ('TN730', 'TN760', 'TN750')
  AND brand = 'BROTHER';

-- Example: Brother TN6xx series
UPDATE master_products
SET 
  compatibility_group = 'BROTHER_TN6XX_HLDCP',
  model_pattern = 'TN6xx'
WHERE sku IN ('TN630', 'TN660')
  AND brand = 'BROTHER';

-- Example: Brother TN4xx series
UPDATE master_products
SET 
  compatibility_group = 'BROTHER_TN4XX_HLMFC',
  model_pattern = 'TN4xx'
WHERE sku IN ('TN420', 'TN450', 'TN460')
  AND brand = 'BROTHER';

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Migration completed: Added compatibility_group and model_pattern columns';
  RAISE NOTICE 'Updated Brother TN7xx, TN6xx, and TN4xx series with compatibility groups';
  RAISE NOTICE 'Next steps: Run data population scripts to fill remaining products';
END $$;

