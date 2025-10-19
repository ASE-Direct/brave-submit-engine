# Data Mismatch Fix - Results Page vs PDF Reports

## Issue Identified
The results page was showing **$0 savings** (0.0%) while the PDF reports correctly showed **$259,934 savings** (33.9%). This was a critical data mapping issue.

## Root Cause

When restructuring the executive summary, the data structure changed but the database save function (`saveFinalReport`) was not updated to map the new structure to the database columns.

### Old Structure (before restructure):
```typescript
{
  total_current_cost: number,
  total_optimized_cost: number,
  total_cost_savings: number,
  savings_percentage: number
}
```

### New Structure (after restructure):
```typescript
{
  savings_breakdown: {
    oem_total_spend: number,      // Replaces total_current_cost
    bav_total_spend: number,       // Replaces total_optimized_cost
    total_savings: number,         // Replaces total_cost_savings
    savings_percentage: number
  }
}
```

### The Problem:
```typescript
// ❌ OLD CODE (trying to access non-existent fields)
total_current_cost: savingsAnalysis.summary.total_current_cost,    // undefined!
total_optimized_cost: savingsAnalysis.summary.total_optimized_cost, // undefined!
total_cost_savings: savingsAnalysis.summary.total_cost_savings,     // undefined!
```

This caused `0` values to be saved to the database, which the frontend then displayed as $0 savings.

## The Fix

Updated `saveFinalReport()` function to properly map new structure to database columns:

```typescript
// ✅ NEW CODE (correctly maps from new structure)
total_current_cost: capValue(savingsAnalysis.summary.savings_breakdown.oem_total_spend),
total_optimized_cost: capValue(savingsAnalysis.summary.savings_breakdown.bav_total_spend),
total_cost_savings: capValue(savingsAnalysis.summary.savings_breakdown.total_savings),
savings_percentage: Math.min(savingsAnalysis.summary.savings_breakdown.savings_percentage || 0, 100),
```

## Data Flow (Fixed)

1. **Processing**: `calculateSavings()` → Creates new structure with `savings_breakdown`
2. **PDF Generation**: PDF generators correctly read from `savings_breakdown` ✓
3. **Database Save**: `saveFinalReport()` now maps `savings_breakdown` → database columns ✓
4. **Frontend Display**: Reads from database columns ✓

## Files Modified

**`supabase/functions/process-document/index.ts`**
- Lines 3633-3674: Updated `saveFinalReport()` function
- Added mapping comments for clarity
- Updated error logging to use new structure

## Deployment

✅ Deployed successfully on October 19, 2025
- All new processing will now correctly save and display savings data
- Results page will match PDF reports

## Testing

To verify the fix:
1. ✅ Upload a new document
2. ✅ Check results page shows correct savings amount
3. ✅ View PDF report and confirm amounts match
4. ✅ Check internal PDF report also matches

---

## Important Note

**Database columns remain unchanged** for backwards compatibility:
- `total_current_cost`
- `total_optimized_cost`
- `total_cost_savings`
- `savings_percentage`

We simply map our new internal structure to these existing columns when saving to the database.

