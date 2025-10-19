# Complete Processing Analysis

## Overview
Analyzed the most recent processing run to understand exactly how items are being categorized and counted.

## Source Document
**File:** `CHS_Item_Usage_YTD_Test (1).csv`
**Expected Data Rows:** 36 (rows 2-37, row 1 is headers)

## What the System Processed
**Actual Items Extracted:** 37 (ONE EXTRA ITEM)
**Breakdown Storage:** 37 items stored in database

---

## ISSUE #1: Extra Item Extraction (37 vs 36)

### CSV Structure:
- Row 1: Headers (`,Quanitity,Price,Total,`)
- Rows 2-37: Data (36 items total)

### Problem:
The system extracted 37 items instead of 36, indicating one of the following:
1. The header row is being extracted as a data row
2. An empty row is being counted
3. A row is being duplicated during processing

### Where This Happens:
**File:** `supabase/functions/process-document/index.ts`
**Function:** `parseDocument()` and `extractProductInfo()`

**Key Logic:**
```typescript
// Line 879-887: Parse rows starting after the header
for (let i = headerIndex + 1; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim()) continue;  // Skip empty lines
  
  const values = parseCSVLine(line);
  rows.push(values);
}
```

**Then:**
```typescript
// Line 938-947: Extract product information from rows
for (let rowIdx = 0; rowIdx < rowObjects.length; rowIdx++) {
  const row = rowObjects[rowIdx];
  const item = extractProductInfo(row, normalizedHeaders, rowIdx + 1, detectedCols);
  if (item) {
    items.push(item);
  }
}
```

The `extractProductInfo` function has validation to skip rows but may be too lenient:
- Line 1665-1667: Only rejects if BOTH product name is "Unknown Product" AND no SKUs found
- Line 1670-1673: Only skips obvious header/metadata rows

**Root Cause:** Likely extracting the header row or an empty trailing row as valid data.

---

## ISSUE #2: Categorization Logic

### Current Categorization Results:
From database query of most recent run:
- **Remanufactured:** 15 items (products with `ase_clover_number` ending in `-R`)
- **OEM:** 0 items (products with only `ase_oem_number`)
- **No Match:** 22 items (no match found OR no savings possible)

### Fixed Categorization Logic (Recently Deployed):
**File:** `supabase/functions/process-document/index.ts`
**Function:** `determineMatchType()` (lines 372-388)

```typescript
function determineMatchType(matchedProduct: any, hasSavings: boolean): 'remanufactured' | 'oem' | 'no_match' {
  if (!hasSavings) {
    return 'no_match';
  }
  
  // If product has ase_clover_number, it's remanufactured
  if (matchedProduct.ase_clover_number) {
    return 'remanufactured';
  }
  
  // If product only has ase_oem_number, it's OEM
  if (matchedProduct.ase_oem_number) {
    return 'oem';
  }
  
  return 'no_match';
}
```

### How Items Are Categorized:
Applied at 3 key points in `calculateSavings()`:

1. **Higher-yield recommendations** (lines 3135-3148)
2. **Basic savings when higher-yield exists** (lines 3199-3207)
3. **Basic savings with no higher-yield option** (lines 3276-3282)

---

## ISSUE #3: Unique SKU Count Discrepancy

### Internal Report Shows:
"OEM SKUs (23 unique)"

### Customer Report Shows:
"OEM SKUs (19 unique)" - **HARDCODED VALUE**

### How Unique SKUs Are Calculated:
**File:** `supabase/functions/shared/pdf-generator-internal.ts` (lines 145-150)
```typescript
const uniqueSkus = new Set(
  data.breakdown
    .filter(item => item.ase_sku)
    .map(item => item.ase_sku)
);
// Then: uniqueSkus.size = 23
```

**File:** `supabase/functions/shared/pdf-generator-customer.ts` (line 144)
```typescript
doc.text('OEM SKUs (19 unique)', margin, yPos);  // ❌ HARDCODED!
```

### Actual Unique ASE SKUs from Report:
From the PDF SKU Summary Report, I can see these unique SKUs:
1. CF237A-R (remanufactured)
2. CF226A-R (remanufactured)
3. CF280A-R (remanufactured)
4. CF287A-R (remanufactured)
5. W1480A-R (remanufactured)
6. CC364A-R (remanufactured)
7. CF258A-R (remanufactured)
8. W1470A-R (remanufactured)
9. CF258X-R (remanufactured)
10. W1480X-R (remanufactured)
11. W1470X-R (remanufactured)
12. CF226X-R (remanufactured)
13. TBD (no match - multiple items)
14. CF281AJ (no savings)
15. CE390AJ (no savings)
16. CE390A-R (no savings)
17. CE390XC (no savings)
18. W2020XC (no savings)
19. W2022XC (no savings)
20. CF237XDS (no savings)
21. W2021XC (no savings)
22. W2023XC (no savings)
23. CC364XC (no savings)
24. W2100A (no savings)

**Total Unique ASE SKUs:** 24 (including TBD)
**Unique with actual SKUs:** 23

This matches the internal report's "23 unique".

---

## ISSUE #4: SKU Aggregation in Internal Report

### How Aggregation Works:
**File:** `supabase/functions/shared/pdf-generator-internal.ts` (lines 424-447)

```typescript
const skuMap = new Map<string, SkuSummary>();

data.breakdown.forEach(item => {
  const sku = item.ase_sku || 'TBD';
  
  if (!skuMap.has(sku)) {
    skuMap.set(sku, {
      ase_sku: sku,
      total_quantity: 0,
      total_current_cost: 0,
      total_recommended_cost: 0,
      total_savings: 0,
      line_count: 0
    });
  }
  
  const summary = skuMap.get(sku)!;
  summary.line_count++;
  summary.total_quantity += item.current_product.quantity;
  summary.total_current_cost += item.current_product.total_cost;
  summary.total_recommended_cost += item.recommended_product?.total_cost || item.current_product.total_cost;
  summary.total_savings += item.savings?.cost_savings || 0;
});
```

### Example: CF237A-R Aggregation
From PDF:
- **Quantity:** 3,360
- **Current $:** $536,853.19
- **BAV $:** $371,515.20
- **Savings $:** $165,337.99

From CSV input:
- Row 2: HEWCF237A - 1,549 @ $206.19 = $319,381.28
- Row 3: CF237A-R - 1,811 @ $120.08 = $217,472.68
- Row 4: CF237AX-R - 318 @ $196.60 = $62,518.07 *(This might not be aggregated)*

**Issue:** CF237AX-R might be treated as a different SKU than CF237A-R in the matching logic.

---

## ISSUE #5: Executive Summary Calculations

### Displayed Values (from PDF):
- Total line items analyzed: (37) ❌ Should be 36
- OEM SKUs (23 unique): ✓ Correct calculation
- Remanufactured SKUs (15 unique): ❌ Should be "15 line items with savings" not "15 unique"
- OEM Like Kind Exchange (0 unique): ✓ Correct (no OEM-only products with savings)
- No Match OEM (22 items): ✓ Correct count

### How Counts Are Determined:
**File:** `supabase/functions/process-document/index.ts`

**Counters initialized** (lines 2893-2895):
```typescript
let remanufacturedCount = 0;
let oemCount = 0;
let noMatchCount = 0;
```

**Incremented during savings calculation:**
- When `determineMatchType()` returns 'remanufactured' → `remanufacturedCount++`
- When `determineMatchType()` returns 'oem' → `oemCount++`
- When no match or no savings → `noMatchCount++`

**Problem:** The label "Remanufactured SKUs (15 unique)" is misleading.
- It's actually counting 15 LINE ITEMS with remanufactured recommendations
- Not 15 UNIQUE SKUs (which would be 12 based on the SKU summary)

---

## Complete Flow Diagram

```
CSV Upload
    ↓
1. parseDocument() - Detects header, extracts rows
    ├─ findDataHeader() - Finds row 1 as header
    ├─ Processes rows 2-37 (should be 36 data rows)
    └─ ❌ ISSUE: Extracting 37 items instead of 36
    ↓
2. extractProductInfo() - For each row
    ├─ Extracts SKU, price, quantity
    ├─ Validation (too lenient?)
    └─ Creates item object
    ↓
3. matchProducts() - For each extracted item
    ├─ Searches master_products table
    ├─ Tries multiple SKU fields
    └─ Returns matched_product (with ase_clover_number or ase_oem_number)
    ↓
4. calculateSavings() - For each matched item
    ├─ Calculates basic savings (same product, better price)
    ├─ Checks for higher-yield alternative
    ├─ Calls determineMatchType(matchedProduct, hasSavings)
    │   ├─ Has ase_clover_number + savings? → 'remanufactured' ✓
    │   ├─ Has ase_oem_number only + savings? → 'oem' ✓
    │   └─ No savings or no match? → 'no_match' ✓
    ├─ Increments appropriate counter
    └─ Adds to breakdown array
    ↓
5. generateReport() - Creates PDFs
    ├─ Customer PDF
    │   └─ ❌ HARDCODED "OEM SKUs (19 unique)"
    └─ Internal PDF
        ├─ Calculates uniqueSkus.size → 23 ✓
        ├─ Shows remanufactured_count → 15 (line items, not unique)
        └─ Aggregates by ase_sku for SKU Summary
```

---

## Summary of Issues

### Issue #1: 37 Items Instead of 36 ❌ CRITICAL
**Location:** Document parsing/extraction
**Impact:** All counts are off by 1
**Fix Needed:** Review header detection and row extraction logic

### Issue #2: Hardcoded "19 unique" in Customer PDF ❌
**Location:** `pdf-generator-customer.ts` line 144
**Impact:** Inaccurate customer-facing report
**Fix Needed:** Use `uniqueSkus.size` instead of hardcoded value

### Issue #3: Misleading "Remanufactured SKUs (X unique)" Label ⚠️
**Location:** Both PDF generators
**Impact:** Confusion - shows line item count, not unique SKU count
**Fix Needed:** Either:
- Calculate actual unique remanufactured SKUs
- Change label to "(X line items)"

### Issue #4: No Verification of SKU Aggregation Logic ⚠️
**Location:** Internal PDF generator SKU summary
**Impact:** Need to verify CF237A-R vs CF237AX-R aggregation
**Fix Needed:** Review how related SKUs are grouped

### Issue #5: Categorization Now Working Correctly ✓
**Location:** `determineMatchType()` function
**Impact:** Correctly identifies remanufactured vs OEM vs no_match
**Status:** FIXED in latest deployment

---

## Recommended Fixes (Priority Order)

1. **Fix header/row extraction** to get exactly 36 items
2. **Fix hardcoded "19 unique"** in customer PDF
3. **Clarify labels** in executive summary (unique SKUs vs line items)
4. **Add logging** to track which rows are extracted and why
5. **Add validation** to match total items count against source document rows

