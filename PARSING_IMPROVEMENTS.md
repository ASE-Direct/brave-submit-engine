# Document Parsing Improvements

## Date: October 19, 2025

## Issues Fixed

### 1. "Unknown Product" Showing in Line Item Details

**Problem:** 
In the internal PDF report's "Full Line Item Details" section, items were showing as "Unknown Product" when the uploaded document had a SKU but no explicit product name/description.

**Example:**
```
Current:
Unknown Product
1549 × $206.19 = $319,381.28
```

**Solution:**
Updated the `extractProductInfo()` function to use the SKU as the product name when no product name is available:

```typescript
// If we have a SKU but no product name, use the SKU as the product name
if (finalProductName === 'Unknown Product' && primarySku) {
  finalProductName = primarySku;
}
```

**Now displays:**
```
Current:
HEWCF237A
1549 × $206.19 = $319,381.28
```

---

### 2. Header Row Being Counted as Data Row

**Problem:**
The system was counting 37 items when the CSV had only 36 data rows (1 header row + 36 data rows = 37 total rows).

**Example CSV:**
```csv
,Quanitity,Price,Total,          <- Row 1 (Header)
HEWCF237A,"1,549",$206.19,...    <- Row 2 (Data)
CF237A-R,"1,811",$120.08,...     <- Row 3 (Data)
...
L0H24A-R,17,$330.49,...          <- Row 37 (Data)
```

**Solution:**
Added a secondary header detection filter during row processing. This catches header rows that might slip through the initial detection by checking if multiple columns contain header keywords:

```typescript
// Skip rows that look like headers (all columns contain header-like terms)
const rowValues = Object.values(row);
const allValuesLowerCase = rowValues.map(v => String(v).toLowerCase());
const headerKeywords = ['sku', 'quantity', 'qty', 'price', 'cost', 'amount', 'total', 'product', 'description', 'item'];
const headerMatchCount = allValuesLowerCase.filter(val => 
  headerKeywords.some(keyword => val.includes(keyword) && val.length < 30)
).length;

// If more than half the columns contain header keywords, it's probably a header row that slipped through
if (headerMatchCount >= Math.min(3, Math.ceil(rowValues.length / 2))) {
  console.log(`   Row ${rowIdx + 1}: Skipping - appears to be a header row (${headerMatchCount} header-like values)`);
  continue;
}
```

**Result:** System now correctly reports 36 items from the CSV.

---

## Files Modified

**`supabase/functions/process-document/index.ts`**

1. **Lines 1706-1709**: Added SKU-to-product-name fallback
   - If `finalProductName === 'Unknown Product'` and we have a `primarySku`, use the SKU as the name

2. **Lines 953-965**: Added secondary header row detection
   - Checks for rows with multiple header-like keywords
   - Skips these rows even if they made it past initial header detection
   - Prevents header rows from being counted as data

3. **Line 975**: Improved logging to show header row position

---

## Impact

### Improved Data Quality
- ✅ Product names now show actual SKUs from user's document
- ✅ No more "Unknown Product" labels in reports
- ✅ Accurate item counts (no header rows counted as data)

### Better User Experience
- ✅ Internal reports show recognizable SKU numbers
- ✅ Sales team can easily identify products
- ✅ Correct totals match user's document

### More Reliable Parsing
- ✅ Handles CSVs with varying header formats
- ✅ Double-checks for header rows at multiple stages
- ✅ Better logging for debugging parsing issues

---

## Testing Checklist

- [x] CSV with SKUs but no product names shows SKUs in report
- [x] CSV with header row doesn't count header as a data row
- [x] Item counts match actual data rows in CSV
- [x] Internal PDF displays correct product identifiers
- [x] Logging shows correct header detection

---

## Deployment

✅ Deployed successfully on October 19, 2025
- Project: qpiijzpslfjwikigrbol
- Function: process-document

