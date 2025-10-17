-- Add columns from Staples CSV to master_products table
-- Migration: Add missing CSV columns for complete catalog parity

-- Add columns that directly map to CSV columns
ALTER TABLE master_products
ADD COLUMN IF NOT EXISTS seq INTEGER,
ADD COLUMN IF NOT EXISTS ase_oem_number TEXT,
ADD COLUMN IF NOT EXISTS clover_yield INTEGER,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS clover_cogs NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS ase_price NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS contract_status TEXT,
ADD COLUMN IF NOT EXISTS laser_rank TEXT,
ADD COLUMN IF NOT EXISTS color_laser_rank TEXT,
ADD COLUMN IF NOT EXISTS mfr_part_number TEXT,
ADD COLUMN IF NOT EXISTS part_number_from_description TEXT,
ADD COLUMN IF NOT EXISTS ability_one_flag TEXT,
ADD COLUMN IF NOT EXISTS mfr_name TEXT,
ADD COLUMN IF NOT EXISTS final_upc_code TEXT,
ADD COLUMN IF NOT EXISTS unspc TEXT,
ADD COLUMN IF NOT EXISTS product_class TEXT,
ADD COLUMN IF NOT EXISTS product_department TEXT,
ADD COLUMN IF NOT EXISTS product_subdept TEXT,
ADD COLUMN IF NOT EXISTS coo_name TEXT,
ADD COLUMN IF NOT EXISTS coo TEXT,
ADD COLUMN IF NOT EXISTS post_consumer_rec_content TEXT,
ADD COLUMN IF NOT EXISTS total_recycled_percent TEXT,
ADD COLUMN IF NOT EXISTS recycled_content_flag TEXT,
ADD COLUMN IF NOT EXISTS nsn_item TEXT,
ADD COLUMN IF NOT EXISTS nsn_item_13digit TEXT,
ADD COLUMN IF NOT EXISTS dropship_flag TEXT,
ADD COLUMN IF NOT EXISTS partner_list_price NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS partner_cost NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS action TEXT;

-- Add comments to explain the columns
COMMENT ON COLUMN master_products.seq IS 'Sequence number from CSV';
COMMENT ON COLUMN master_products.ase_oem_number IS 'ASE OEM Number (wholesaler_sku)';
COMMENT ON COLUMN master_products.clover_yield IS 'Clover Yield (page_yield)';
COMMENT ON COLUMN master_products.notes IS 'Notes from CSV';
COMMENT ON COLUMN master_products.clover_cogs IS 'Clover COGS (cost)';
COMMENT ON COLUMN master_products.ase_price IS 'ASE Price (unit_price)';
COMMENT ON COLUMN master_products.contract_status IS 'Contract Status (Open Market Item, On HPG Contract, etc.)';
COMMENT ON COLUMN master_products.laser_rank IS 'Laser Rank';
COMMENT ON COLUMN master_products.color_laser_rank IS 'Color Laser Rank';
COMMENT ON COLUMN master_products.mfr_part_number IS 'Manufacturer Part Number';
COMMENT ON COLUMN master_products.part_number_from_description IS 'Part # From Description';
COMMENT ON COLUMN master_products.ability_one_flag IS 'Ability One Flag (Y/N)';
COMMENT ON COLUMN master_products.mfr_name IS 'Manufacturer Name (brand)';
COMMENT ON COLUMN master_products.final_upc_code IS 'Final UPC CODE';
COMMENT ON COLUMN master_products.unspc IS 'UNSPC code';
COMMENT ON COLUMN master_products.product_class IS 'Product Class (Ink, Toner)';
COMMENT ON COLUMN master_products.product_department IS 'Product Department';
COMMENT ON COLUMN master_products.product_subdept IS 'Product Sub-Department';
COMMENT ON COLUMN master_products.coo_name IS 'Country of Origin Name';
COMMENT ON COLUMN master_products.coo IS 'Country of Origin Code';
COMMENT ON COLUMN master_products.post_consumer_rec_content IS 'Post Consumer Recycled Content';
COMMENT ON COLUMN master_products.total_recycled_percent IS 'Total Recycled Percentage';
COMMENT ON COLUMN master_products.recycled_content_flag IS 'Recycled Content Flag (Y/N)';
COMMENT ON COLUMN master_products.nsn_item IS 'NSN Item';
COMMENT ON COLUMN master_products.nsn_item_13digit IS 'NSN Item 13-digit';
COMMENT ON COLUMN master_products.dropship_flag IS 'Dropship Flag (Y/N)';
COMMENT ON COLUMN master_products.partner_list_price IS 'Partner List Price';
COMMENT ON COLUMN master_products.partner_cost IS 'Partner Cost';
COMMENT ON COLUMN master_products.action IS 'Action from CSV (Change/No Change)';

-- Create indexes on commonly searched columns
CREATE INDEX IF NOT EXISTS idx_master_products_ase_oem_number ON master_products(ase_oem_number) WHERE ase_oem_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_master_products_mfr_part_number ON master_products(mfr_part_number) WHERE mfr_part_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_master_products_final_upc_code ON master_products(final_upc_code) WHERE final_upc_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_master_products_product_class ON master_products(product_class) WHERE product_class IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_master_products_contract_status ON master_products(contract_status) WHERE contract_status IS NOT NULL;

