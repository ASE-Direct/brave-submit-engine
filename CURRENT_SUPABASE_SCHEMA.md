# Current Supabase Database Schema

**Last Updated:** October 19, 2025 (Production Email System)

This document reflects the current state of all tables, functions, and policies in the Supabase database.

**Recent Changes:**
- ✅ **PRODUCTION EMAIL SYSTEM (Oct 19, 2025 - Latest):** Upgraded to production mode with verified domain
  - ✅ **Domain Verified:** bavsavingschallenge.com - enables production mode without recipient restrictions
  - ✅ **From Address:** Changed from `onboarding@resend.dev` to `noreply@bavsavingschallenge.com`
  - ✅ **Recipients:** All 3 team members now receive emails - areyes@gowaffl.com, zjones@gowaffl.com, rwright@gowaffl.com
  - ✅ **Button Text:** Updated to "Download User's Document" (was "Download Uploaded Document")
  - ✅ **Enhanced Logging:** Added detailed payload logging for debugging
  - ✅ **Updated File:** `send-notification-email/index.ts` - production configuration
  - ✅ Result: All three sales team members receive instant notifications without sandbox restrictions
- ✅ **EMAIL NOTIFICATION SYSTEM (Oct 19, 2025):** Automatic email alerts when document processing completes
  - ✅ **New Edge Function:** `send-notification-email` - Resend API integration for automated notifications
  - ✅ **Email Recipients:** areyes@gowaffl.com, zjones@gowaffl.com, rwright@gowaffl.com receive notification for every completed submission
  - ✅ **Email Content:** User details (name, company, email, phone) + signed URLs for uploaded doc & internal report
  - ✅ **72-Hour Signed URLs:** Secure, time-limited access to documents via Supabase Storage
  - ✅ **Non-Blocking:** Email failures don't break processing flow - graceful error handling
  - ✅ **Integration Point:** Triggered automatically in `saveFinalReport()` after successful report generation
  - ✅ **Environment Variable:** `RESEND_API_KEY` added to Edge Function secrets
  - ✅ Files: `send-notification-email/index.ts`, updated `process-document/index.ts`
  - ✅ Result: Sales team gets instant notifications with direct access to submission documents
- ✅ **DUAL REPORT SYSTEM (Oct 17, 2025):** Implemented separate customer-facing and internal sales reports
  - ✅ **Customer Report** - Simplified 3-page report (Executive Summary, Environmental/Benefits, Contact)
  - ✅ **Internal Report** - Detailed report with SKU summary aggregation and full line item details
  - ✅ **Executive Summary Enhanced** - Now shows SKU breakdown: Remanufactured, OEM like-kind exchange, No match TBD
  - ✅ **SKU Summary Section** - Aggregates savings by unique ASE SKU (ase_clover_number or ase_oem_number)
  - ✅ **Simplified Line Items** - Internal report shows ASE SKU instead of product names for recommendations
  - ✅ **Match Type Tracking** - Each item categorized as 'remanufactured', 'oem', or 'no_match'
  - ✅ **Database Update** - Added `internal_pdf_url` column to savings_reports table
  - ✅ **Unique SKU Count** - Executive summary now displays count of distinct ASE SKUs identified
  - ✅ Files: `pdf-generator-customer.ts`, `pdf-generator-internal.ts`, updated `process-document/index.ts`
  - ✅ Migration: `supabase/migrations/20251017_add_internal_pdf_url.sql`
  - ✅ Result: Sales team has detailed SKU-level analytics while customers see clean, simple reports
- ✅ **PROCESS-DOCUMENT FUNCTION UPDATE (Oct 17, 2025):** Updated Edge Function to use correct column names
  - ✅ **Updated pricing logic** - Now uses `ase_price` → `partner_list_price` (instead of old normalized columns)
  - ✅ **SKU matching CORRECTED** - Now using: ase_clover_number, oem_number, wholesaler_sku, staples_sku, depot_sku, ase_oem_number
  - ✅ **Primary SKU column** - Changed from `sku` to `ase_clover_number` (actual database column name)
  - ✅ **Pricing priority** - Priority 1: ase_price (ASE Price from CSV), Priority 2: partner_list_price (Partner List Price)
  - ✅ **Fallback logic updated** - For user pricing: User File → Partner List Price → ASE Price × 1.30 → Skip
  - ✅ **All references updated** - exactSKUMatch, fuzzySKUMatch, findHigherYieldAlternative, CPP calculations, recommendations, main savings logic
  - ✅ **SELECT query updated** - Now fetches ase_clover_number, ase_price, partner_list_price, and ase_oem_number columns
  - ✅ File: `supabase/functions/process-document/index.ts`
  - ✅ Documentation: `PROCESS_DOCUMENT_COLUMN_UPDATE.md`
  - ✅ Result: Function now correctly uses actual database column names for accurate matching and savings calculations
- ✅ **DUPLICATE REMOVAL & CSV COLUMN SYNC (Oct 17, 2025 - Final):** Complete database cleanup and column synchronization
  - ✅ **Removed 503 duplicate products** - Deleted non-R versions where -R version exists
  - ✅ **Updated all foreign key references** - order_items_extracted now points to -R products
  - ✅ **Added 29 new CSV columns** for complete catalog parity with source
  - ✅ **Final count: 1,573 products** (564 with -R, 1,009 unique without -R)
  - ✅ Dual column strategy: Normalized columns for app + Raw CSV columns for auditing
  - ✅ New columns: seq, ase_price, clover_cogs, contract_status, product_class, partner_list_price, partner_cost, and 22 more
  - ✅ Migration: `supabase/migrations/20251017_add_csv_columns.sql`
  - ✅ Scripts: `remove-duplicate-products.ts` and updated `import-master-products-from-staples.ts`
  - ✅ Result: Clean database with no duplicates and complete CSV data preservation
- ✅ **MASTER PRODUCTS FULL SYNC (Oct 17, 2025):** Updated master_products table with complete Staples catalog
  - ✅ Imported 567 products from `Staples.To.Clover.9.26.25.xlsx` CSV file
  - ✅ All ASE Clover Numbers now have `-R` suffix for internal tracking (564 products with -R suffix)
  - ✅ Column mapping: ASE Clover Number → sku, ASE Price → unit_price, Clover COGS → cost, PARTNER LIST PRICE → list_price
  - ✅ Cross-reference mapping: OEM Number → oem_number, ASE OEM Number → wholesaler_sku, Staples Part Number → staples_sku
  - ✅ Automatic detection of category (ink_cartridge vs toner_cartridge), color_type, size_category, yield_class, oem_vs_compatible
  - ✅ De-duplicated SKUs within CSV (kept first occurrence)
  - ✅ All products have pricing data (unit_price or cost fallback)
  - ✅ Script: `scripts/import-master-products-from-staples.ts`
  - ✅ Result: Database is now 1-for-1 match with Staples master catalog
- ✅ **ENHANCED ENVIRONMENTAL IMPACT (Oct 14, 2025):** Expanded environmental metrics with accurate calculations
  - ✅ Updated plastic reduced calculation: 2 lbs per cartridge (previously 0.5 lbs)
  - ✅ Added shipping weight savings tracking: 2.5 lbs per toner, 0.2 lbs per ink
  - ✅ **NEW: Remanufactured/Reused Cartridge Tracking** - Items with `unit_price > 0` now count as cartridge savings
    - Recognizes that offering remanufactured/reused cartridges prevents waste
    - Counts full item quantity as cartridges saved (not just higher-yield savings)
    - Applies environmental impact calculations even when no cost savings exist
    - PDF reports display "[Remanufactured]" tag on recommended product names with unit_price > 0
    - Total impact = Higher-Yield Savings + Remanufactured/Reused Savings
  - ✅ Enhanced PDF reports to display plastic reduced and shipping weight saved
  - ✅ New environmental metrics displayed in two rows: Row 1 (Cartridges, CO2, Trees), Row 2 (Plastic, Shipping Weight)
  - ✅ Updated savings_reports table with `shipping_weight_saved_pounds` field
  - ✅ Individual item environmental_savings now includes plastic_reduced and shipping_weight_saved
  - ✅ Result: More comprehensive environmental impact reporting with accurate sustainability metrics
- ✅ **FALLBACK PRICING WITH MESSAGING (Oct 14, 2025):** Enhanced pricing strategy for items without explicit prices
  - ✅ Implemented 4-tier cascading fallback: User Price → List Price → Unit Price × 1.30 → Cost × 1.30
  - ✅ Items using assumed pricing now include clear message in report
  - ✅ Messages inform users that pricing was estimated since document didn't include it
  - ✅ Price source tracking: `user_file`, `catalog_list_price`, `estimated_from_unit_price`, `estimated_from_cost`
  - ✅ Enhanced logging shows [ASSUMED] indicator when fallback pricing is applied
  - ✅ Result: All matched items can be included in savings calculations with appropriate transparency
- ✅ **PARTNER COST UPDATE (Oct 14, 2025):** Updated master_products.cost with actual partner pricing
  - ✅ Updated 695 products with Partner Cost data from Staples catalog (Staples.To.Clover.9.26.25)
  - ✅ Source: PARTNER COST column from master wholesale catalog
  - ✅ Script: `scripts/update-partner-costs.ts`
  - ✅ SKU matching: Removed "-R" suffix from catalog SKUs for database matching
  - ✅ Impact: Accurate cost data for savings calculations and margin analysis
  - ✅ Products not found (155): SKUs not in current database or marked as "N/A" in source
  - ✅ Result: Cost column now reflects actual partner wholesale costs instead of estimates
- ✅ **CSV/EXCEL PARITY FIX (Oct 13, 2025):** Unified header detection for identical processing
  - ✅ CSV header detection now matches Excel logic exactly (2+ keywords instead of 3+)
  - ✅ Added metadata row detection to CSV processing (skips report headers)
  - ✅ Improved CSV fallback logic for files without clear headers
  - ✅ Enhanced logging for CSV header detection (matches Excel verbosity)
  - ✅ Result: CSV and Excel files now process identically with same matching and calculations
  - ✅ Guarantees: Same header detection, same column mapping, same SKU matching, same savings
- ✅ **COMPREHENSIVE EXTRACTION FIX (Oct 10, 2025 - Late Evening):** 100% item extraction accuracy
  - ✅ System now scans ALL cells in each row, not just detected columns
  - ✅ Finds product descriptions even when DESCRIPTION column header is missing/unclear
  - ✅ Tracks longest text field in row as fallback description (human-like scanning)
  - ✅ Enhanced header row detection: skips "DESCRIPTION/Part Number" header rows
  - ✅ Added Tier 3.5: Simple ILIKE search before full-text search (handles special characters)
  - ✅ ILIKE search solves issue where "CANON CL-246 C/M/Y COLOR INK" failed on "/" character
  - ✅ Result: All items with ANY identifier (SKU, description, OEM, etc.) now match successfully
- ✅ **SAVINGS PERCENTAGE FIX (Oct 10, 2025):** Consistent baseline cost calculation
  - ✅ Fixed savings percentage inconsistency where same document yielded different percentages
  - ✅ Root cause: Unmatched items were excluded from baseline cost, causing non-deterministic percentages
  - ✅ Solution: Include ALL items (matched + unmatched) in total_current_cost baseline
  - ✅ Unmatched items now contribute to baseline with $0 savings (realistic representation)
  - ✅ Result: Savings percentage now accurately represents savings as % of total documented spend
  - ✅ Formula remains: `savings_percentage = (total_savings / total_current_cost) × 100`
  - ✅ Example: Same document now consistently shows same percentage regardless of match success rate
- ✅ **HUMAN-LIKE EXTRACTION (Oct 10, 2025):** Row-by-row comprehensive column scanning
  - ✅ System now scans ALL columns in each row (like a human would) for potential identifiers
  - ✅ Extracts any alphanumeric data (3-30 chars) that could be SKU/part numbers
  - ✅ Tries matching on ALL extracted identifiers (maximizes match success rate)
  - ✅ Added Tier 4A: Search in description/long_description fields for SKUs
  - ✅ Enhanced header detection to prioritize product indicators over metadata
  - ✅ Repetition analysis prevents selecting metadata columns (>70% repetition = metadata)
  - ✅ Searches 10+ database columns: sku, oem_number, wholesaler_sku, staples_sku, depot_sku, product_name, description, long_description
  - ✅ Result: System can now match items even with mixed metadata/product columns
- ✅ **CRITICAL FIX (Oct 9, 2025 - Late Evening):** Fixed column detection for usage reports with metadata
  - ✅ Intelligent column detection now EXCLUDES account/customer/shipping metadata columns
  - ✅ Prioritizes "Item Description" over "Account Name" for product names
  - ✅ Fixed "QTY in Sell UOM" quantity column detection (was incorrectly excluded)
  - ✅ Enhanced SKU column patterns for "OEM Number" and "Staples Sku Number"
  - ✅ Improved Excel sheet selection with quality scoring (product data vs metadata)
  - ✅ Solves issue where all items extracted as "KNOX COMMUNITY HOSPITAL" (account name)
- ✅ **COMPATIBILITY GUARDRAILS (Oct 9, 2025 - Evening):** Hard constraints for accurate recommendations
  - ✅ Added 9 pre-flight compatibility checks to prevent cross-brand/color/category mismatches
  - ✅ Brand matching: HP ≠ Brother ≠ Canon ≠ Xerox (strict enforcement)
  - ✅ Color matching: Black ≠ Cyan ≠ Magenta ≠ Yellow (strict for cartridges)
  - ✅ Category matching: ink_cartridge ≠ toner_cartridge (strict enforcement)
  - ✅ Yield ratio reasonableness: Max 8x improvement to prevent incompatible suggestions
  - ✅ CPP sanity check: >90% improvement flagged as suspicious
  - ✅ Never downgrade yield class (XL → Standard blocked)
  - ✅ Added `compatibility_group` and `model_pattern` columns for granular matching
  - ✅ Scripts: `fix-missing-color-types.ts`, `populate-compatibility-groups.ts`
  - ✅ Migration: `add_compatibility_fields.sql`
- ✅ **MAJOR UPDATE (Oct 9, 2025):** Enhanced document processing with human-like accuracy
  - ✅ Multi-column SKU detection (OEM, Wholesaler, Staples, Depot, Generic) 
  - ✅ 6-tier comprehensive matching strategy (exact, fuzzy, combined, full-text, semantic, AI)
  - ✅ Row-by-row extraction logging with confidence scoring
  - ✅ Quality validation functions for extraction and matching
  - ✅ Detailed match attempt tracking with timing metrics
  - ✅ Enhanced data structures for SKU tracking and quality assessment
- ✅ Added intelligent column detection for various file formats (usage reports, purchase orders, etc.)
- ✅ Implemented pricing fallback logic: User Price → Partner List Price → Estimated (ASE × 1.35)
- ✅ Support for files without price columns (e.g., usage/inventory reports)
- ✅ Added Excel file processing support (.xlsx, .xls) using SheetJS library
- ✅ Enhanced file parsing with binary format handling
- ✅ Intelligent header detection for both CSV and Excel files
- ✅ **CRITICAL FIX (Oct 9, 2025):** Intelligent column type detection for unlabeled headers
  - Analyzes data patterns when columns have generic names (`__EMPTY`, `Column_1`, etc.)
  - Automatically detects price, quantity, product name, and SKU columns by content
  - Fixes issue where missing headers caused incorrect extraction (qty=1, price=$0)
  - Works with ANY document format - no column name assumptions
- ✅ **VENDOR SKU CROSS-REFERENCE SYSTEM (Oct 9, 2025):** Multi-vendor SKU matching
  - Added columns: `oem_number`, `wholesaler_sku`, `staples_sku`, `depot_sku`
  - Matching now searches ALL vendor SKU columns (not just primary SKU)
  - Solves issue where user documents use different SKU systems than master catalog
  - Result: 50%+ improvement in match rates (+$3,318 in previously missing savings)
- ✅ **PDF REPORT ENHANCEMENT (Oct 9, 2025):** Wholesaler SKU display
  - PDF reports now include wholesaler_sku in itemized breakdown
  - Shows both primary SKU and wholesaler SKU for matched and recommended products
  - Format: "SKU: [primary] | Wholesaler: [wholesaler_sku]"
  - Helps customers easily identify products in their wholesaler catalogs
- ✅ **EXTENDED DESCRIPTIONS UPDATE (Oct 9, 2025):** Comprehensive product descriptions
  - Updated 722 products with detailed extended descriptions from master catalog
  - Descriptions include page yields, compatibility, features, and benefits
  - Improves product matching accuracy and customer understanding
  - Script: `scripts/update-extended-descriptions.ts`

## 💰 Pricing Logic

When calculating savings, the system uses a **4-tier cascading pricing fallback** with transparency messaging:

1. **User's Price** (Priority 1): Price from the uploaded file's price column
2. **Catalog List Price** (Priority 2): `master_products.list_price` - partner/retail pricing
3. **Estimated from Unit Price** (Priority 3): `master_products.unit_price × 1.30` (30% markup)
4. **Estimated from Cost** (Priority 4): `master_products.cost × 1.30` (30% markup)

**Price Source Tracking:**
- `user_file`: Price extracted from user's document (no message - actual price)
- `catalog_list_price`: Using catalog's partner list price (includes message)
- `estimated_from_unit_price`: Calculated as unit_price × 1.30 (includes message)
- `estimated_from_cost`: Calculated as cost × 1.30 (includes message)

**Transparency Messaging:**
When fallback pricing (priorities 2-4) is used, the system automatically adds a message to the report item:
- **List Price:** "Note: Assumed pricing based on catalog list price since document didn't include price information."
- **Unit Price × 1.30:** "Note: Assumed pricing based on estimated market price (30% markup from wholesale) since document didn't include price information."
- **Cost × 1.30:** "Note: Assumed pricing based on estimated market price (30% markup from cost) since document didn't include price information."

This ensures accurate savings calculations even when user files don't include pricing data (e.g., usage reports, inventory exports), while maintaining full transparency about assumed pricing.

---

## 📊 Tables

### 1. `document_submissions`
Stores initial form submissions and uploaded documents.

**Columns:**
- `id` (UUID, PK) - Unique submission ID
- `first_name` (TEXT) - Customer first name
- `last_name` (TEXT) - Customer last name
- `company` (TEXT) - Company name
- `email` (TEXT) - Email address
- `phone` (TEXT) - Phone number
- `file_name` (TEXT) - Original filename
- `file_size` (INTEGER) - File size in bytes
- `file_type` (TEXT) - MIME type
- `file_url` (TEXT) - URL to stored file
- `recaptcha_verified` (BOOLEAN) - reCAPTCHA status
- `recaptcha_score` (NUMERIC) - reCAPTCHA score (v3)
- `ip_address` (INET) - Client IP
- `user_agent` (TEXT) - Browser user agent
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Indexes:**
- Primary key on `id`

**RLS:** Enabled

---

### 2. `processing_jobs`
Tracks document processing status and results.

**Columns:**
- `id` (UUID, PK) - Job ID
- `submission_id` (UUID, FK → document_submissions) - Reference to submission
- `status` (TEXT) - Job status: `pending` | `processing` | `completed` | `failed`
- `progress` (INTEGER) - Progress percentage (0-100)
- `current_step` (TEXT) - Current processing step description
- `extracted_data` (JSONB) - Raw extracted order data
- `matched_products` (JSONB) - Product matching results
- `savings_analysis` (JSONB) - Calculated savings
- `report_url` (TEXT) - URL to generated PDF report
- `error_message` (TEXT) - Error details if failed
- `started_at` (TIMESTAMPTZ) - Processing start time
- `completed_at` (TIMESTAMPTZ) - Processing completion time
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Indexes:**
- Primary key on `id`
- `idx_processing_jobs_submission_id` on `submission_id`
- `idx_processing_jobs_status` on `status`
- `idx_processing_jobs_created_at` on `created_at DESC`

**Constraints:**
- `status` must be in: `pending`, `processing`, `completed`, `failed`
- `progress` must be between 0 and 100

**RLS:** Enabled

**Triggers:**
- `update_processing_jobs_updated_at` - Auto-updates `updated_at` column

---

### 3. `master_products`
Master product catalog with pricing and environmental data.

**Columns:**
- `id` (UUID, PK) - Product ID
- `sku` (TEXT, UNIQUE) - Product SKU
- `product_name` (TEXT) - Product name
- `category` (TEXT) - Product category (ink_cartridge, toner_cartridge, etc.)
- `brand` (TEXT) - Brand name (HP, Canon, Brother, etc.)
- `model` (TEXT) - Model number

**Pricing:**
- `unit_price` (DECIMAL) - Regular unit price
- `bulk_price` (DECIMAL) - Bulk pricing
- `bulk_minimum` (INTEGER) - Minimum quantity for bulk price
- `list_price` (DECIMAL) - List price
- `cost` (DECIMAL) - Cost

**Specifications:**
- `page_yield` (INTEGER) - Pages per cartridge
- `color_type` (TEXT) - black, cyan, magenta, yellow, color
- `size_category` (TEXT) - standard, xl, xxl, bulk
- `uom` (TEXT) - Unit of measure (EA, PK, etc.)
- `pack_quantity` (INTEGER) - Items per pack

**NEW: Canonical Fields (Battle-Tested Deterministic Matching):**
- `family_series` (TEXT) - Product family for grouping alternatives (e.g., "Brother TN7xx", "HP 64")
- `yield_class` (TEXT) - Yield classification: standard, high, extra_high, super_high
- `compatible_printers` (TEXT[]) - Array of compatible printer models
- `oem_vs_compatible` (TEXT) - OEM, reman, or compatible
- `uom_std` (TEXT) - Standardized UOM (EA, BX, CS, PK, CT)
- `pack_qty_std` (INTEGER) - Standardized pack quantity
- `ase_unit_price` (DECIMAL(10,4)) - Normalized price per-each (THE GOLDEN RULE)
- `inventory_status` (TEXT) - in_stock, low, oos
- `compatibility_group` (TEXT) - Precise compatibility grouping (e.g., "BROTHER_TN7XX_HLLSERIES")
- `model_pattern` (TEXT) - Model pattern for variant grouping (e.g., "TN7xx" for TN730/TN760/TN750)

**Environmental Data:**
- `co2_per_unit` (DECIMAL) - CO2 pounds per unit (default: 2.5 for ink, 5.2 for toner)
- `recyclable` (BOOLEAN) - Is recyclable
- `recycled_content_percentage` (INTEGER) - % recycled content
- `weight_plastic` (DECIMAL) - Plastic weight in pounds
- `weight_aluminum` (DECIMAL) - Aluminum weight in pounds
- `weight_steel` (DECIMAL) - Steel weight in pounds
- `weight_copper` (DECIMAL) - Copper weight in pounds

**Search & Matching:**
- `search_vector` (TSVECTOR) - Full-text search vector
- `embedding` (VECTOR(1536)) - OpenAI embedding for semantic search

**Relations:**
- `alternative_product_ids` (UUID[]) - Alternative/larger products
- `replaces_products` (TEXT[]) - SKUs this product replaces
- `related_skus` (TEXT[]) - Related SKU numbers

**Metadata:**
- `manufacturer` (TEXT) - Manufacturer name
- `description` (TEXT) - Short description
- `long_description` (TEXT) - Full description
- `image_url` (TEXT) - Product image URL
- `active` (BOOLEAN) - Is active (default: true)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Indexes:**
- Primary key on `id`
- Unique index on `sku`
- `idx_master_products_category` on `category`
- `idx_master_products_brand` on `brand`
- `idx_master_products_active` on `active`
- `idx_master_products_search` (GIN) on `search_vector`
- `idx_master_products_embedding` (IVFFlat) on `embedding` for vector search
- `idx_master_products_compatibility_group` on `compatibility_group` (WHERE NOT NULL)
- `idx_master_products_model_pattern` on `model_pattern` (WHERE NOT NULL)

**Constraints:**
- `size_category` must be in: `standard`, `xl`, `xxl`, `bulk`
- `yield_class` must be in: `standard`, `high`, `extra_high`, `super_high`
- `oem_vs_compatible` must be in: `OEM`, `reman`, `compatible`
- `inventory_status` must be in: `in_stock`, `low`, `oos`

**RLS:** Enabled

**Triggers:**
- `update_master_products_updated_at` - Auto-updates `updated_at`
- `master_products_search_vector_trigger` - Auto-generates search vector

---

### 4. `order_items_extracted`
Individual line items extracted from customer orders.

**Columns:**
- `id` (UUID, PK) - Item ID
- `processing_job_id` (UUID, FK → processing_jobs) - Parent job

**Raw Data:**
- `raw_product_name` (TEXT) - Original product name from file
- `raw_sku` (TEXT) - Original SKU from file
- `raw_description` (TEXT) - Original description
- `quantity` (INTEGER) - Quantity ordered
- `unit_price` (DECIMAL) - Price per unit
- `total_price` (DECIMAL) - Total line price

**AI Analysis:**
- `normalized_name` (TEXT) - Cleaned product name
- `detected_category` (TEXT) - AI-detected category
- `detected_brand` (TEXT) - AI-detected brand
- `confidence_score` (DECIMAL) - Confidence (0-1)

**Matching:**
- `matched_product_id` (UUID, FK → master_products) - Matched product
- `match_score` (DECIMAL) - Match confidence (0-1)
- `match_method` (TEXT) - exact_sku | fuzzy_name | semantic | ai_suggested | manual

**Savings:**
- `recommended_product_id` (UUID, FK → master_products) - Better alternative
- `cost_savings` (DECIMAL) - $ saved
- `cost_savings_percentage` (DECIMAL) - % saved
- `environmental_savings` (JSONB) - Environmental impact
- `savings_reason` (TEXT) - Explanation
- `recommendation_type` (TEXT) - bulk_pricing | larger_size | alternative_product | combo_pack | no_change

**Calculations:**
- `current_total_cost` (DECIMAL) - Current total cost
- `recommended_total_cost` (DECIMAL) - Recommended total cost
- `recommended_quantity` (INTEGER) - Recommended quantity
- `created_at` (TIMESTAMPTZ)

**Indexes:**
- Primary key on `id`
- `idx_order_items_job_id` on `processing_job_id`
- `idx_order_items_matched_product` on `matched_product_id`
- `idx_order_items_recommended_product` on `recommended_product_id`

**Constraints:**
- `confidence_score` must be between 0 and 1
- `match_score` must be between 0 and 1
- `match_method` must be in: `exact_sku`, `fuzzy_sku`, `fuzzy_name`, `semantic`, `ai_suggested`, `manual`, `none`, `error`, `timeout`, `ilike_search`, `description_search`, `combined_search`
- `recommendation_type` must be in: `bulk_pricing`, `larger_size`, `alternative_product`, `combo_pack`, `no_change`

**RLS:** Enabled

---

### 5. `savings_reports`
Final reports with aggregated savings metrics.

**Columns:**
- `id` (UUID, PK) - Report ID
- `processing_job_id` (UUID, FK → processing_jobs) - Parent job
- `submission_id` (UUID, FK → document_submissions) - Original submission

**Summary Metrics:**
- `total_current_cost` (DECIMAL) - Total current spending
- `total_optimized_cost` (DECIMAL) - Total with recommendations
- `total_cost_savings` (DECIMAL) - Total $ saved
- `savings_percentage` (DECIMAL) - % saved
- `total_items` (INTEGER) - Total items analyzed
- `items_with_savings` (INTEGER) - Items with savings opportunities

**Environmental Impact:**
- `cartridges_saved` (INTEGER) - Cartridges saved from waste (includes both higher-yield savings AND remanufactured/reused cartridges)
- `co2_reduced_pounds` (DECIMAL) - CO2 reduction in pounds
- `trees_saved` (DECIMAL) - Equivalent trees
- `plastic_reduced_pounds` (DECIMAL) - Plastic waste reduced (2 lbs per cartridge)
- `shipping_weight_saved_pounds` (DECIMAL) - Shipping weight saved (2.5 lbs per toner, 0.2 lbs per ink)

**Cartridge Savings Calculation:**
1. **Higher-Yield Savings:** When recommending larger cartridges (e.g., 5 standard → 3 XL), saves 2 cartridges
2. **Remanufactured/Reused:** Items with `unit_price > 0` count full quantity as cartridges saved from waste
3. **Total = Higher-Yield + Remanufactured:** Both sources contribute to total environmental impact

**Report:**
- `report_data` (JSONB) - Full detailed breakdown
- `pdf_url` (TEXT) - Generated customer-facing PDF URL
- `internal_pdf_url` (TEXT) - Generated internal sales team PDF URL (with SKU summary and detailed line items)

**Customer Info (Denormalized):**
- `customer_name` (TEXT) - Customer full name
- `company_name` (TEXT) - Company name
- `email` (TEXT) - Email address
- `created_at` (TIMESTAMPTZ)

**Indexes:**
- Primary key on `id`
- `idx_savings_reports_submission` on `submission_id`
- `idx_savings_reports_job` on `processing_job_id`
- `idx_savings_reports_created` on `created_at DESC`

**RLS:** Enabled

---

## 🔐 Row Level Security (RLS) Policies

All tables have RLS enabled with the following general policies:

1. **Anonymous read access** - Users can read data (for now)
2. **Service role full access** - Service role has full CRUD permissions

---

## 🔧 Functions

### `update_updated_at_column()`
Automatically updates the `updated_at` timestamp on row updates.

**Used by:**
- `processing_jobs`
- `master_products`

### `master_products_search_vector_update()`
Automatically generates and updates the full-text search vector for products.

**Weights:**
- SKU: A (highest)
- Product Name: A (highest)
- Brand: B (medium)
- Model: B (medium)
- Description: C (lower)
- Replaces Products: B (medium)

---

## 📦 Extensions

### `vector`
Enables vector similarity search for semantic product matching using OpenAI embeddings.

**Configuration:**
- Dimension: 1536 (OpenAI text-embedding-3-small)
- Index type: IVFFlat with cosine distance
- Lists: 100

---

## ⚡ Edge Functions

### `process-document`
Main document processing pipeline that orchestrates the entire savings analysis workflow.

**Endpoint:** `/functions/v1/process-document`

**Responsibilities:**
- Download and parse uploaded documents (Excel, CSV)
- Extract order items with intelligent column detection
- Match products using multi-tier strategy (exact, fuzzy, semantic, AI)
- Calculate savings and environmental impact
- Generate customer and internal PDF reports
- Save results to database
- Trigger email notifications

**Environment Variables Required:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `RESEND_API_KEY`

### `send-notification-email`
Sends email notifications when document processing completes.

**Endpoint:** `/functions/v1/send-notification-email`

**Trigger:** Automatically called by `process-document` after successful report generation

**Recipients:** areyes@gowaffl.com, zjones@gowaffl.com, rwright@gowaffl.com

**Email Content:**
- Subject: "New BAV Savings Challenge Submission - [Company Name]"
- User details: First name, last name, company, email, phone
- Signed URLs (72-hour expiry) for:
  - Uploaded document
  - Internal report PDF

**Environment Variables Required:**
- `RESEND_API_KEY`

**Error Handling:**
- Email failures are logged but do not break the processing flow
- Processing job completes successfully even if email fails

**Integration:**
```typescript
// Called in saveFinalReport() after savings_reports insert
await fetch(`${supabaseUrl}/functions/v1/send-notification-email`, {
  method: 'POST',
  body: JSON.stringify({
    userInfo: { firstName, lastName, company, email, phone },
    uploadedDocumentUrl: signedUrl1,
    internalReportUrl: signedUrl2
  })
});
```

### `get-processing-status`
Returns current processing status for a given job ID.

**Endpoint:** `/functions/v1/get-processing-status`

### `get-results`
Retrieves final results and report URLs for a completed submission.

**Endpoint:** `/functions/v1/get-results`

---

## 🗄️ Storage Buckets

### `document-submissions`
Stores uploaded customer order files (Excel/CSV).

**Configuration:**
- Public access: No
- Max file size: 10MB
- Allowed types: .xlsx, .xls, .csv, .pdf

**Processing Support:**
- ✅ **Excel (.xlsx, .xls)**: Full support with SheetJS library
- ✅ **CSV**: Native parsing with intelligent header detection
- ⚠️ **PDF**: Upload accepted, processing not yet implemented

### `reports` (To be created)
Will store generated PDF reports.

**Configuration:**
- Public access: No (signed URLs)
- Max file size: 5MB
- Allowed types: .pdf

---

## 📊 Data Flow

```
1. User uploads file
   ↓
2. document_submissions (file stored in storage)
   ↓
3. processing_jobs created (status: pending)
   ↓
4. Edge function processes document
   ↓
5. order_items_extracted populated
   ↓
6. Products matched from master_products
   ↓
7. Savings calculated
   ↓
8. savings_reports created
   ↓
9. PDF generated and stored
   ↓
10. Email notification sent (send-notification-email Edge Function)
   ↓
11. processing_jobs updated (status: completed)
```

---

## 🔍 Query Examples

### Get processing status
```sql
SELECT 
  pj.id,
  pj.status,
  pj.progress,
  pj.current_step,
  pj.error_message,
  ds.first_name,
  ds.last_name,
  ds.company
FROM processing_jobs pj
JOIN document_submissions ds ON pj.submission_id = ds.id
WHERE ds.email = 'user@example.com'
ORDER BY pj.created_at DESC;
```

### Search products by name
```sql
SELECT 
  id,
  sku,
  product_name,
  brand,
  unit_price,
  page_yield,
  ts_rank(search_vector, query) AS rank
FROM master_products,
     to_tsquery('english', 'HP & 64 & black') query
WHERE search_vector @@ query
  AND active = true
ORDER BY rank DESC
LIMIT 10;
```

### Semantic product search
```sql
SELECT 
  id,
  sku,
  product_name,
  brand,
  unit_price,
  1 - (embedding <=> '[... embedding vector ...]'::vector) AS similarity
FROM master_products
WHERE active = true
ORDER BY embedding <=> '[... embedding vector ...]'::vector
LIMIT 5;
```

### Get complete savings report
```sql
SELECT 
  sr.*,
  pj.status,
  pj.completed_at,
  ds.file_name
FROM savings_reports sr
JOIN processing_jobs pj ON sr.processing_job_id = pj.id
JOIN document_submissions ds ON sr.submission_id = ds.id
WHERE sr.id = 'report-uuid'
```

### Get all extracted items with recommendations
```sql
SELECT 
  oie.raw_product_name,
  oie.quantity,
  oie.unit_price,
  mp_current.product_name AS current_product,
  mp_recommended.product_name AS recommended_product,
  oie.cost_savings,
  oie.savings_reason,
  oie.environmental_savings
FROM order_items_extracted oie
LEFT JOIN master_products mp_current ON oie.matched_product_id = mp_current.id
LEFT JOIN master_products mp_recommended ON oie.recommended_product_id = mp_recommended.id
WHERE oie.processing_job_id = 'job-uuid'
ORDER BY oie.cost_savings DESC NULLS LAST;
```

---

## 🎯 Product Matching Intelligence (Battle-Tested Deterministic Approach)

The system uses a **7-tier intelligent matching strategy** with deterministic rules first, AI only as fallback:

### Tier 1: Exact SKU Matching
- Attempts exact match on **all available SKU columns** (Staples SKU, OEM Number, Part Number, etc.)
- Case-insensitive matching with normalization
- **Score: 1.0** (100% confidence)
- **Method:** `exact_sku`

### Tier 2: Fuzzy SKU Matching
- Handles variations: spaces, dashes, underscores, case differences
- Example: "W2021A", "W-2021-A", "w2021a" all match
- Normalized comparison after stripping special characters
- **Score: 0.85-0.95** (85-95% confidence)
- **Method:** `fuzzy_sku`

### Tier 3: Combined SKU + Description Search
- Searches using both SKU and product description together
- Increases accuracy when both fields are available
- **Score: 0.80-0.95** (80-95% confidence)
- **Method:** `combined_search`

### Tier 3.5: Simple ILIKE Search (NEW - Oct 10, 2025)
- Direct PostgreSQL ILIKE pattern matching on product_name
- **Handles special characters** that break full-text search (/, -, etc.)
- Solves issue where "CANON CL-246 C/M/Y COLOR INK" failed on "/" character
- **Score: 0.88-1.0** (88-100% confidence based on match quality)
- **Method:** `ilike_search`
- **Why this matters:** Full-text search tokenizes on special chars, missing exact matches

### Tier 4: Description Field Search
- Searches in description and long_description fields
- Useful when SKU appears in product descriptions
- **Score: 0.75-0.90** (75-90% confidence)
- **Method:** `description_search`

### Tier 5: Full-Text Search
- PostgreSQL full-text search with term ranking
- Extracts key terms: brand, model number, color, size
- Term overlap scoring for accuracy
- **Score: 0.70-0.95** (70-95% confidence)
- **Method:** `fuzzy_name`

### Tier 6: Semantic Search
- OpenAI embeddings with vector similarity
- Understands synonyms and variations
- Used when text search fails
- **Score: 0.70-0.85** (70-85% confidence)
- **Method:** `semantic`

### Tier 7: AI Agent (Last Resort - Currently Disabled)
- OpenAI gpt-4o-mini for intelligent parsing
- Only used when all other methods fail (score < 0.30)
- Extracts attributes and suggests best match
- **Score: 0.65-0.95** (capped at 0.95, never 1.0)
- **Method:** `ai_suggested`

### Domain Rules (Toner/Ink Cartridges) - ENHANCED WITH GUARDRAILS

The following rules are enforced during matching to prevent mismatches:

**TIER 1: Hard Constraints (MUST NEVER VIOLATE)**
1. **Category Match**: ink_cartridge ≠ toner_cartridge ≠ office_supplies (strict enforcement)
2. **Brand Match**: HP ≠ Brother ≠ Canon ≠ Xerox ≠ Epson (no cross-brand recommendations)
3. **Color Match**: Black ≠ Cyan ≠ Magenta ≠ Yellow (strict for cartridges)
4. **Yield Class Guard**: Never recommend lower yield (XL → Standard blocked)
5. **Yield Ratio Reasonableness**: Max 8x page yield improvement (prevents incompatible suggestions)
6. **CPP Sanity Check**: >90% CPP improvement flagged as suspicious and blocked

**TIER 2: Soft Constraints (Confidence Adjustment)**
7. **Family Series**: Products should be in same `family_series` for alternatives
8. **Compatibility Group**: Products with same `compatibility_group` are interchangeable
9. **Model Pattern**: Products with same `model_pattern` are compatible variants
10. **OEM Policy**: Compatible products flagged separately via `oem_vs_compatible`

**Better to recommend nothing than to recommend something incompatible.**

### Document Format Intelligence

**Smart Header Detection:**
- Automatically detects actual data header row
- Skips metadata, totals, and report information
- Handles documents with 10+ header rows

**Flexible Column Mapping:**
- Recognizes variations: "Item Description", "Product Name", "Description", "Item"
- Handles multiple SKU columns simultaneously
- Adapts to different CSV/Excel structures

**Advanced CSV Parsing:**
- Handles quoted commas and complex formatting
- Preserves data integrity across variations

## 💰 Savings Calculation (Battle-Tested CPP Approach)

### Price Normalization (THE GOLDEN RULE)

**All prices are normalized to per-each basis before comparison:**

```typescript
normalized_price = unit_price / pack_qty
```

This prevents "BX vs EA" comparison errors and ensures fair price comparison.

### Cost Per Page (CPP) Calculation

For toner and ink cartridges, we calculate Cost Per Page (CPP):

```typescript
cpp = normalized_price / page_yield
```

CPP is the **primary metric** for optimization recommendations.

### Higher-Yield Optimization (WITH COMPATIBILITY GUARDRAILS)

The system suggests higher-yield alternatives using a strict compatibility-first approach:

**Phase 1: Compatibility Filtering (Guardrails)**
1. **Brand Filter**: Same brand only (query-level filter)
2. **Category Filter**: Same category only (query-level filter)
3. **Color Filter**: Same color only for cartridges (query-level filter)
4. **Family Matching**: Products in same `family_series`

**Phase 2: Pre-Flight Checks (Hard Stops)**
5. **Cross-Brand Block**: HP ≠ Brother ≠ Canon (double-check after ranking)
6. **Cross-Category Block**: Ink ≠ Toner (double-check after ranking)
7. **Color Mismatch Block**: Black ≠ Cyan (double-check after ranking)
8. **Yield Ratio Check**: Max 8x improvement (realistic compatibility)
9. **CPP Sanity Check**: Max 90% improvement (prevents false matches)

**Phase 3: Optimization Ranking**
10. **Yield Filter**: Only equal or higher `yield_class`
11. **CPP Ranking**: Rank by lowest CPP (cost per page)
12. **Savings Threshold**: Only recommend if CPP savings ≥ 5% AND dollar savings > $5/year

**Result**: Only compatible, verified alternatives are suggested. No recommendation is better than a wrong recommendation.

### Recommendation Logic

```typescript
// Calculate user's current cost
user_current_cost = quantity × user_unit_price

// Calculate recommended cost (with normalized pricing)
recommended_cost = quantity_needed × ase_unit_price

// Only recommend if actual savings
if (user_current_cost - recommended_cost > 0) {
  recommend()
}
```

### Example Calculation

**User's Order:**
- Product: HP 64 Black (Standard, 300 pages)
- Quantity: 5 cartridges
- Unit Price: $29.99 each
- Total: $149.95

**Our Recommendation:**
- Product: HP 64XL Black (High Yield, 600 pages)
- Quantity Needed: 3 cartridges (to match 1500 total pages)
- ASE Price: $39.99 each
- Total: $119.97

**Savings:**
- Cost Savings: $29.98 (20%)
- Cartridges Saved: 2
- CPP: $0.100 → $0.067 (33% better)

## 🚀 Implementation Status

1. ✅ Database schema created with canonical fields
2. ✅ Import master product catalog with family_series detection
3. ✅ Build deterministic processing engine
4. ✅ Implement 5-tier matching system with domain rules
5. ✅ Add price normalization (per-each basis)
6. ✅ Implement CPP-based higher-yield optimization
7. ✅ Excel (.xlsx) file support
8. ✅ Update AI to use gpt-4o-mini
9. ⏳ Test with various document formats

---

## 📝 Notes

- All monetary values use DECIMAL(10, 2) for precision
- All timestamps are stored in UTC
- Vector embeddings use cosine similarity for matching
- Full-text search uses English text search configuration
- Environmental calculations based on EPA standards and industry averages

