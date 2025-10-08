# Savings Calculation Update

## Changes Made

Updated the `process-document` edge function to properly implement cost-per-page savings calculations as requested.

### Key Improvements

1. **Proper Data Validation**
   - Now checks that matched products have both `unit_price` > 0 AND `page_yield` > 0
   - Skips individual items without required data (but continues processing other items)
   - Logs which items are analyzed vs. skipped with clear reasons

2. **Cost Per Page Calculation**
   - User's cost per page = `user_unit_price / page_yield`
   - Our cost per page = `our_unit_price / page_yield`
   - Compares cost per page to find true savings

3. **Better Logging**
   - Shows detailed cost per page comparison for each item
   - Reports how many items were analyzed vs. skipped
   - Clear summary at the end of processing

4. **Column Mapping Confirmed**
   - `unit_price` = ASE Price (your selling price)
   - `page_yield` = Clover Yield (pages per cartridge)

### Example Log Output

```
📊 Analyzing: HP #962 CYAN INK CART
   User paying: $45.00/unit, Cost/page: $0.0225
   Our price: $38.50/unit (2000 pages), Cost/page: $0.0193
   💰 Savings: $6.50 (14.4%)

⊘ Skipped (missing data): HP 910 MAGENTA INK
   unit_price: ✗, page_yield: ✗

📊 Savings Summary:
   Total items: 100
   Items analyzed: 45
   Items with savings: 32
   Items skipped: 55
   Total savings: $1,234.56
```

## Current Issue: Missing Master Catalog Data

**Problem:** 62% of products (929 out of 1507) in your `master_products` table have NULL values for:
- `page_yield` (NULL)
- `unit_price` (0.00 or NULL)

**Impact:** Savings can only be calculated for the 578 products that have complete data.

### Solution: Update Master Catalog

Your import script (`scripts/import-master-catalog.ts`) expects these CSV columns:
- `ASE Price` → maps to `unit_price`
- `Clover Yield` → maps to `page_yield`

**Steps to fix:**
1. Update your master catalog CSV file to include proper `ASE Price` and `Clover Yield` values
2. Re-import: `npx tsx scripts/import-master-catalog.ts path/to/updated-catalog.csv`
3. This will populate the missing data and enable savings calculations for all products

## Deployment

The updated function code is ready in:
`/Users/alfredreyes/Desktop/Development/brave-submit-engine/supabase/functions/process-document/index.ts`

**To deploy:**

### Option 1: Via Supabase CLI
```bash
npx supabase functions deploy process-document
```

### Option 2: Via Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Navigate to Edge Functions → process-document
3. Copy/paste the updated code from `supabase/functions/process-document/index.ts`
4. Click "Deploy"

## Testing

After deployment:
1. Upload a test document with products that exist in your master catalog
2. Watch the function logs in Supabase Dashboard → Edge Functions → process-document → Logs
3. Look for the detailed cost per page analysis logs
4. Verify the final savings summary shows items analyzed and savings calculated

## Expected Behavior

- ✅ Items WITH unit_price AND page_yield: Savings calculated
- ⊘ Items WITHOUT unit_price OR page_yield: Skipped (logged with reason)
- 📊 Final report shows total items, items analyzed, items with savings, items skipped
- 💰 Cost per page comparison shown in logs for debugging

## Next Steps

1. **Deploy the updated function** (see Deployment section above)
2. **Update master catalog data** with proper ASE Price and Clover Yield values
3. **Re-import master catalog** to populate missing data
4. **Test with real documents** to verify savings calculations work correctly
