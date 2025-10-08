# Current Supabase Database Schema

**Last Updated:** October 8, 2025

This document reflects the current state of all tables, functions, and policies in the Supabase database.

**Recent Changes:**
- ✅ Added Excel file processing support (.xlsx, .xls) using SheetJS library
- ✅ Enhanced file parsing with binary format handling
- ✅ Intelligent header detection for both CSV and Excel files

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

**Constraints:**
- `size_category` must be in: `standard`, `xl`, `xxl`, `bulk`

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
- `match_method` must be valid enum value
- `recommendation_type` must be valid enum value

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
- `cartridges_saved` (INTEGER) - Fewer cartridges needed
- `co2_reduced_pounds` (DECIMAL) - CO2 reduction in pounds
- `trees_saved` (DECIMAL) - Equivalent trees
- `plastic_reduced_pounds` (DECIMAL) - Plastic waste reduced

**Report:**
- `report_data` (JSONB) - Full detailed breakdown
- `pdf_url` (TEXT) - Generated PDF URL

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
10. processing_jobs updated (status: completed)
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

## 🎯 Product Matching Intelligence

The system uses a **4-tier intelligent matching strategy** to achieve high accuracy across various document formats:

### Tier 1: Multi-SKU Exact Matching
- Attempts exact match on **all available SKU columns** (Staples SKU, OEM Number, Part Number, etc.)
- Case-insensitive matching with normalization
- **Score: 1.0** (100% confidence)

### Tier 2: Fuzzy SKU Matching
- Handles variations: spaces, dashes, underscores, case differences
- Example: "W2021A", "W-2021-A", "w2021a" all match
- **Score: 0.85-0.95** (85-95% confidence)

### Tier 3: Full-Text Search
- PostgreSQL full-text search with term ranking
- Extracts key terms: brand, model number, color, size
- Term overlap scoring for accuracy
- **Score: 0.70-0.95** (70-95% confidence)

### Tier 4: Semantic Search
- OpenAI embeddings with vector similarity
- Understands synonyms and variations
- Most expensive, used as last resort
- **Score: 0.70-0.85** (70-85% confidence)

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

## 🚀 Next Steps

1. ✅ Database schema created
2. ✅ Import master product catalog
3. ✅ Build intelligent processing engine
4. ✅ Implement multi-tier matching system
5. ⏳ Add Excel (.xlsx) file support
6. ⏳ Test with various document formats

---

## 📝 Notes

- All monetary values use DECIMAL(10, 2) for precision
- All timestamps are stored in UTC
- Vector embeddings use cosine similarity for matching
- Full-text search uses English text search configuration
- Environmental calculations based on EPA standards and industry averages

