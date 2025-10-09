# Document Processing System - Improvement Plan

**Created:** October 9, 2025  
**Objective:** Design a human-like, highly accurate document processing system

---

## 🎯 Current Issues Identified

1. **Missing Items** - Some products in uploaded files are not being extracted
2. **Quantity Handling** - Calculations not properly accounting for quantities and pack sizes
3. **Accuracy** - Match confidence not high enough, some false negatives
4. **Consistency** - Results vary between similar documents

---

## 🧠 Human-Like Processing Approach

### How a Human Analyst Would Process a Document:

1. **Thorough Reading**: Scan entire document to identify structure
2. **Data Extraction**: Carefully extract ALL line items with complete information
3. **Multi-Point Matching**: Use EVERY available identifier (SKU, OEM#, description, brand)
4. **Quantity Awareness**: Always check quantities and unit sizes
5. **Price Comparison**: Normalize all prices to same basis (per-unit)
6. **Verification**: Cross-check results for accuracy
7. **Documentation**: Note confidence level and reasoning for each match

---

## 📊 System Architecture Improvements

### Phase 1: Enhanced Data Extraction (The Foundation)

#### Problem: Missing items during extraction
**Root Causes:**
- Rows skipped due to overly strict validation
- Header detection missing actual data rows
- Synthetic column names causing confusion
- Not capturing all available SKU columns

#### Solution: Multi-Pass Extraction Strategy

```typescript
interface EnhancedExtraction {
  // Pass 1: Structure Analysis
  documentStructure: {
    totalRows: number;
    headerRow: number;
    dataStartRow: number;
    dataEndRow: number;
    identifiedColumns: ColumnMapping;
  };
  
  // Pass 2: Comprehensive Data Capture
  extractedItems: ExtractedItem[];
  
  // Pass 3: Validation & Quality Check
  validationReport: {
    itemsExtracted: number;
    itemsSkipped: number;
    skippedReasons: string[];
    confidenceScore: number;
  };
}

interface ExtractedItem {
  rowNumber: number; // Track source row
  
  // Product Identifiers (ALL available)
  productName: string;
  description: string;
  
  // ALL SKU-like fields found
  skuFields: {
    primarySku?: string;        // Main SKU column
    oemNumber?: string;          // OEM/Part Number
    manufacturerSku?: string;    // Manufacturer code
    wholesalerCode?: string;     // Wholesaler/Depot code
    staplesSku?: string;         // Staples-specific
    allSkus: string[];          // Combined array of ALL found SKUs
  };
  
  // Quantity & Pricing
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  uom?: string;                 // Unit of measure if specified
  
  // Metadata
  extractionConfidence: number; // 0-1 how confident we are in extraction
  dataQuality: {
    hasSku: boolean;
    hasPrice: boolean;
    hasQuantity: boolean;
    hasDescription: boolean;
  };
}
```

#### Implementation Changes:

1. **Relaxed Validation Rules**
   - Extract rows even with missing price (use fallback pricing)
   - Accept items with only description (no SKU)
   - Don't skip items that look like "header-like" text if in data section

2. **Multi-Column SKU Detection**
   ```typescript
   function findAllSkuColumns(headers: string[]): SkuColumnMap {
     return {
       oem: findColumn(headers, ['oem', 'part number', 'part #', 'mfg part']),
       wholesaler: findColumn(headers, ['wholesaler code', 'wholesaler product code']),
       staples: findColumn(headers, ['staples sku', 'staples item']),
       depot: findColumn(headers, ['depot code', 'depot product code']),
       generic: findColumn(headers, ['sku', 'item number', 'product code', 'catalog'])
     };
   }
   ```

3. **Row-by-Row Extraction Log**
   ```typescript
   console.log(`Row ${rowNum}: Extracted "${productName}" with ${skuCount} SKUs, Qty: ${qty}, Price: ${price}`);
   ```

---

### Phase 2: Enhanced Product Matching (The Intelligence)

#### Problem: Not matching items that should match
**Root Causes:**
- Only trying primary SKU field
- Not using all available product data
- Giving up too early in matching process
- Not handling SKU variations well enough

#### Solution: Multi-Dimensional Matching Strategy

```typescript
interface MatchingStrategy {
  // Use ALL data points, not just one
  matchAttempts: [
    { method: 'exact_sku_all_fields', priority: 1 },      // Try ALL SKU fields
    { method: 'fuzzy_sku_all_fields', priority: 2 },      // Fuzzy on ALL SKU fields
    { method: 'combined_sku_description', priority: 3 },  // SKU + description together
    { method: 'full_text_search', priority: 4 },
    { method: 'semantic_search', priority: 5 },
    { method: 'brand_model_search', priority: 6 },        // Extract brand + model
    { method: 'ai_agent', priority: 7 }                   // Last resort
  ];
  
  // Scoring System
  confidenceFactors: {
    exactSkuMatch: 1.0,
    fuzzySkuMatch: 0.95,
    skuPlusDescMatch: 0.90,
    multipleDataPoints: 0.85,
    semanticOnly: 0.75,
    aiSuggested: 0.70
  };
}
```

#### Implementation: Enhanced Matching Function

```typescript
async function matchSingleProductEnhanced(item: ExtractedItem, index: number, total: number) {
  const matchLog: MatchAttempt[] = [];
  let bestMatch: Match | null = null;
  
  console.log(`\n🔍 Matching Item ${index}/${total}`);
  console.log(`   Product: "${item.productName}"`);
  console.log(`   Available SKUs: ${item.skuFields.allSkus.join(', ')}`);
  console.log(`   Quantity: ${item.quantity}`);
  
  // ATTEMPT 1: Try exact match on ALL available SKU fields
  for (const sku of item.skuFields.allSkus) {
    if (!sku || sku.length < 2) continue;
    
    const match = await exactSKUMatch(sku);
    if (match) {
      matchLog.push({ method: 'exact_sku', sku, score: match.score });
      if (!bestMatch || match.score > bestMatch.score) {
        bestMatch = match;
      }
    }
  }
  
  if (bestMatch && bestMatch.score === 1.0) {
    console.log(`   ✅ Exact SKU match found: ${bestMatch.product.sku}`);
    return { ...item, match: bestMatch, matchLog };
  }
  
  // ATTEMPT 2: Fuzzy match on ALL SKU fields
  for (const sku of item.skuFields.allSkus) {
    if (!sku || sku.length < 2) continue;
    
    const match = await fuzzySKUMatch(sku);
    if (match && (!bestMatch || match.score > bestMatch.score)) {
      matchLog.push({ method: 'fuzzy_sku', sku, score: match.score });
      bestMatch = match;
    }
  }
  
  if (bestMatch && bestMatch.score >= 0.85) {
    console.log(`   ✅ Fuzzy SKU match found: ${bestMatch.product.sku} (score: ${bestMatch.score})`);
    return { ...item, match: bestMatch, matchLog };
  }
  
  // ATTEMPT 3: Combined SKU + Description search
  for (const sku of item.skuFields.allSkus) {
    const combinedSearch = `${sku} ${item.productName}`;
    const match = await fullTextSearch(combinedSearch);
    if (match && (!bestMatch || match.score > bestMatch.score)) {
      matchLog.push({ method: 'sku_plus_desc', search: combinedSearch, score: match.score });
      bestMatch = match;
    }
  }
  
  // ATTEMPT 4: Brand + Model extraction and search
  const brandModel = await extractBrandAndModel(item.productName);
  if (brandModel.brand && brandModel.model) {
    const match = await searchByBrandModel(brandModel.brand, brandModel.model, item.productName);
    if (match && (!bestMatch || match.score > bestMatch.score)) {
      matchLog.push({ method: 'brand_model', brandModel, score: match.score });
      bestMatch = match;
    }
  }
  
  // ATTEMPT 5: Full-text search on product name
  if (!bestMatch || bestMatch.score < 0.80) {
    const match = await fullTextSearch(item.productName);
    if (match && (!bestMatch || match.score > bestMatch.score)) {
      matchLog.push({ method: 'full_text', score: match.score });
      bestMatch = match;
    }
  }
  
  // ATTEMPT 6: Semantic search
  if (!bestMatch || bestMatch.score < 0.75) {
    const match = await semanticSearch(item.productName);
    if (match && (!bestMatch || match.score > bestMatch.score)) {
      matchLog.push({ method: 'semantic', score: match.score });
      bestMatch = match;
    }
  }
  
  // ATTEMPT 7: AI Agent (only if still low confidence)
  if (!bestMatch || bestMatch.score < 0.65) {
    console.log(`   🤖 Using AI agent (low confidence: ${bestMatch?.score || 0})`);
    const match = await aiAgentMatch(item);
    if (match && (!bestMatch || match.score > bestMatch.score)) {
      matchLog.push({ method: 'ai_agent', score: match.score });
      bestMatch = match;
    }
  }
  
  if (bestMatch) {
    console.log(`   ✅ Final match: ${bestMatch.product.product_name}`);
    console.log(`   📊 Score: ${bestMatch.score} via ${bestMatch.method}`);
  } else {
    console.log(`   ❌ No match found after ${matchLog.length} attempts`);
  }
  
  return {
    ...item,
    match: bestMatch,
    matchLog
  };
}
```

---

### Phase 3: Accurate Quantity & Price Handling

#### Problem: Savings calculations not accounting for quantities properly
**Root Causes:**
- Pack quantities not always considered
- UOM (unit of measure) variations
- Bulk pricing not calculated correctly
- Quantity-based recommendations not accounting for actual usage

#### Solution: Comprehensive Quantity Normalization

```typescript
interface QuantityAnalysis {
  // User's order (as-is)
  userQuantityOrdered: number;      // What user put in their file
  userUnitPrice: number;             // Price user is paying per unit
  userUom: string;                   // User's unit of measure (EA, BX, CS)
  userTotalCost: number;             // quantity × unitPrice
  
  // Normalized to standard units (for fair comparison)
  normalizedQuantity: number;        // Converted to "each" units
  normalizedPricePerEach: number;    // Price per single unit
  normalizedTotalCost: number;       // Normalized total
  
  // Master product reference
  masterPackQuantity: number;        // How product is sold (pack of X)
  masterUom: string;                 // How product is measured
  masterPricePerEach: number;        // ASE price normalized to per-each
  
  // For cartridges: Page yield calculations
  totalPagesNeeded?: number;         // Based on user quantity
  costPerPage?: number;              // For optimization
  
  // Recommendation
  recommendedQuantity: number;       // How many units to buy
  recommendedTotalCost: number;      // Total cost of recommendation
  actualSavings: number;             // Dollar savings
  savingsPercentage: number;         // % savings
}

function analyzeQuantityAndPrice(
  userItem: ExtractedItem,
  matchedProduct: MasterProduct
): QuantityAnalysis {
  // Step 1: Normalize user's pricing to per-each basis
  const userPackQty = estimatePackQuantity(userItem.uom) || 1;
  const userPricePerEach = userItem.unitPrice / userPackQty;
  const userQuantityInEach = userItem.quantity * userPackQty;
  const userTotalCost = userItem.quantity * userItem.unitPrice;
  
  // Step 2: Get master product normalized price
  const masterPackQty = matchedProduct.pack_qty_std || 1;
  const masterPricePerEach = matchedProduct.ase_unit_price || 
                             (matchedProduct.unit_price / masterPackQty);
  
  // Step 3: Calculate how many units needed
  let recommendedQuantity = userItem.quantity; // Default: same quantity
  let recommendedTotalCost = recommendedQuantity * matchedProduct.ase_unit_price;
  
  // Step 4: If product has page yield, optimize by yield
  if (matchedProduct.page_yield) {
    const totalPagesNeeded = userQuantityInEach * (matchedProduct.page_yield || 0);
    const costPerPage = masterPricePerEach / matchedProduct.page_yield;
    
    // Check for higher-yield alternatives
    // (handled separately in suggestHigherYield function)
  }
  
  // Step 5: Calculate actual savings
  const actualSavings = userTotalCost - recommendedTotalCost;
  const savingsPercentage = (actualSavings / userTotalCost) * 100;
  
  return {
    userQuantityOrdered: userItem.quantity,
    userUnitPrice: userItem.unitPrice,
    userUom: userItem.uom || 'EA',
    userTotalCost,
    
    normalizedQuantity: userQuantityInEach,
    normalizedPricePerEach: userPricePerEach,
    normalizedTotalCost: userTotalCost,
    
    masterPackQuantity: masterPackQty,
    masterUom: matchedProduct.uom_std || 'EA',
    masterPricePerEach,
    
    totalPagesNeeded: matchedProduct.page_yield ? 
      userQuantityInEach * matchedProduct.page_yield : undefined,
    costPerPage: matchedProduct.page_yield ? 
      masterPricePerEach / matchedProduct.page_yield : undefined,
    
    recommendedQuantity,
    recommendedTotalCost,
    actualSavings,
    savingsPercentage
  };
}
```

---

### Phase 4: Validation & Quality Assurance

#### Solution: Multi-Layer Validation

```typescript
interface ValidationReport {
  stage: 'extraction' | 'matching' | 'calculation';
  checks: ValidationCheck[];
  overallQuality: 'excellent' | 'good' | 'acceptable' | 'poor';
  issuesFound: Issue[];
  recommendations: string[];
}

interface ValidationCheck {
  name: string;
  passed: boolean;
  details: string;
  severity: 'critical' | 'warning' | 'info';
}

async function validateExtraction(items: ExtractedItem[]): Promise<ValidationReport> {
  const checks: ValidationCheck[] = [];
  
  // Check 1: Did we extract a reasonable number of items?
  const expectedMinItems = 1; // At least one item
  checks.push({
    name: 'Item count',
    passed: items.length >= expectedMinItems,
    details: `Extracted ${items.length} items`,
    severity: items.length === 0 ? 'critical' : 'info'
  });
  
  // Check 2: Do items have required fields?
  const itemsWithName = items.filter(i => i.productName && i.productName.length > 2);
  const itemsWithSku = items.filter(i => i.skuFields.allSkus.length > 0);
  const itemsWithPrice = items.filter(i => i.unitPrice > 0);
  
  checks.push({
    name: 'Items with product name',
    passed: itemsWithName.length === items.length,
    details: `${itemsWithName.length}/${items.length} have names`,
    severity: itemsWithName.length < items.length * 0.8 ? 'warning' : 'info'
  });
  
  checks.push({
    name: 'Items with SKU',
    passed: itemsWithSku.length > items.length * 0.5,
    details: `${itemsWithSku.length}/${items.length} have SKUs`,
    severity: itemsWithSku.length < items.length * 0.3 ? 'warning' : 'info'
  });
  
  checks.push({
    name: 'Items with price',
    passed: itemsWithPrice.length > items.length * 0.7,
    details: `${itemsWithPrice.length}/${items.length} have prices`,
    severity: itemsWithPrice.length < items.length * 0.5 ? 'warning' : 'info'
  });
  
  // Check 3: Quantity sanity checks
  const suspiciousQuantities = items.filter(i => i.quantity > 1000 || i.quantity === 0);
  checks.push({
    name: 'Quantity sanity',
    passed: suspiciousQuantities.length === 0,
    details: `${suspiciousQuantities.length} items with suspicious quantities`,
    severity: suspiciousQuantities.length > 0 ? 'warning' : 'info'
  });
  
  // Determine overall quality
  const criticalFailures = checks.filter(c => !c.passed && c.severity === 'critical').length;
  const warnings = checks.filter(c => !c.passed && c.severity === 'warning').length;
  
  let overallQuality: 'excellent' | 'good' | 'acceptable' | 'poor';
  if (criticalFailures > 0) overallQuality = 'poor';
  else if (warnings > 2) overallQuality = 'acceptable';
  else if (warnings > 0) overallQuality = 'good';
  else overallQuality = 'excellent';
  
  return {
    stage: 'extraction',
    checks,
    overallQuality,
    issuesFound: [],
    recommendations: []
  };
}

async function validateMatching(matchedItems: any[]): Promise<ValidationReport> {
  const checks: ValidationCheck[] = [];
  
  // Check 1: Match rate
  const itemsMatched = matchedItems.filter(i => i.matched_product).length;
  const matchRate = itemsMatched / matchedItems.length;
  
  checks.push({
    name: 'Match rate',
    passed: matchRate >= 0.80, // 80%+ should match
    details: `${itemsMatched}/${matchedItems.length} (${(matchRate * 100).toFixed(1)}%) matched`,
    severity: matchRate < 0.60 ? 'critical' : matchRate < 0.80 ? 'warning' : 'info'
  });
  
  // Check 2: Match confidence distribution
  const highConfidence = matchedItems.filter(i => i.match_score >= 0.90).length;
  const mediumConfidence = matchedItems.filter(i => i.match_score >= 0.70 && i.match_score < 0.90).length;
  const lowConfidence = matchedItems.filter(i => i.match_score > 0 && i.match_score < 0.70).length;
  
  checks.push({
    name: 'High confidence matches',
    passed: highConfidence >= itemsMatched * 0.60,
    details: `${highConfidence} high (≥0.90), ${mediumConfidence} medium (0.70-0.89), ${lowConfidence} low (<0.70)`,
    severity: highConfidence < itemsMatched * 0.40 ? 'warning' : 'info'
  });
  
  // Check 3: Method distribution (are we relying too much on AI?)
  const exactMatches = matchedItems.filter(i => i.match_method === 'exact_sku').length;
  const aiMatches = matchedItems.filter(i => i.match_method === 'ai_suggested').length;
  
  checks.push({
    name: 'Exact SKU matches',
    passed: exactMatches >= itemsMatched * 0.40,
    details: `${exactMatches} exact SKU matches (${(exactMatches/itemsMatched*100).toFixed(1)}%)`,
    severity: exactMatches < itemsMatched * 0.20 ? 'warning' : 'info'
  });
  
  let overallQuality: 'excellent' | 'good' | 'acceptable' | 'poor';
  const criticalFailures = checks.filter(c => !c.passed && c.severity === 'critical').length;
  const warnings = checks.filter(c => !c.passed && c.severity === 'warning').length;
  
  if (criticalFailures > 0) overallQuality = 'poor';
  else if (warnings > 1) overallQuality = 'acceptable';
  else if (warnings > 0) overallQuality = 'good';
  else overallQuality = 'excellent';
  
  return {
    stage: 'matching',
    checks,
    overallQuality,
    issuesFound: [],
    recommendations: []
  };
}
```

---

### Phase 5: Enhanced Logging & Debugging

#### Solution: Comprehensive Activity Log

```typescript
interface ProcessingLog {
  jobId: string;
  timestamp: Date;
  
  // Document Analysis
  documentAnalysis: {
    fileName: string;
    fileSize: number;
    fileType: string;
    sheetName?: string;
    totalRows: number;
    headerRow: number;
    dataRows: number;
    columnsDetected: string[];
  };
  
  // Extraction Details
  extraction: {
    itemsExtracted: number;
    itemsSkipped: number;
    skippedRows: Array<{ row: number; reason: string }>;
    columnMapping: Record<string, string>;
    quality: 'excellent' | 'good' | 'acceptable' | 'poor';
  };
  
  // Matching Details
  matching: {
    itemsProcessed: number;
    itemsMatched: number;
    matchMethods: Record<string, number>; // Count per method
    avgConfidence: number;
    lowConfidenceItems: Array<{ item: string; score: number }>;
  };
  
  // Calculation Details
  calculations: {
    totalCurrentCost: number;
    totalRecommendedCost: number;
    totalSavings: number;
    itemsWithSavings: number;
    avgSavingsPerItem: number;
  };
  
  // Performance Metrics
  performance: {
    totalDuration: number; // milliseconds
    extractionTime: number;
    matchingTime: number;
    calculationTime: number;
    reportGenerationTime: number;
  };
  
  // Issues & Warnings
  issues: Array<{
    severity: 'error' | 'warning' | 'info';
    stage: string;
    message: string;
    affectedItem?: string;
  }>;
}

// Store detailed log in database for review
async function saveProcessingLog(log: ProcessingLog) {
  await supabase
    .from('processing_jobs')
    .update({
      metadata: {
        ...log,
        generated_at: new Date().toISOString()
      }
    })
    .eq('id', log.jobId);
}
```

---

## 🚀 Implementation Roadmap

### Week 1: Enhanced Extraction
- [ ] Implement multi-column SKU detection
- [ ] Add comprehensive row-by-row logging
- [ ] Relax validation rules
- [ ] Add extraction quality validation
- [ ] Test with 10 sample documents

### Week 2: Enhanced Matching
- [ ] Implement multi-dimensional matching
- [ ] Add brand/model extraction
- [ ] Improve fuzzy matching
- [ ] Add match attempt logging
- [ ] Test matching accuracy on 50 items

### Week 3: Quantity & Price Handling
- [ ] Implement comprehensive quantity normalization
- [ ] Add UOM handling
- [ ] Improve cost-per-page calculations
- [ ] Add bulk pricing logic
- [ ] Test calculations for accuracy

### Week 4: Validation & Testing
- [ ] Implement validation framework
- [ ] Add quality checks at each stage
- [ ] Create comprehensive test suite
- [ ] Performance optimization
- [ ] End-to-end testing with real documents

### Week 5: Deployment & Monitoring
- [ ] Deploy to production
- [ ] Monitor processing logs
- [ ] Collect accuracy metrics
- [ ] Fine-tune based on real usage
- [ ] Document improvements

---

## 📊 Success Metrics

### Extraction Quality
- **Target:** 100% of items extracted (no false negatives)
- **Current:** Unknown (need baseline)
- **Measure:** Items extracted vs manual count

### Matching Accuracy
- **Target:** 95%+ correct matches
- **Current:** ~85% estimated
- **Measure:** Manual review of 100 random matches

### Quantity Handling
- **Target:** 100% correct quantity-based calculations
- **Current:** Issues reported
- **Measure:** Manual verification of savings calculations

### Overall System Confidence
- **Target:** "Excellent" quality rating on 90%+ of jobs
- **Current:** Unknown
- **Measure:** Automated validation reports

---

## 🔧 Technical Debt to Address

1. **AI Agent Re-enablement** - Currently disabled for performance, need to make it optional/async
2. **Better Error Recovery** - Handle edge cases more gracefully
3. **Caching** - Cache master product lookups for better performance
4. **Parallel Processing** - Process matching in true parallel for speed
5. **Progress Tracking** - More granular progress updates (per-item)

---

## 📝 Testing Strategy

### Test Documents Needed:
1. **Simple Order** (5-10 items, clear format)
2. **Complex Order** (50+ items, multiple SKU columns)
3. **Messy Data** (missing prices, typos, irregular format)
4. **Usage Report** (no prices, just usage quantities)
5. **Multiple Formats** (CSV vs Excel, different layouts)

### Test Scenarios:
- All items should be extracted
- All items should match (or clearly marked as no match)
- Quantities should be accurate
- Savings should be mathematically correct
- Results should be reproducible

---

This plan provides a comprehensive roadmap to transform your processing system into a highly accurate, human-like analysis engine.

