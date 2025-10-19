# SKU Aggregation Fix - Summary

## Issue Identified
The system was aggregating by **ASE recommended SKUs** instead of **customer input SKUs**, causing confusion and incorrect unique item counts.

### Example of the Problem:
**Customer's CSV had 3 separate products:**
- Row 2: HEWCF237A (1,549 units)
- Row 3: CF237A-R (1,811 units)  
- Row 4: CF237AX-R (318 units)

**Old System Behavior (WRONG):**
1. HEWCF237A → matched and recommended CF237A-R
2. CF237A-R → already CF237A-R
3. Combined these into ONE line in SKU Summary: CF237A-R with 3,360 units ❌

**This was wrong because:**
- Customer submitted 3 different products (not duplicates)
- Should show 3 separate lines in SKU Summary
- Should only aggregate if customer has the SAME product multiple times

---

## What Was Fixed

### 1. SKU Summary Report Aggregation
**Changed from:** Aggregating by `ase_sku` (our recommendation)  
**Changed to:** Aggregating by `input_sku` (customer's product identifier)

**Now Shows:**
- Customer's input SKU (what they ordered)
- → ASE SKU (what we're recommending)
- Quantity, costs, savings

**Example Output:**
```
Input SKU       → ASE SKU      Qty   Current $    BAV $      Savings $
HEWCF237A      → CF237A-R     1549  $319,381    $171,273    $148,108
CF237A-R       → CF237A-R     1811  $217,473    $200,242    $17,223
CF237AX-R      → CF237A-R     318   $62,518     $35,174     $27,344
```

### 2. Unique SKU Count in Executive Summary
**Changed from:** Counting unique ASE recommended SKUs  
**Changed to:** Counting unique customer input SKUs

**Internal Report:**
- Now shows: "OEM SKUs (36 unique)" based on customer's document
- Previously showed: "OEM SKUs (23 unique)" based on our recommendations

**Customer Report:**
- Removed hardcoded "19 unique" ❌
- Now dynamically calculates: "(36 unique)" based on actual input ✓

### 3. Updated Labels
**SKU Summary Report subtitle:**
- Old: "Aggregated by Unique ASE SKU"
- New: "Aggregated by Customer Input SKU"

---

## How Aggregation Now Works

### Scenario 1: Hospital with Multiple Locations (True Duplicates)
**Customer's CSV:**
- Row 5: HEWCF237A, Location A, 100 units
- Row 20: HEWCF237A, Location B, 50 units

**Result:** 
- SKU Summary shows ONE line for HEWCF237A with 150 total units ✓
- Full Line Item section shows both rows separately ✓

### Scenario 2: Similar But Different Products (Not Duplicates)
**Customer's CSV:**
- Row 2: HEWCF237A (HP OEM standard)
- Row 3: CF237A-R (ASE remanufactured)
- Row 4: CF237AX-R (ASE remanufactured XL)

**Result:**
- SKU Summary shows THREE separate lines ✓
- Each with their own quantity, cost, and recommended ASE product ✓

---

## Files Modified

1. **`supabase/functions/shared/pdf-generator-internal.ts`**
   - Updated `SkuSummary` interface to track both input_sku and ase_sku
   - Changed aggregation key from `item.ase_sku` to `item.current_product.sku`
   - Updated unique SKU calculation to use customer input SKUs
   - Modified table headers and display to show both SKUs
   - Changed subtitle text

2. **`supabase/functions/shared/pdf-generator-customer.ts`**
   - Fixed hardcoded "19 unique" to dynamic calculation
   - Updated unique SKU calculation to use customer input SKUs

---

## What Still Needs to Be Fixed

### Issue: 37 Items Instead of 36
The system is still extracting 37 items from a document with 36 data rows. This causes the "total line items analyzed" count to be off by 1.

**Next Step:** Investigate document parsing logic in `parseDocument()` and `extractProductInfo()` functions to identify why an extra item is being extracted.

---

## Testing

To verify the fix works correctly:

1. **Upload the test CSV** (`CHS_Item_Usage_YTD_Test (1).csv`)
2. **Check Internal Report Executive Summary:**
   - Should show "OEM SKUs (36 unique)" ✓
   - Total line items: Should be 36 (currently 37 - separate fix needed)
3. **Check SKU Summary Report (Page 3+):**
   - Should show 36 separate rows (one for each input SKU)
   - Each row should show: Input SKU → ASE SKU → quantities and savings
   - No aggregation unless duplicate input SKUs exist
4. **Check Full Line Item Details:**
   - Should show all 36 items separately
   - Same as always (no change here)

---

## Deployment Status

✅ **DEPLOYED** - October 19, 2025

The corrected logic is now live and will take effect on the next document upload.

