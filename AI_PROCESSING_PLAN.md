# AI Document Processing & Analysis System - Implementation Plan

## Overview
This system will process Excel/CSV files containing office supply orders, cross-reference them with a master product catalog, and generate reports showing cost and environmental savings opportunities.

---

## 🏗️ Architecture Overview

### High-Level Flow
```
User Uploads Document 
    ↓
Frontend (React) → Supabase Edge Function
    ↓
Document Stored in Storage Bucket
    ↓
Background Processing Pipeline (Edge Function)
    ↓
1. Parse Excel/CSV → Extract Order Data
2. OpenAI Agents SDK → Analyze & Structure Data
3. Vector Search → Match Products in Master Catalog
4. AI Comparison → Find Better Alternatives
5. Calculate Savings → Cost + Environmental Impact
6. Generate PDF Report
    ↓
Results Stored in Database
    ↓
Frontend Polls → Display Results
```

---

## 📊 Database Schema Design

### Tables to Create

#### 1. `processing_jobs`
Tracks the status of document processing jobs.
```sql
CREATE TABLE processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES document_submissions(id) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  progress INTEGER DEFAULT 0, -- 0-100
  current_step TEXT, -- parsing, analyzing, matching, calculating, generating
  extracted_data JSONB, -- Raw extracted order data
  matched_products JSONB, -- Products matched from master catalog
  savings_analysis JSONB, -- Calculated savings data
  report_url TEXT, -- URL to generated PDF report
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_processing_jobs_submission_id ON processing_jobs(submission_id);
CREATE INDEX idx_processing_jobs_status ON processing_jobs(status);
```

#### 2. `master_products`
Master product catalog with pricing and environmental data.
```sql
CREATE TABLE master_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT UNIQUE NOT NULL,
  product_name TEXT NOT NULL,
  category TEXT NOT NULL, -- toner, ink_cartridge, printer, paper, etc.
  brand TEXT,
  model TEXT,
  
  -- Pricing Information
  unit_price DECIMAL(10, 2) NOT NULL,
  bulk_price DECIMAL(10, 2), -- Price when buying in bulk
  bulk_minimum INTEGER, -- Minimum quantity for bulk pricing
  
  -- Product Specifications
  page_yield INTEGER, -- Number of pages per cartridge
  color_type TEXT, -- black, color, cyan, magenta, yellow
  size_category TEXT, -- standard, xl, xxl
  
  -- Environmental Data
  co2_per_unit DECIMAL(10, 4), -- CO2 pounds per unit
  recyclable BOOLEAN DEFAULT false,
  recycled_content_percentage INTEGER,
  
  -- Search & Matching
  search_vector TSVECTOR, -- Full-text search
  embedding VECTOR(1536), -- OpenAI embeddings for semantic search
  
  -- Alternative Products
  alternative_product_ids UUID[], -- References to better/larger options
  replaces_products TEXT[], -- SKUs/models this can replace
  
  -- Metadata
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_master_products_sku ON master_products(sku);
CREATE INDEX idx_master_products_category ON master_products(category);
CREATE INDEX idx_master_products_embedding ON master_products USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_master_products_search ON master_products USING gin(search_vector);
```

#### 3. `order_items_extracted`
Individual items extracted from customer uploads.
```sql
CREATE TABLE order_items_extracted (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processing_job_id UUID REFERENCES processing_jobs(id) NOT NULL,
  
  -- Raw Extracted Data
  raw_product_name TEXT,
  raw_sku TEXT,
  raw_description TEXT,
  quantity INTEGER,
  unit_price DECIMAL(10, 2),
  total_price DECIMAL(10, 2),
  
  -- AI Analysis
  normalized_name TEXT, -- Cleaned/standardized name
  detected_category TEXT,
  confidence_score DECIMAL(3, 2), -- 0.00 to 1.00
  
  -- Matching Results
  matched_product_id UUID REFERENCES master_products(id),
  match_score DECIMAL(3, 2),
  match_method TEXT, -- exact, fuzzy, semantic, ai_suggested
  
  -- Savings Opportunity
  recommended_product_id UUID REFERENCES master_products(id),
  cost_savings DECIMAL(10, 2),
  environmental_savings JSONB, -- co2_reduction, cartridges_saved
  savings_reason TEXT, -- "Bulk pricing", "Larger cartridge", etc.
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_order_items_job_id ON order_items_extracted(processing_job_id);
```

#### 4. `savings_reports`
Generated reports with aggregated savings data.
```sql
CREATE TABLE savings_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processing_job_id UUID REFERENCES processing_jobs(id) NOT NULL,
  submission_id UUID REFERENCES document_submissions(id) NOT NULL,
  
  -- Summary Metrics
  total_current_cost DECIMAL(10, 2),
  total_optimized_cost DECIMAL(10, 2),
  total_cost_savings DECIMAL(10, 2),
  savings_percentage DECIMAL(5, 2),
  
  -- Environmental Impact
  cartridges_saved INTEGER,
  co2_reduced_pounds DECIMAL(10, 2),
  trees_saved DECIMAL(10, 2),
  
  -- Report Details
  report_data JSONB, -- Full detailed breakdown
  pdf_url TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_savings_reports_submission ON savings_reports(submission_id);
```

---

## 🗄️ Master Product Catalog Strategy

### Option 1: Database with Vector Search (RECOMMENDED)
**Pros:**
- Fast semantic search using pgvector
- Structured data with relationships
- Easy to update and maintain
- Can handle complex queries
- Supports fuzzy matching and AI embeddings

**Implementation:**
1. Store products in `master_products` table
2. Generate embeddings for product names/descriptions using OpenAI
3. Use pgvector for semantic similarity search
4. Combine with traditional full-text search for exact matches

### Option 2: JSON File + In-Memory Search
**Pros:**
- Simple to start with
- Easy to version control
- Fast for small catalogs (<1000 products)

**Cons:**
- Slower for large catalogs
- No persistence of learned patterns
- Must reload on each request

### Recommended Approach: Hybrid
1. **Initial Load:** Import master catalog from Excel/CSV into database
2. **Embeddings:** Generate OpenAI embeddings for all products
3. **Search Strategy:**
   - Exact SKU match (fastest)
   - Full-text search on product names
   - Semantic search using embeddings (for fuzzy matches)
   - AI agent as final fallback for difficult matches

---

## 🤖 OpenAI Agents SDK Integration

### Agent Architecture

#### Agent 1: Document Parser Agent
**Purpose:** Extract structured data from Excel/CSV files
```javascript
const parserAgent = {
  name: "Document Parser",
  model: "gpt-4o", // Latest model with vision
  instructions: `You are an expert at analyzing office supply purchase orders.
    Extract all order items with: product name, SKU, quantity, price.
    Normalize product names and identify categories.
    Handle various Excel/CSV formats and structures.`,
  tools: [
    // Custom tools for Excel parsing
    { type: "code_interpreter" } // For complex data extraction
  ]
};
```

#### Agent 2: Product Matching Agent
**Purpose:** Match extracted items to master catalog
```javascript
const matchingAgent = {
  name: "Product Matcher",
  model: "gpt-4o",
  instructions: `You are an expert at matching office supply products.
    Given a customer's product description, find the best match in our catalog.
    Consider: SKU variations, brand names, model numbers, specifications.
    Identify equivalent products and better alternatives.`,
  tools: [
    // Custom function to search master catalog
    vectorSearchTool,
    exactMatchTool
  ]
};
```

#### Agent 3: Savings Analysis Agent
**Purpose:** Calculate savings and generate recommendations
```javascript
const savingsAgent = {
  name: "Savings Analyst",
  model: "gpt-4o",
  instructions: `You are an expert at analyzing cost and environmental savings.
    Compare customer's current purchases with our optimized recommendations.
    Calculate: cost savings, bulk opportunities, cartridge consolidation.
    Provide clear explanations for each recommendation.`,
  tools: [
    calculationTool,
    environmentalImpactTool
  ]
};
```

#### Agent 4: Report Generation Agent
**Purpose:** Create the final PDF report
```javascript
const reportAgent = {
  name: "Report Generator",
  model: "gpt-4o",
  instructions: `You are an expert at creating compelling savings reports.
    Generate a professional PDF showing:
    - Executive summary with key metrics
    - Detailed product-by-product comparison
    - Environmental impact analysis
    - Clear call-to-action`,
  tools: [
    pdfGenerationTool
  ]
};
```

### Multi-Agent Workflow (Swarm Pattern)
```javascript
const processDocument = async (submissionId, fileUrl) => {
  // 1. Parser Agent extracts data
  const extractedData = await runAgent(parserAgent, {
    task: "parse_document",
    fileUrl: fileUrl
  });
  
  // 2. Matching Agent finds products
  const matches = await runAgent(matchingAgent, {
    task: "match_products",
    items: extractedData.items,
    catalog: masterCatalog
  });
  
  // 3. Savings Agent calculates opportunities
  const analysis = await runAgent(savingsAgent, {
    task: "analyze_savings",
    currentOrders: matches,
    recommendations: findBetterAlternatives(matches)
  });
  
  // 4. Report Agent generates PDF
  const report = await runAgent(reportAgent, {
    task: "generate_report",
    analysis: analysis,
    customerInfo: getCustomerInfo(submissionId)
  });
  
  return report;
};
```

---

## 📄 Document Processing Pipeline

### Step-by-Step Flow

#### Step 1: File Upload & Storage
- Already implemented ✓
- File stored in Supabase Storage
- Submission record created in `document_submissions`

#### Step 2: Trigger Background Processing
```typescript
// After file upload, trigger processing edge function
const { data } = await supabase.functions.invoke('process-document', {
  body: { submissionId: submission.id }
});
```

#### Step 3: Parse Document
```typescript
// In process-document edge function
async function parseDocument(fileUrl: string) {
  // Option A: Use SheetJS (xlsx) for Excel parsing
  const workbook = XLSX.read(fileBuffer);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawData = XLSX.utils.sheet_to_json(sheet);
  
  // Option B: Use OpenAI with Code Interpreter
  const parserResponse = await openai.beta.threads.runs.create({
    thread_id: threadId,
    assistant_id: parserAgentId,
    instructions: "Parse this purchase order and extract all items"
  });
  
  // Option C: Hybrid - SheetJS + AI for validation/cleaning
  const rawData = parseWithSheetJS(fileBuffer);
  const cleanedData = await validateWithAI(rawData);
  
  return cleanedData;
}
```

#### Step 4: Product Matching
```typescript
async function matchProducts(extractedItems) {
  const matches = [];
  
  for (const item of extractedItems) {
    // 1. Try exact SKU match
    let match = await exactMatch(item.sku);
    
    // 2. Try full-text search
    if (!match) {
      match = await fullTextSearch(item.productName);
    }
    
    // 3. Try semantic search with embeddings
    if (!match || match.score < 0.8) {
      const embedding = await generateEmbedding(item.productName);
      match = await vectorSearch(embedding);
    }
    
    // 4. Use AI agent as fallback
    if (!match || match.score < 0.6) {
      match = await aiMatch(item);
    }
    
    matches.push({
      original: item,
      matched: match.product,
      confidence: match.score
    });
  }
  
  return matches;
}
```

#### Step 5: Find Better Alternatives
```typescript
async function findAlternatives(matchedProducts) {
  const recommendations = [];
  
  for (const match of matchedProducts) {
    const currentProduct = match.matched;
    
    // Check for larger cartridges (XL, XXL)
    const largerSizes = await findLargerSizes(currentProduct);
    
    // Check for bulk pricing
    const bulkOption = checkBulkPricing(currentProduct, match.original.quantity);
    
    // Check for equivalent alternatives
    const alternatives = await findEquivalents(currentProduct);
    
    // Use AI to recommend best option
    const recommendation = await savingsAgent.recommend({
      current: match.original,
      product: currentProduct,
      alternatives: [...largerSizes, ...alternatives],
      bulkOption
    });
    
    recommendations.push(recommendation);
  }
  
  return recommendations;
}
```

#### Step 6: Calculate Savings
```typescript
function calculateSavings(recommendations) {
  let totalCostSavings = 0;
  let cartridgesSaved = 0;
  let co2Reduced = 0;
  
  for (const rec of recommendations) {
    // Cost savings
    const currentCost = rec.original.quantity * rec.original.unitPrice;
    const optimizedCost = calculateOptimizedCost(rec);
    const savings = currentCost - optimizedCost;
    totalCostSavings += savings;
    
    // Cartridge savings (if switching to larger size)
    if (rec.recommended.sizeCategory > rec.current.sizeCategory) {
      const currentCartridges = Math.ceil(
        rec.original.quantity * rec.current.pageYield / rec.recommended.pageYield
      );
      const optimizedCartridges = rec.original.quantity;
      cartridgesSaved += (currentCartridges - optimizedCartridges);
    }
    
    // Environmental impact
    co2Reduced += cartridgesSaved * rec.recommended.co2PerUnit;
  }
  
  return {
    totalCostSavings,
    cartridgesSaved,
    co2Reduced,
    treesSaved: co2Reduced / 48, // 1 tree absorbs ~48 lbs CO2/year
    details: recommendations
  };
}
```

#### Step 7: Generate PDF Report
```typescript
async function generatePDFReport(savingsAnalysis, customerInfo) {
  // Option A: Use AI to generate HTML, then convert to PDF
  const htmlContent = await reportAgent.generateHTML(savingsAnalysis);
  const pdfBuffer = await htmlToPDF(htmlContent);
  
  // Option B: Use PDF generation library (e.g., pdfmake, jsPDF)
  const pdf = new jsPDF();
  pdf.text(`BAV Savings Challenge Report`, 20, 20);
  pdf.text(`Total Savings: $${savingsAnalysis.totalCostSavings}`, 20, 40);
  // ... add more content
  
  // Option C: Use template-based approach (recommended)
  const template = await loadPDFTemplate();
  const filledPDF = await fillTemplate(template, {
    customer: customerInfo,
    savings: savingsAnalysis,
    timestamp: new Date()
  });
  
  // Upload to storage
  const { data } = await supabase.storage
    .from('reports')
    .upload(`${submissionId}/report.pdf`, pdfBuffer);
  
  return data.path;
}
```

---

## 🔄 Real-Time Status Updates

### Polling Strategy
```typescript
// Frontend: Poll for status updates
async function pollProcessingStatus(submissionId: string) {
  const interval = setInterval(async () => {
    const { data } = await supabase
      .from('processing_jobs')
      .select('*')
      .eq('submission_id', submissionId)
      .single();
    
    // Update UI with progress
    setProgress(data.progress);
    setCurrentStep(data.current_step);
    
    if (data.status === 'completed') {
      clearInterval(interval);
      loadResults(data);
    } else if (data.status === 'failed') {
      clearInterval(interval);
      showError(data.error_message);
    }
  }, 2000); // Poll every 2 seconds
}
```

### Alternative: Real-time Subscriptions
```typescript
// Use Supabase Realtime for instant updates
const subscription = supabase
  .channel('processing-updates')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'processing_jobs',
    filter: `submission_id=eq.${submissionId}`
  }, (payload) => {
    updateProcessingStatus(payload.new);
  })
  .subscribe();
```

---

## 📦 Required Packages

### Backend (Edge Functions)
```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.x",
    "openai": "^4.x",
    "xlsx": "^0.18.x",
    "pdf-lib": "^1.17.x",
    "pdfmake": "^0.2.x",
    "zod": "^3.x"
  }
}
```

### Frontend (Already installed)
- Already has necessary packages ✓

---

## 🗂️ File Structure

```
brave-submit-engine/
├── supabase/
│   ├── functions/
│   │   ├── process-document/
│   │   │   ├── index.ts (Main processing logic)
│   │   │   ├── parsers/
│   │   │   │   ├── excel-parser.ts
│   │   │   │   └── csv-parser.ts
│   │   │   ├── agents/
│   │   │   │   ├── parser-agent.ts
│   │   │   │   ├── matching-agent.ts
│   │   │   │   ├── savings-agent.ts
│   │   │   │   └── report-agent.ts
│   │   │   ├── matching/
│   │   │   │   ├── exact-match.ts
│   │   │   │   ├── fuzzy-match.ts
│   │   │   │   ├── vector-search.ts
│   │   │   │   └── ai-match.ts
│   │   │   ├── calculations/
│   │   │   │   ├── cost-savings.ts
│   │   │   │   └── environmental.ts
│   │   │   └── report/
│   │   │       ├── pdf-generator.ts
│   │   │       └── templates/
│   │   └── submit-document/ (existing)
│   └── migrations/
│       ├── 001_processing_jobs.sql
│       ├── 002_master_products.sql
│       ├── 003_order_items_extracted.sql
│       └── 004_savings_reports.sql
├── src/
│   ├── lib/
│   │   ├── api/
│   │   │   ├── processing.ts (Frontend API client)
│   │   │   └── results.ts
│   │   └── supabase.ts (existing)
│   └── components/
│       ├── DocumentSubmissionForm.tsx (existing)
│       ├── ProcessingAnimation.tsx (update with real status)
│       └── ResultsPage.tsx (update with real data)
└── data/
    ├── master-catalog.xlsx (Initial product catalog)
    └── import-catalog-script.ts
```

---

## 🚀 Implementation Phases

### Phase 1: Foundation (Week 1)
1. ✅ Create database schema and migrations
2. ✅ Set up OpenAI API integration
3. ✅ Create basic processing pipeline structure
4. ✅ Implement Excel/CSV parsing

### Phase 2: AI Integration (Week 2)
1. ✅ Set up OpenAI Agents SDK
2. ✅ Create parser agent
3. ✅ Create matching agent
4. ✅ Implement basic product matching

### Phase 3: Master Catalog (Week 2-3)
1. ✅ Design master product schema
2. ✅ Import initial product data
3. ✅ Generate embeddings for products
4. ✅ Implement search strategies

### Phase 4: Calculations & Analysis (Week 3)
1. ✅ Build cost savings calculator
2. ✅ Build environmental impact calculator
3. ✅ Create savings agent
4. ✅ Implement recommendation logic

### Phase 5: Report Generation (Week 4)
1. ✅ Design PDF template
2. ✅ Implement PDF generation
3. ✅ Create report agent
4. ✅ Test report output

### Phase 6: Frontend Integration (Week 4)
1. ✅ Update ProcessingAnimation with real progress
2. ✅ Update ResultsPage with actual data
3. ✅ Implement status polling
4. ✅ Add error handling

### Phase 7: Testing & Optimization (Week 5)
1. ✅ End-to-end testing
2. ✅ Performance optimization
3. ✅ Error handling improvements
4. ✅ Production deployment

---

## 💰 Cost Estimation

### OpenAI API Costs (per document)
- **GPT-4o:** ~$0.01-0.05 per request
- **Embeddings:** ~$0.0001 per item
- **Estimated per document:** $0.10-0.50 depending on complexity

### Supabase Costs
- **Database:** Included in free tier for small usage
- **Storage:** ~$0.02 per GB
- **Edge Functions:** Included in free tier (500K invocations)

### Total Estimated Cost per Submission
- **Low volume (<100/month):** ~$0.15-0.75 per submission
- **High volume (1000+/month):** ~$0.05-0.25 per submission (bulk discounts)

---

## 🔒 Security Considerations

1. **API Keys:** Store OpenAI API key in Supabase secrets
2. **RLS Policies:** Ensure users can only access their own submissions
3. **File Validation:** Validate file types and sizes
4. **Rate Limiting:** Implement rate limits on API endpoints
5. **Data Privacy:** Encrypt sensitive customer data
6. **Audit Logging:** Log all processing steps for debugging

---

## 📊 Success Metrics

1. **Processing Accuracy:** >95% correct product matches
2. **Processing Speed:** <2 minutes average per document
3. **User Satisfaction:** Measured by report quality feedback
4. **Cost Efficiency:** Stay within $0.50 per submission
5. **Error Rate:** <2% processing failures

---

## 🎯 Next Steps

1. **Review this plan** and provide feedback
2. **Provide master product catalog** (Excel/CSV with all products)
3. **Sample customer orders** for testing
4. **Clarify any specific requirements** for calculations
5. **Begin implementation** starting with Phase 1

---

## 🤔 Questions to Clarify

1. **Master Catalog:**
   - Do you have an existing product catalog file?
   - How many products (~100, 1000, 10000+)?
   - How often does it need updating?

2. **Savings Calculations:**
   - What bulk pricing tiers do you offer?
   - How do you calculate environmental impact? (formulas?)
   - Any specific CO2 per cartridge values?

3. **Report Format:**
   - Is the BMO_Savings_Kit.pdf the exact format you want?
   - Any specific branding requirements?
   - Should reports be customizable?

4. **Integration:**
   - Should there be email notifications when processing completes?
   - Do you want CRM integration for follow-ups?
   - Should users be able to see history of past submissions?

5. **Scale:**
   - Expected volume? (10/day, 100/day, 1000/day?)
   - Any SLA requirements for processing speed?

---

Let me know if you'd like me to start implementing this plan or if you have any questions or changes to the approach!

