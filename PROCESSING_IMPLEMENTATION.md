# Process Document - Enhanced Implementation

This document outlines the specific code changes needed to implement the improvements from `PROCESSING_IMPROVEMENT_PLAN.md`.

---

## Changes to `/supabase/functions/process-document/index.ts`

### 1. Enhanced Data Structures

Add after line 316 (after ProcessingContext interface):

```typescript
// Enhanced extraction structures
interface EnhancedExtractedItem {
  rowNumber: number;
  raw_product_name: string;
  raw_description: string;
  raw_sku: string | null;
  
  // ALL SKU fields found (not just primary)
  sku_fields: {
    primary_sku?: string;
    oem_number?: string;
    wholesaler_code?: string;
    staples_sku?: string;
    depot_code?: string;
    all_skus: string[]; // Combined array for matching
  };
  
  quantity: number;
  unit_price: number;
  total_price: number;
  uom?: string;
  
  // Data quality tracking
  extraction_quality: {
    has_sku: boolean;
    has_price: boolean;
    has_quantity: boolean;
    has_description: boolean;
    confidence: number; // 0-1
  };
}

// Match attempt logging
interface MatchAttempt {
  method: string;
  attempted_value?: string;
  score: number;
  product_id?: string;
  timestamp: Date;
}

// Processing log structure
interface ProcessingStepLog {
  step: string;
  timestamp: Date;
  duration_ms: number;
  details: any;
  success: boolean;
  errors?: string[];
}
```

---

### 2. Enhanced `extractProductInfo` Function

Replace the existing `extractProductInfo` function (lines 835-993) with this improved version:

```typescript
/**
 * ENHANCED: Extract product info from row with comprehensive multi-column detection
 */
function extractProductInfo(row: Record<string, string>, headers: string[], rowNumber: number) {
  // Check if we're using synthetic headers (Column_1, Column_2, etc.)
  const usingSyntheticHeaders = headers.some(h => /^Column_\d+$/i.test(h));
  
  let productNameCol, qtyCol, priceCol;
  let skuColumnMap: Record<string, string> = {};
  
  if (usingSyntheticHeaders) {
    // Position-based detection (existing logic)
    console.log('   Using position-based column detection (no headers)');
    const values = headers.map(h => row[h]);
    
    const skuIdx = values.findIndex(v => {
      const s = String(v || '').trim();
      return s.length >= 3 && s.length <= 20 && /[A-Z]/i.test(s) && (/\d/.test(s) || /^M-/.test(s));
    });
    
    const descIdx = values.findIndex(v => {
      const s = String(v || '').trim();
      return s.length > 15 && /\s/.test(s);
    });
    
    const qtyIdx = values.findIndex(v => {
      const s = String(v || '').trim();
      const num = parseFloat(s.replace(/[^0-9.]/g, ''));
      return !isNaN(num) && num > 0 && num < 10000 && s.length <= 6;
    });
    
    const priceIdx = values.findIndex((v, i) => {
      if (i === qtyIdx) return false;
      const s = String(v || '').trim();
      return /\$|\./.test(s) || (parseFloat(s.replace(/[^0-9.]/g, '')) > 10);
    });
    
    if (skuIdx >= 0) skuColumnMap['primary'] = headers[skuIdx];
    if (descIdx >= 0) productNameCol = headers[descIdx];
    if (qtyIdx >= 0) qtyCol = headers[qtyIdx];
    if (priceIdx >= 0) priceCol = headers[priceIdx];
    
    console.log(`   Row ${rowNumber}: SKU=col${skuIdx+1}, Desc=col${descIdx+1}, Qty=col${qtyIdx+1}, Price=col${priceIdx+1}`);
  }
  
  // ======================================================================
  // ENHANCEMENT: Comprehensive column mapping
  // ======================================================================
  
  if (!productNameCol) {
    productNameCol = headers.find(h => 
      /product\s*description|item\s*description|product\s*name/i.test(h)
    ) || headers.find(h => 
      /^description$/i.test(h.trim()) || /^item$/i.test(h.trim()) || /^product$/i.test(h.trim())
    );
  }
  
  // IMPROVED: Detect ALL SKU-like columns (not just first match)
  const oemCol = headers.find(h => /oem|part\s*number|part\s*#|mfg.*part/i.test(h));
  const wholesalerCol = headers.find(h => /wholesaler.*product.*code|wholesaler.*code/i.test(h));
  const staplesSkuCol = headers.find(h => /staples.*sku|staples.*item/i.test(h));
  const depotCol = headers.find(h => /depot.*product.*code|depot.*code/i.test(h));
  const genericSkuCol = headers.find(h => /^sku$/i.test(h.trim()) || /^item.*number$/i.test(h.trim()) || /catalog/i.test(h));
  
  if (oemCol) skuColumnMap['oem'] = oemCol;
  if (wholesalerCol) skuColumnMap['wholesaler'] = wholesalerCol;
  if (staplesSkuCol) skuColumnMap['staples'] = staplesSkuCol;
  if (depotCol) skuColumnMap['depot'] = depotCol;
  if (genericSkuCol) skuColumnMap['generic'] = genericSkuCol;
  
  if (!qtyCol) {
    qtyCol = headers.find(h => {
      const lower = h.toLowerCase().trim();
      if (lower === 'qty' || lower === 'quantity' || lower === 'qty sold' || lower === 'quantity sold') return true;
      if (/sell\s*uom|in\s*sell/i.test(h)) return false;
      return /^qty|^quantity|qty\s*sold|quantity\s*sold/i.test(lower);
    });
  }
  
  if (!priceCol) {
    priceCol = headers.find(h => {
      const lower = h.toLowerCase().trim();
      if (lower === 'sale' || lower === 'price' || lower === 'unit price' || lower === 'unit cost') return true;
      return /(unit\s*price|unit\s*cost|price|cost|amount|sale)/i.test(h) && !/total|extended|supplier\s*id/i.test(h);
    });
  }
  
  // Extract values
  const productName = productNameCol ? row[productNameCol]?.trim() : '';
  
  // ENHANCEMENT: Collect ALL SKU values
  const skuFields: any = {
    all_skus: []
  };
  
  if (oemCol && row[oemCol]) {
    skuFields.oem_number = row[oemCol].trim();
    skuFields.all_skus.push(row[oemCol].trim());
  }
  if (wholesalerCol && row[wholesalerCol]) {
    skuFields.wholesaler_code = row[wholesalerCol].trim();
    skuFields.all_skus.push(row[wholesalerCol].trim());
  }
  if (staplesSkuCol && row[staplesSkuCol]) {
    skuFields.staples_sku = row[staplesSkuCol].trim();
    skuFields.all_skus.push(row[staplesSkuCol].trim());
  }
  if (depotCol && row[depotCol]) {
    skuFields.depot_code = row[depotCol].trim();
    skuFields.all_skus.push(row[depotCol].trim());
  }
  if (genericSkuCol && row[genericSkuCol]) {
    skuFields.primary_sku = row[genericSkuCol].trim();
    if (!skuFields.all_skus.includes(row[genericSkuCol].trim())) {
      skuFields.all_skus.push(row[genericSkuCol].trim());
    }
  }
  
  // Primary SKU priority: OEM > Wholesaler > Staples > Depot > Generic
  const primarySku = skuFields.oem_number || 
                     skuFields.wholesaler_code || 
                     skuFields.staples_sku || 
                     skuFields.depot_code || 
                     skuFields.primary_sku || 
                     (skuFields.all_skus.length > 0 ? skuFields.all_skus[0] : null);
  
  // Remove duplicates from all_skus
  skuFields.all_skus = [...new Set(skuFields.all_skus)];
  
  // IMPROVED: More lenient validation - extract even with missing data
  if (!productName && skuFields.all_skus.length === 0) {
    console.log(`   Row ${rowNumber}: Skipped - no product name or SKU`);
    return null;
  }
  
  // Skip obvious header/metadata rows
  if (productName && productName.length > 0 && 
      /^(account|customer|report|date|total|page|subtotal)/i.test(productName)) {
    console.log(`   Row ${rowNumber}: Skipped - appears to be header/metadata: "${productName}"`);
    return null;
  }
  
  // Extract quantity and price (with fallbacks)
  const quantityStr = qtyCol ? row[qtyCol]?.replace(/[^0-9.]/g, '') : '1';
  const priceStr = priceCol ? row[priceCol]?.replace(/[^0-9.]/g, '') : '0';
  
  let quantity = parseInt(quantityStr) || 1;
  let unitPrice = parseFloat(priceStr) || 0;
  
  // Data quality assessment
  const hasPrice = unitPrice > 0;
  const hasSku = skuFields.all_skus.length > 0;
  const hasDescription = productName.length > 0;
  const hasQuantity = quantity > 0;
  
  // Calculate extraction confidence
  let confidence = 0;
  if (hasDescription) confidence += 0.25;
  if (hasSku) confidence += 0.35;
  if (hasPrice) confidence += 0.25;
  if (hasQuantity) confidence += 0.15;
  
  // Log extraction details
  if (!hasPrice) {
    console.log(`   Row ${rowNumber}: ⚠️ No price found for "${productName || primarySku}" - will use fallback pricing`);
  }
  
  console.log(`   Row ${rowNumber}: ✓ "${productName || primarySku}" | SKUs: ${skuFields.all_skus.length} | Qty: ${quantity} | Price: $${unitPrice.toFixed(2)} | Confidence: ${(confidence*100).toFixed(0)}%`);
  
  // Sanity checks with warnings (but don't reject)
  if (quantity > 10000) {
    console.warn(`   Row ${rowNumber}: ⚠️ Very high quantity ${quantity} for ${productName}`);
  }
  
  if (unitPrice > 100000) {
    console.warn(`   Row ${rowNumber}: ⚠️ Very high price $${unitPrice} for ${productName}`);
  }
  
  // Calculate total
  const MAX_DECIMAL = 99999999.99;
  let totalPrice = quantity * unitPrice;
  if (totalPrice > MAX_DECIMAL) {
    console.warn(`   Row ${rowNumber}: ⚠️ Total ${totalPrice} exceeds max, capping`);
    totalPrice = MAX_DECIMAL;
  }
  
  return {
    rowNumber,
    raw_product_name: productName || 'Unknown Product',
    raw_sku: primarySku,
    raw_description: productName || primarySku || 'No description',
    sku_fields: skuFields,
    quantity,
    unit_price: unitPrice,
    total_price: totalPrice,
    uom: undefined, // Could be extracted if available
    extraction_quality: {
      has_sku: hasSku,
      has_price: hasPrice,
      has_quantity: hasQuantity,
      has_description: hasDescription,
      confidence
    }
  };
}
```

---

### 3. Enhanced `matchSingleProduct` Function

Replace the existing `matchSingleProduct` function (lines 1046-1110) with this improved version:

```typescript
/**
 * ENHANCED: Match a single product through comprehensive multi-tier matching
 */
async function matchSingleProduct(item: any, index: number, total: number) {
  const startTime = Date.now();
  const matchLog: MatchAttempt[] = [];
  
  console.log(`\n  🔍 [${index}/${total}] Matching: "${item.raw_product_name || item.raw_sku}"`);
  if (item.sku_fields && item.sku_fields.all_skus.length > 0) {
    console.log(`     Available SKUs: [${item.sku_fields.all_skus.join(', ')}]`);
  }
  console.log(`     Quantity: ${item.quantity}, Price: $${item.unit_price.toFixed(2)}`);
  console.log(`     Extraction confidence: ${(item.extraction_quality.confidence * 100).toFixed(0)}%`);

  let bestMatch: { product: any; score: number; method: string } | null = null;
  
  // ======================================================================
  // TIER 1: Exact SKU match on ALL available SKU fields
  // ======================================================================
  if (item.sku_fields && item.sku_fields.all_skus && item.sku_fields.all_skus.length > 0) {
    console.log(`     🎯 TIER 1: Trying exact match on ${item.sku_fields.all_skus.length} SKUs...`);
    
    for (let i = 0; i < item.sku_fields.all_skus.length; i++) {
      const sku = item.sku_fields.all_skus[i];
      if (!sku || sku.length < 2) continue;
      
      const match = await exactSKUMatch(sku);
      matchLog.push({
        method: 'exact_sku',
        attempted_value: sku,
        score: match ? match.score : 0,
        product_id: match?.product?.id,
        timestamp: new Date()
      });
      
      if (match) {
        console.log(`        ✅ Exact match on SKU #${i+1} "${sku}": ${match.product.product_name}`);
        bestMatch = match;
        break; // Found exact match, stop searching
      }
    }
    
    if (bestMatch && bestMatch.score === 1.0) {
      const duration = Date.now() - startTime;
      console.log(`     ✅ MATCHED (exact_sku) in ${duration}ms | Score: 1.00`);
      return {
        ...item,
        matched_product: bestMatch.product,
        match_score: bestMatch.score,
        match_method: bestMatch.method,
        match_attempts: matchLog.length,
        match_duration_ms: duration
      };
    }
  }
  
  // ======================================================================
  // TIER 2: Fuzzy SKU match on ALL available SKU fields
  // ======================================================================
  if (item.sku_fields && item.sku_fields.all_skus && item.sku_fields.all_skus.length > 0) {
    console.log(`     🎯 TIER 2: Trying fuzzy match on ${item.sku_fields.all_skus.length} SKUs...`);
    
    for (const sku of item.sku_fields.all_skus) {
      if (!sku || sku.length < 2) continue;
      
      const match = await fuzzySKUMatch(sku);
      matchLog.push({
        method: 'fuzzy_sku',
        attempted_value: sku,
        score: match ? match.score : 0,
        product_id: match?.product?.id,
        timestamp: new Date()
      });
      
      if (match && (!bestMatch || match.score > bestMatch.score)) {
        console.log(`        ✅ Fuzzy match on "${sku}": ${match.product.product_name} (score: ${match.score.toFixed(2)})`);
        bestMatch = match;
      }
    }
    
    if (bestMatch && bestMatch.score >= 0.90) {
      const duration = Date.now() - startTime;
      console.log(`     ✅ MATCHED (fuzzy_sku) in ${duration}ms | Score: ${bestMatch.score.toFixed(2)}`);
      return {
        ...item,
        matched_product: bestMatch.product,
        match_score: bestMatch.score,
        match_method: bestMatch.method,
        match_attempts: matchLog.length,
        match_duration_ms: duration
      };
    }
  }

  // ======================================================================
  // TIER 3: Combined SKU + Description search
  // ======================================================================
  if (item.sku_fields && item.sku_fields.all_skus.length > 0 && item.raw_product_name) {
    console.log(`     🎯 TIER 3: Trying combined SKU + description...`);
    
    for (const sku of item.sku_fields.all_skus) {
      const combinedSearch = `${sku} ${item.raw_product_name}`;
      const match = await fullTextSearch(combinedSearch);
      matchLog.push({
        method: 'combined_search',
        attempted_value: combinedSearch.substring(0, 50),
        score: match ? match.score : 0,
        product_id: match?.product?.id,
        timestamp: new Date()
      });
      
      if (match && (!bestMatch || match.score > bestMatch.score)) {
        console.log(`        ✅ Combined search: ${match.product.product_name} (score: ${match.score.toFixed(2)})`);
        bestMatch = match;
      }
    }
  }

  // ======================================================================
  // TIER 4: Full-text search on product name
  // ======================================================================
  if (!bestMatch || bestMatch.score < 0.85) {
    console.log(`     🎯 TIER 4: Trying full-text search...`);
    
    const match = await fullTextSearch(item.raw_product_name);
    matchLog.push({
      method: 'full_text',
      attempted_value: item.raw_product_name.substring(0, 50),
      score: match ? match.score : 0,
      product_id: match?.product?.id,
      timestamp: new Date()
    });
    
    if (match && (!bestMatch || match.score > bestMatch.score)) {
      console.log(`        ✅ Full-text match: ${match.product.product_name} (score: ${match.score.toFixed(2)})`);
      bestMatch = match;
    }
  }

  // ======================================================================
  // TIER 5: Semantic search
  // ======================================================================
  if (!bestMatch || bestMatch.score < 0.75) {
    console.log(`     🎯 TIER 5: Trying semantic search...`);
    
    const match = await semanticSearch(item.raw_product_name);
    matchLog.push({
      method: 'semantic',
      attempted_value: item.raw_product_name.substring(0, 50),
      score: match ? match.score : 0,
      product_id: match?.product?.id,
      timestamp: new Date()
    });
    
    if (match && (!bestMatch || match.score > bestMatch.score)) {
      console.log(`        ✅ Semantic match: ${match.product.product_name} (score: ${match.score.toFixed(2)})`);
      bestMatch = match;
    }
  }

  // ======================================================================
  // TIER 6: AI Agent (last resort, optional)
  // ======================================================================
  // NOTE: Currently disabled for performance, but can be re-enabled for low-confidence items
  const useAIForLowConfidence = false; // Set to true to enable
  
  if (useAIForLowConfidence && (!bestMatch || bestMatch.score < 0.65)) {
    console.log(`     🤖 TIER 6: Using AI agent (low confidence)...`);
    
    const match = await aiAgentMatch(item);
    matchLog.push({
      method: 'ai_agent',
      attempted_value: item.raw_product_name.substring(0, 50),
      score: match ? match.score : 0,
      product_id: match?.product?.id,
      timestamp: new Date()
    });
    
    if (match && (!bestMatch || match.score > bestMatch.score)) {
      console.log(`        ✅ AI match: ${match.product.product_name} (score: ${match.score.toFixed(2)})`);
      bestMatch = match;
    }
  }

  // ======================================================================
  // Final Result
  // ======================================================================
  const duration = Date.now() - startTime;
  
  if (bestMatch) {
    console.log(`     ✅ MATCHED in ${duration}ms | Method: ${bestMatch.method} | Score: ${bestMatch.score.toFixed(2)}`);
    console.log(`     📦 Product: ${bestMatch.product.product_name} (SKU: ${bestMatch.product.sku})`);
  } else {
    console.log(`     ❌ NO MATCH after ${matchLog.length} attempts in ${duration}ms`);
    console.log(`     💡 Consider manual review for: "${item.raw_product_name}"`);
  }

  return {
    ...item,
    matched_product: bestMatch?.product || null,
    match_score: bestMatch?.score || 0,
    match_method: bestMatch?.method || 'none',
    match_attempts: matchLog.length,
    match_duration_ms: duration,
    match_log: matchLog
  };
}
```

---

### 4. Add Validation Functions

Add these new functions after `calculateSavings`:

```typescript
/**
 * Validate extraction quality
 */
function validateExtraction(items: any[]): {
  quality: 'excellent' | 'good' | 'acceptable' | 'poor';
  metrics: any;
  warnings: string[];
} {
  const warnings: string[] = [];
  
  const totalItems = items.length;
  const itemsWithName = items.filter(i => i.raw_product_name && i.raw_product_name.length > 2).length;
  const itemsWithSku = items.filter(i => i.sku_fields && i.sku_fields.all_skus.length > 0).length;
  const itemsWithPrice = items.filter(i => i.unit_price > 0).length;
  const avgConfidence = items.reduce((sum, i) => sum + (i.extraction_quality?.confidence || 0), 0) / totalItems;
  
  // Assess quality
  let quality: 'excellent' | 'good' | 'acceptable' | 'poor';
  
  if (totalItems === 0) {
    quality = 'poor';
    warnings.push('No items extracted from document');
  } else if (itemsWithName < totalItems * 0.80) {
    quality = 'poor';
    warnings.push(`Only ${itemsWithName}/${totalItems} items have product names`);
  } else if (itemsWithSku < totalItems * 0.30) {
    quality = 'acceptable';
    warnings.push(`Only ${itemsWithSku}/${totalItems} items have SKU numbers`);
  } else if (itemsWithPrice < totalItems * 0.50) {
    quality = 'acceptable';
    warnings.push(`Only ${itemsWithPrice}/${totalItems} items have pricing data`);
  } else if (avgConfidence < 0.60) {
    quality = 'good';
    warnings.push(`Average extraction confidence is ${(avgConfidence * 100).toFixed(0)}%`);
  } else {
    quality = 'excellent';
  }
  
  const metrics = {
    total_items: totalItems,
    items_with_name: itemsWithName,
    items_with_sku: itemsWithSku,
    items_with_price: itemsWithPrice,
    avg_confidence: avgConfidence
  };
  
  console.log(`\n📊 Extraction Quality: ${quality.toUpperCase()}`);
  console.log(`   Total items: ${totalItems}`);
  console.log(`   With names: ${itemsWithName} (${(itemsWithName/totalItems*100).toFixed(0)}%)`);
  console.log(`   With SKUs: ${itemsWithSku} (${(itemsWithSku/totalItems*100).toFixed(0)}%)`);
  console.log(`   With prices: ${itemsWithPrice} (${(itemsWithPrice/totalItems*100).toFixed(0)}%)`);
  console.log(`   Avg confidence: ${(avgConfidence*100).toFixed(0)}%`);
  if (warnings.length > 0) {
    console.log(`   ⚠️ Warnings: ${warnings.join('; ')}`);
  }
  
  return { quality, metrics, warnings };
}

/**
 * Validate matching quality
 */
function validateMatching(matchedItems: any[]): {
  quality: 'excellent' | 'good' | 'acceptable' | 'poor';
  metrics: any;
  warnings: string[];
} {
  const warnings: string[] = [];
  
  const totalItems = matchedItems.length;
  const itemsMatched = matchedItems.filter(i => i.matched_product).length;
  const matchRate = itemsMatched / totalItems;
  
  const exactMatches = matchedItems.filter(i => i.match_method === 'exact_sku').length;
  const fuzzyMatches = matchedItems.filter(i => i.match_method === 'fuzzy_sku').length;
  const semanticMatches = matchedItems.filter(i => i.match_method === 'semantic').length;
  const aiMatches = matchedItems.filter(i => i.match_method === 'ai_suggested').length;
  
  const highConfidence = matchedItems.filter(i => i.match_score >= 0.90).length;
  const mediumConfidence = matchedItems.filter(i => i.match_score >= 0.70 && i.match_score < 0.90).length;
  const lowConfidence = matchedItems.filter(i => i.match_score > 0 && i.match_score < 0.70).length;
  
  const avgScore = matchedItems
    .filter(i => i.match_score > 0)
    .reduce((sum, i) => sum + i.match_score, 0) / itemsMatched || 0;
  
  // Assess quality
  let quality: 'excellent' | 'good' | 'acceptable' | 'poor';
  
  if (matchRate < 0.50) {
    quality = 'poor';
    warnings.push(`Low match rate: ${(matchRate * 100).toFixed(0)}%`);
  } else if (matchRate < 0.75) {
    quality = 'acceptable';
    warnings.push(`Match rate could be better: ${(matchRate * 100).toFixed(0)}%`);
  } else if (highConfidence < itemsMatched * 0.60) {
    quality = 'good';
    warnings.push(`Only ${(highConfidence/itemsMatched*100).toFixed(0)}% high-confidence matches`);
  } else {
    quality = 'excellent';
  }
  
  const metrics = {
    total_items: totalItems,
    items_matched: itemsMatched,
    match_rate: matchRate,
    exact_matches: exactMatches,
    fuzzy_matches: fuzzyMatches,
    semantic_matches: semanticMatches,
    ai_matches: aiMatches,
    high_confidence: highConfidence,
    medium_confidence: mediumConfidence,
    low_confidence: lowConfidence,
    avg_score: avgScore
  };
  
  console.log(`\n📊 Matching Quality: ${quality.toUpperCase()}`);
  console.log(`   Match rate: ${itemsMatched}/${totalItems} (${(matchRate*100).toFixed(0)}%)`);
  console.log(`   Exact SKU: ${exactMatches}, Fuzzy: ${fuzzyMatches}, Semantic: ${semanticMatches}, AI: ${aiMatches}`);
  console.log(`   High conf: ${highConfidence}, Medium: ${mediumConfidence}, Low: ${lowConfidence}`);
  console.log(`   Avg score: ${(avgScore*100).toFixed(0)}%`);
  if (warnings.length > 0) {
    console.log(`   ⚠️ Warnings: ${warnings.join('; ')}`);
  }
  
  return { quality, metrics, warnings };
}
```

---

### 5. Update Main Processing Flow

Update the `processChunk` function (around line 505) to include validation:

```typescript
async function processChunk(
  allItems: any[], 
  chunkIndex: number, 
  chunkSize: number,
  context: ProcessingContext
) {
  const startIdx = chunkIndex * chunkSize;
  const endIdx = Math.min(startIdx + chunkSize, allItems.length);
  const chunk = allItems.slice(startIdx, endIdx);
  
  console.log(`\n📦 Processing chunk ${chunkIndex + 1}: items ${startIdx + 1}-${endIdx} of ${allItems.length}`);
  
  // Validate extraction quality (only on first chunk)
  if (chunkIndex === 0) {
    const extractionValidation = validateExtraction(chunk);
    console.log(`📋 Extraction validation: ${extractionValidation.quality}`);
    
    // Store validation in job metadata
    await supabase
      .from('processing_jobs')
      .update({
        metadata: {
          extraction_validation: extractionValidation,
          updated_at: new Date().toISOString()
        }
      })
      .eq('id', context.jobId);
  }
  
  // Match products in this chunk
  const matchedChunk = await matchProducts(chunk, context.jobId, startIdx);
  
  // Validate matching quality
  const matchingValidation = validateMatching(matchedChunk);
  console.log(`📋 Matching validation: ${matchingValidation.quality}`);
  
  // If quality is poor, log warning
  if (matchingValidation.quality === 'poor') {
    console.warn(`⚠️ Poor matching quality detected - consider manual review`);
  }
}
```

---

## Summary of Key Improvements

### 1. **Comprehensive SKU Extraction**
   - Detects and uses ALL SKU columns (OEM, Wholesaler, Staples, Depot, etc.)
   - Tries matching with each available SKU before giving up

### 2. **Enhanced Logging**
   - Row-by-row extraction details
   - Match attempt tracking for each tier
   - Performance metrics (duration per item)
   - Confidence scoring at each stage

### 3. **Better Data Quality**
   - Extraction confidence scoring
   - Quality validation after extraction and matching
   - Warnings for low-quality data
   - Recommendations for manual review

### 4. **More Lenient Extraction**
   - Extracts items even without prices (uses fallback pricing)
   - Handles various document formats better
   - Better detection of data vs header rows

### 5. **Multi-Tier Matching**
   - 6 tiers of matching (exact, fuzzy, combined, full-text, semantic, AI)
   - Exhaustive search using all available data
   - Clear priority and fallback strategy
   - Detailed logging of each attempt

### 6. **Validation Framework**
   - Extraction quality assessment
   - Matching quality assessment
   - Automatic warnings and recommendations
   - Quality metrics tracked in database

---

## Testing Checklist

- [ ] Test with document containing multiple SKU columns
- [ ] Test with document missing price column
- [ ] Test with document with unusual column names
- [ ] Test with 100+ item document
- [ ] Verify all items are extracted (no false negatives)
- [ ] Verify matching uses all SKU fields
- [ ] Verify quantity calculations are correct
- [ ] Check validation reports for accuracy
- [ ] Review logs for completeness

---

## Next Steps

1. Review this implementation plan
2. Apply changes to `/supabase/functions/process-document/index.ts`
3. Test with sample documents
4. Monitor logs for quality metrics
5. Iterate based on results

