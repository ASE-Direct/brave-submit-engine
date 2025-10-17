# Process-Document Function Column Update

**Date:** October 17, 2025  
**Updated By:** AI Assistant  

## Summary

Updated the `process-document` Edge Function to use the correct column names from the recently updated `master_products` table. This ensures the matching and pricing logic uses the proper CSV-sourced columns.

## Changes Made

### 1. Pricing Logic Updates

**Previous Logic:**
- Used `ase_unit_price` → `unit_price` → `cost` (cascading fallback)

**New Logic:**
- Uses `ase_price` → `partner_list_price` (cascading fallback)
- **Priority 1:** `ase_price` - The ASE Price from the Staples catalog
- **Priority 2:** `partner_list_price` - The Partner List Price from the Staples catalog

### 2. Updated Sections

#### a. `findHigherYieldAlternative()` Function (Lines 147-157)
- Updated to use `ase_price` and `partner_list_price`
- Updated comments to reflect new column names

#### b. Product Filtering for Valid Pricing (Lines 189-193)
- Updated price validation to check `ase_price` and `partner_list_price`

#### c. Cost Per Page Calculation (Line 219)
- Updated ranking logic to use new pricing columns

#### d. Recommended Price Calculation (Lines 269-273)
- Updated to use `ase_price` first, then `partner_list_price`

#### e. Main Savings Calculation (Lines 2908-2918)
- Updated ASE price retrieval logic
- Updated comments and variable names

#### f. Pricing Validation Fallback (Lines 2920-2967)
- Updated cascading fallback logic for user price estimation
- Priority 1: User's price from document
- Priority 2: Catalog `partner_list_price`
- Priority 3: Estimated from `ase_price` * 1.30 (30% markup)
- Last Resort: Skip item if no pricing available

#### g. Interface Documentation (Line 113)
- Updated `HigherYieldRecommendation` interface comment

#### h. Database Query (Lines 491-492)
- Updated SELECT query to fetch `ase_price` and `partner_list_price` instead of old columns

### 3. SKU Matching Logic

**UPDATED** - The SKU matching logic has been corrected to use proper column names:
- `ase_clover_number` (primary ASE Clover Number with -R suffix) - **CORRECTED from `sku`**
- `oem_number` (OEM Number)
- `wholesaler_sku` (Wholesaler SKU)
- `staples_sku` (Staples Part Number) - Used for Staples correlation
- `depot_sku` (Depot code)
- `ase_oem_number` (ASE OEM Number) - **ADDED to search**

The exact match function (Line 2346) now searches all these columns correctly.
Updated in:
- `exactSKUMatch()` function - Line 2346
- `fuzzySKUMatch()` function - Line 2438
- All logging and display references

### 4. Files Modified

- **File:** `supabase/functions/process-document/index.ts`
- **Lines Updated:** Multiple sections throughout the file
- **Linter Status:** ✅ No errors

## Testing Recommendations

1. **Upload a test document** with known products
2. **Verify pricing** appears correctly using the new `ase_price` column
3. **Check fallback logic** by testing with products that only have `partner_list_price`
4. **Validate SKU matching** is working with all cross-reference columns
5. **Review PDF output** to ensure pricing displays correctly

## Column Mapping Reference

| CSV Column Name | master_products Column | Usage in process-document |
|----------------|----------------------|---------------------------|
| ASE Clover Number | `ase_clover_number` | **Primary product identifier** (with -R suffix) |
| ASE Price | `ase_price` | **Primary pricing** (Priority 1) |
| PARTNER LIST PRICE | `partner_list_price` | **Fallback pricing** (Priority 2) |
| OEM Number | `oem_number` | SKU matching/cross-reference |
| ASE OEM Number | `ase_oem_number` | **SKU matching/cross-reference** (ADDED) |
| Wholesaler SKU | `wholesaler_sku` | SKU matching/cross-reference |
| Staples Part Number | `staples_sku` | **SKU matching/Staples correlation** |
| Depot Code | `depot_sku` | SKU matching/cross-reference |
| Clover COGS | `cost` | Cost tracking (not used for offered pricing) |
| Clover Yield | `page_yield` | Yield calculations |

## Impact

✅ **No breaking changes** - All updates are internal column reference changes  
✅ **Improved accuracy** - Now using the exact CSV columns as intended  
✅ **Better pricing logic** - Clear priority: ASE Price → Partner List Price  
✅ **Consistent with data model** - Matches the updated master_products schema  

## Next Steps

1. Deploy the updated `process-document` function to Supabase
2. Test with sample documents to verify functionality
3. Monitor logs for any pricing or matching issues

---

**Status:** ✅ Complete - Ready for testing and deployment

