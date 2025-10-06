# Data Structures & Examples

This document provides detailed examples of the data structures used throughout the processing pipeline.

---

## 📄 Input: Customer Order File

### Example Excel/CSV Structure

```csv
Product Name,SKU,Quantity,Unit Price,Total
HP 64 Black Ink Cartridge,N9J90AN,5,$29.99,$149.95
HP 64 Tri-color Ink Cartridge,N9J89AN,5,$32.99,$164.95
Canon PG-245XL Black,8278B001,3,$35.99,$107.97
Epson 288 Cyan,T288220,10,$18.99,$189.90
Brother TN760 Toner,TN760,2,$89.99,$179.98
```

### Alternative Format (Flexible Parsing)
```csv
Item Description,Part Number,Qty,Price Each,Extended Price
HP Black Ink 64,N9J90AN,5,29.99,149.95
HP Color Ink 64,N9J89AN,5,32.99,164.95
```

---

## 🗄️ Master Product Catalog Structure

### Example Product Entry

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "sku": "N9J90AN-XL",
  "product_name": "HP 64XL High Yield Black Ink Cartridge",
  "category": "ink_cartridge",
  "brand": "HP",
  "model": "64XL",
  
  "unit_price": 39.99,
  "bulk_price": 35.99,
  "bulk_minimum": 5,
  
  "page_yield": 600,
  "color_type": "black",
  "size_category": "xl",
  
  "co2_per_unit": 2.5,
  "recyclable": true,
  "recycled_content_percentage": 45,
  
  "replaces_products": ["N9J90AN", "HP64", "HP 64"],
  "alternative_product_ids": ["xxl_version_uuid"],
  
  "active": true
}
```

### Categories

```typescript
type ProductCategory = 
  | "ink_cartridge"
  | "toner_cartridge"
  | "printer"
  | "paper"
  | "office_supplies"
  | "printer_parts";

type SizeCategory = 
  | "standard"
  | "xl"        // Extra Large (2x standard yield)
  | "xxl"       // Extra Extra Large (3x standard yield)
  | "bulk";     // Bulk pack

type ColorType = 
  | "black"
  | "cyan"
  | "magenta"
  | "yellow"
  | "color"     // Tri-color cartridge
  | "photo";    // Photo cartridges
```

---

## 🔄 Processing Pipeline Data Structures

### 1. Extracted Order Item

```typescript
interface ExtractedOrderItem {
  id: string;
  processing_job_id: string;
  
  // Raw data from customer file
  raw_product_name: string;
  raw_sku: string | null;
  raw_description: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  
  // AI-enhanced data
  normalized_name: string;
  detected_category: ProductCategory;
  confidence_score: number; // 0.0 to 1.0
  
  // Matching results
  matched_product_id: string | null;
  match_score: number;
  match_method: "exact" | "fuzzy" | "semantic" | "ai_suggested";
  
  // Savings opportunity
  recommended_product_id: string | null;
  cost_savings: number;
  environmental_savings: {
    co2_reduction: number;
    cartridges_saved: number;
  };
  savings_reason: string;
}
```

**Example:**
```json
{
  "id": "item-001",
  "processing_job_id": "job-123",
  
  "raw_product_name": "HP 64 Black Ink",
  "raw_sku": "N9J90AN",
  "quantity": 5,
  "unit_price": 29.99,
  "total_price": 149.95,
  
  "normalized_name": "HP 64 Black Ink Cartridge",
  "detected_category": "ink_cartridge",
  "confidence_score": 0.98,
  
  "matched_product_id": "product-standard-64",
  "match_score": 0.95,
  "match_method": "exact",
  
  "recommended_product_id": "product-xl-64",
  "cost_savings": 20.00,
  "environmental_savings": {
    "co2_reduction": 3.75,
    "cartridges_saved": 2
  },
  "savings_reason": "Switch to HP 64XL (2x page yield) - saves 2 cartridges and reduces plastic waste"
}
```

---

### 2. Processing Job Status

```typescript
interface ProcessingJob {
  id: string;
  submission_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number; // 0-100
  current_step: string;
  
  extracted_data: {
    total_items: number;
    items: ExtractedOrderItem[];
    parsing_method: "xlsx" | "csv" | "ai_ocr";
    raw_headers: string[];
  };
  
  matched_products: {
    total_matches: number;
    exact_matches: number;
    fuzzy_matches: number;
    ai_matches: number;
    unmatched: number;
  };
  
  savings_analysis: SavingsAnalysis;
  
  report_url: string | null;
  error_message: string | null;
  
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}
```

**Example:**
```json
{
  "id": "job-123",
  "submission_id": "sub-456",
  "status": "processing",
  "progress": 65,
  "current_step": "Calculating savings opportunities...",
  
  "extracted_data": {
    "total_items": 15,
    "parsing_method": "xlsx",
    "raw_headers": ["Product Name", "SKU", "Quantity", "Unit Price", "Total"]
  },
  
  "matched_products": {
    "total_matches": 15,
    "exact_matches": 10,
    "fuzzy_matches": 3,
    "ai_matches": 2,
    "unmatched": 0
  },
  
  "started_at": "2025-10-05T10:30:00Z",
  "updated_at": "2025-10-05T10:32:15Z"
}
```

---

### 3. Savings Analysis

```typescript
interface SavingsAnalysis {
  summary: {
    total_current_cost: number;
    total_optimized_cost: number;
    total_cost_savings: number;
    savings_percentage: number;
    
    total_items: number;
    items_with_savings: number;
    
    environmental: {
      cartridges_saved: number;
      co2_reduced_pounds: number;
      trees_saved: number;
      plastic_reduced_pounds: number;
    };
  };
  
  breakdown: SavingsBreakdownItem[];
  
  top_opportunities: {
    highest_cost_saving: SavingsBreakdownItem;
    highest_environmental_impact: SavingsBreakdownItem;
    largest_bulk_opportunity: SavingsBreakdownItem;
  };
}

interface SavingsBreakdownItem {
  current_product: {
    name: string;
    sku: string;
    quantity: number;
    unit_price: number;
    total_cost: number;
  };
  
  recommended_product: {
    name: string;
    sku: string;
    quantity_needed: number; // May be less if switching to larger size
    unit_price: number;
    total_cost: number;
    bulk_discount_applied: boolean;
  };
  
  savings: {
    cost_savings: number;
    cost_savings_percentage: number;
    cartridges_saved: number;
    co2_reduced: number;
  };
  
  reason: string;
  recommendation_type: "bulk_pricing" | "larger_size" | "alternative_product" | "combo_pack";
}
```

**Example:**
```json
{
  "summary": {
    "total_current_cost": 792.75,
    "total_optimized_cost": 562.75,
    "total_cost_savings": 230.00,
    "savings_percentage": 29.0,
    
    "total_items": 5,
    "items_with_savings": 4,
    
    "environmental": {
      "cartridges_saved": 8,
      "co2_reduced_pounds": 20.5,
      "trees_saved": 0.43,
      "plastic_reduced_pounds": 4.2
    }
  },
  
  "breakdown": [
    {
      "current_product": {
        "name": "HP 64 Black Ink Cartridge",
        "sku": "N9J90AN",
        "quantity": 5,
        "unit_price": 29.99,
        "total_cost": 149.95
      },
      
      "recommended_product": {
        "name": "HP 64XL Black Ink Cartridge (High Yield)",
        "sku": "N9J92AN",
        "quantity_needed": 3,
        "unit_price": 39.99,
        "total_cost": 119.97,
        "bulk_discount_applied": false
      },
      
      "savings": {
        "cost_savings": 29.98,
        "cost_savings_percentage": 20.0,
        "cartridges_saved": 2,
        "co2_reduced": 5.0
      },
      
      "reason": "HP 64XL has 2x the page yield (600 pages vs 300 pages). You'll use 2 fewer cartridges and save $29.98.",
      "recommendation_type": "larger_size"
    }
  ],
  
  "top_opportunities": {
    "highest_cost_saving": {
      "current_product": { "name": "Brother TN760 Toner", "total_cost": 179.98 },
      "savings": { "cost_savings": 60.00 }
    }
  }
}
```

---

### 4. Savings Report

```typescript
interface SavingsReport {
  id: string;
  processing_job_id: string;
  submission_id: string;
  
  customer_info: {
    first_name: string;
    last_name: string;
    company: string;
    email: string;
  };
  
  summary_metrics: {
    total_current_cost: number;
    total_optimized_cost: number;
    total_cost_savings: number;
    savings_percentage: number;
    cartridges_saved: number;
    co2_reduced_pounds: number;
    trees_saved: number;
  };
  
  report_data: SavingsAnalysis;
  pdf_url: string;
  
  created_at: string;
}
```

---

## 🤖 OpenAI Agent Interaction Examples

### Parser Agent Input/Output

**Input:**
```json
{
  "task": "parse_document",
  "file_data": "base64_encoded_excel_data",
  "context": {
    "expected_columns": ["product_name", "sku", "quantity", "price"],
    "flexible_matching": true
  }
}
```

**Output:**
```json
{
  "success": true,
  "items": [
    {
      "product_name": "HP 64 Black Ink Cartridge",
      "sku": "N9J90AN",
      "quantity": 5,
      "unit_price": 29.99,
      "total_price": 149.95,
      "confidence": 0.98
    }
  ],
  "metadata": {
    "total_items": 15,
    "parsing_method": "structured",
    "detected_format": "excel_standard"
  }
}
```

---

### Matching Agent Input/Output

**Input:**
```json
{
  "task": "match_product",
  "item": {
    "product_name": "HP 64 Black Ink",
    "sku": "N9J90AN",
    "quantity": 5
  },
  "catalog_context": {
    "similar_products": [
      { "sku": "N9J90AN", "name": "HP 64 Black Standard", "page_yield": 300 },
      { "sku": "N9J92AN", "name": "HP 64XL Black High Yield", "page_yield": 600 }
    ]
  }
}
```

**Output:**
```json
{
  "match": {
    "product_id": "prod-123",
    "sku": "N9J90AN",
    "name": "HP 64 Black Ink Cartridge",
    "confidence": 0.98,
    "match_type": "exact"
  },
  "alternatives": [
    {
      "product_id": "prod-124",
      "sku": "N9J92AN",
      "name": "HP 64XL Black High Yield",
      "reason": "2x page yield - better value",
      "estimated_savings": 29.98
    }
  ]
}
```

---

### Savings Agent Input/Output

**Input:**
```json
{
  "task": "analyze_savings",
  "current_order": {
    "product": "HP 64 Black Standard",
    "quantity": 5,
    "unit_price": 29.99,
    "page_yield": 300
  },
  "alternatives": [
    {
      "product": "HP 64XL Black High Yield",
      "unit_price": 39.99,
      "page_yield": 600,
      "bulk_price": 35.99,
      "bulk_minimum": 3
    }
  ]
}
```

**Output:**
```json
{
  "recommendation": {
    "switch_to": "HP 64XL Black High Yield",
    "quantity_needed": 3,
    "unit_price": 35.99,
    "bulk_discount_applied": true,
    "total_cost": 107.97,
    
    "savings": {
      "cost_savings": 41.98,
      "percentage": 28.0,
      "cartridges_saved": 2,
      "co2_reduced": 5.0
    },
    
    "explanation": "By switching to HP 64XL (2x page yield) and purchasing 3 units instead of 5 standard units, you'll get the same printing capacity while saving $41.98 and reducing waste by 2 cartridges. Bulk pricing of $35.99/unit (vs $39.99) provides additional savings.",
    
    "comparison": {
      "current_total_pages": 1500,
      "recommended_total_pages": 1800,
      "current_cost_per_page": 0.099,
      "recommended_cost_per_page": 0.060
    }
  }
}
```

---

## 📊 Master Catalog Import Format

### CSV Template

```csv
SKU,Product Name,Category,Brand,Model,Unit Price,Bulk Price,Bulk Min,Page Yield,Color Type,Size,CO2 Per Unit,Recyclable,Replaces
N9J90AN,HP 64 Black Ink Cartridge,ink_cartridge,HP,64,29.99,27.99,5,300,black,standard,2.5,true,"HP64,HP 64"
N9J92AN,HP 64XL Black Ink Cartridge,ink_cartridge,HP,64XL,39.99,35.99,3,600,black,xl,2.5,true,"N9J90AN,HP64XL"
N9J89AN,HP 64 Tri-color Ink,ink_cartridge,HP,64,32.99,29.99,5,300,color,standard,2.8,true,"HP64 Color"
TN760,Brother TN760 High Yield Toner,toner_cartridge,Brother,TN760,89.99,79.99,2,3000,black,standard,5.2,true,"TN730,TN-760"
```

### Import Script Structure

```typescript
async function importMasterCatalog(csvFile: File) {
  const products = parseCSV(csvFile);
  
  for (const product of products) {
    // Generate embedding for semantic search
    const embedding = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: `${product.brand} ${product.model} ${product.product_name}`
    });
    
    // Insert into database
    await supabase.from('master_products').insert({
      sku: product.sku,
      product_name: product.product_name,
      category: product.category,
      brand: product.brand,
      model: product.model,
      unit_price: product.unit_price,
      bulk_price: product.bulk_price,
      bulk_minimum: product.bulk_minimum,
      page_yield: product.page_yield,
      color_type: product.color_type,
      size_category: product.size,
      co2_per_unit: product.co2_per_unit,
      recyclable: product.recyclable,
      replaces_products: product.replaces.split(','),
      embedding: embedding.data[0].embedding,
      search_vector: generateSearchVector(product)
    });
  }
}
```

---

## 📱 Frontend API Structures

### Submit Document Response

```typescript
interface SubmitDocumentResponse {
  success: boolean;
  message: string;
  submissionId: string;
  processingJobId: string;
}
```

### Processing Status Response

```typescript
interface ProcessingStatusResponse {
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  current_step: string;
  estimated_time_remaining?: number; // seconds
  error_message?: string;
}
```

### Results Response

```typescript
interface ResultsResponse {
  submission: {
    id: string;
    customer_name: string;
    company: string;
    created_at: string;
  };
  
  savings: {
    total_cost_savings: number;
    cartridges_saved: number;
    co2_reduced: number;
    trees_saved: number;
  };
  
  report: {
    pdf_url: string;
    generated_at: string;
  };
  
  details: {
    total_items_analyzed: number;
    items_with_savings: number;
    breakdown: SavingsBreakdownItem[];
  };
}
```

---

## 🧪 Test Data Examples

### Sample Test Files

1. **simple-order.csv** - Basic 5-item order
2. **complex-order.xlsx** - 50+ items, multiple categories
3. **messy-data.csv** - Missing SKUs, typos, irregular format
4. **bulk-opportunity.csv** - Large quantities for bulk pricing
5. **mixed-brands.xlsx** - HP, Canon, Epson, Brother products

### Expected Outcomes

For `simple-order.csv` (5 HP cartridges):
- Processing time: <30 seconds
- Matches: 100% exact matches
- Cost savings: ~$150 (25%)
- Cartridges saved: 6
- CO2 reduced: 15 lbs

---

This document provides the complete data structure specification for the document processing system. All structures are designed to be type-safe, extensible, and easy to validate.

