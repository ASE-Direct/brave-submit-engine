# Quick Deploy Guide: Compatibility Guardrails

**Time Required:** 15-20 minutes  
**Difficulty:** Easy  
**Impact:** Eliminates all incompatible product recommendations

---

## 🚀 Deployment Steps (Copy & Paste)

### **1. Apply Database Migration (5 minutes)**

```bash
cd /Users/alfredreyes/Desktop/Development/brave-submit-engine

# Option A: Using Supabase SQL Editor (Recommended for first time)
# 1. Open https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql/new
# 2. Copy contents of: supabase/migrations/add_compatibility_fields.sql
# 3. Paste and click "Run"

# Option B: Using Supabase CLI
supabase db push
```

**Expected Output:**
```
✓ Added compatibility_group column
✓ Added model_pattern column  
✓ Created 2 new indexes
✓ Updated 8 Brother TN products
```

---

### **2. Fix Missing Color Types (3 minutes)**

```bash
# Make sure your .env file has these variables set:
# VITE_SUPABASE_URL=your-supabase-url
# VITE_SUPABASE_ANON_KEY=your-anon-key

# Run the script
npx tsx scripts/fix-missing-color-types.ts
```

**Expected Output:**
```
✅ Successfully updated ~155 products
⚠️  15 products need manual review
```

---

### **3. Populate Compatibility Groups (3 minutes)**

```bash
# Run the script
npx tsx scripts/populate-compatibility-groups.ts
```

**Expected Output:**
```
✅ Applied 50+ known compatibility groups
✅ Auto-detected 500+ model patterns
⚠️  10 overly broad families identified
```

---

### **4. Deploy Updated Edge Function (2 minutes)**

```bash
# Deploy process-document function
supabase functions deploy process-document

# Verify deployment
supabase functions list
```

**Expected Output:**
```
┌──────────────────┬────────────┬──────────┐
│ Function         │ Version    │ Status   │
├──────────────────┼────────────┼──────────┤
│ process-document │ v2025.10.9 │ deployed │
└──────────────────┴────────────┴──────────┘
```

---

### **5. Test with Sample Data (5 minutes)**

**Test Case 1: Brother TN730 (Should recommend TN750)**
```
Upload file with: Brother TN730, Qty 80, Price $30.71
Expected: Recommends Brother TN750 (same brand, higher yield)
✅ PASS if recommendation is TN750
❌ FAIL if recommends Xerox or different brand
```

**Test Case 2: Mixed Brands (Should NOT cross-recommend)**
```
Upload file with:
- Brother TN221C (Cyan)
- HP 64 (Black)
- Canon PG-245 (Black)

Expected: Each gets same-brand recommendation or "no change"
✅ PASS if no cross-brand suggestions
❌ FAIL if Brother → Xerox, HP → Canon, etc.
```

**Test Case 3: Color Cartridges (Should NOT mix colors)**
```
Upload file with: Brother TN221M (Magenta)
Expected: Recommends Brother TN225M (Magenta) or "no change"
✅ PASS if color matches
❌ FAIL if suggests Black/Cyan/Yellow
```

---

## ✅ Success Checklist

After deployment, verify:

- [ ] Database migration applied (check in Supabase Table Editor)
- [ ] New columns visible: `compatibility_group`, `model_pattern`
- [ ] Color types populated (check products that were NULL)
- [ ] Edge function deployed (check Functions dashboard)
- [ ] Test case 1 passes (valid upgrade works)
- [ ] Test case 2 passes (no cross-brand)
- [ ] Test case 3 passes (no color mixing)

---

## 🔍 Monitoring & Verification

### **Check Edge Function Logs**

Look for these messages (they're good!):
```
✅ "⊘ BLOCKED: Cross-brand recommendation (BROTHER → XEROX)"
✅ "⊘ BLOCKED: Color mismatch (cyan → black)"
✅ "⊘ BLOCKED: Unrealistic yield improvement"
```

These mean the guardrails are working!

### **Check Recommendations Table**

```sql
-- Should be ZERO rows
SELECT 
  mp_current.brand as current_brand,
  mp_rec.brand as recommended_brand,
  mp_current.color_type as current_color,
  mp_rec.color_type as recommended_color
FROM order_items_extracted oie
JOIN master_products mp_current ON oie.matched_product_id = mp_current.id
JOIN master_products mp_rec ON oie.recommended_product_id = mp_rec.id
WHERE mp_current.brand != mp_rec.brand
  OR mp_current.color_type != mp_rec.color_type
  AND oie.created_at > NOW() - INTERVAL '1 day';
```

If this returns any rows, something is wrong!

---

## 🚨 Troubleshooting

### **Problem: Migration fails**
```
Solution: Check that all previous migrations are applied first
Run: supabase db reset (WARNING: Dev only!)
```

### **Problem: Scripts fail to connect to Supabase**
```
Solution: Verify .env file has correct variables
cat .env | grep VITE_SUPABASE

Expected:
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

### **Problem: Edge function deployment fails**
```
Solution: Check Supabase CLI is logged in
Run: supabase login
```

### **Problem: Still seeing cross-brand recommendations**
```
Solution: Verify Edge function deployed successfully
Check: supabase functions list
Re-deploy: supabase functions deploy process-document --no-verify-jwt
```

---

## 📊 Quick Stats to Verify

Run these queries in Supabase SQL Editor:

```sql
-- 1. Check new columns populated
SELECT 
  COUNT(*) as total,
  COUNT(compatibility_group) as has_compat_group,
  COUNT(model_pattern) as has_model_pattern,
  COUNT(color_type) as has_color
FROM master_products
WHERE active = true;

-- Expected: 
-- total: ~1500
-- has_color: ~1480 (up from 1334)
-- has_compat_group: ~50-100
-- has_model_pattern: ~500-800

-- 2. Check guardrails working (run after first test)
SELECT 
  COUNT(*) as blocked_recommendations
FROM order_items_extracted
WHERE recommendation_type IS NULL
  AND matched_product_id IS NOT NULL
  AND created_at > NOW() - INTERVAL '1 hour';

-- Some nulls are expected now (guardrails blocking incompatible suggestions)
```

---

## 🎯 What's Different Now?

**Before:**
```
Brother TN221C (Cyan) → Xerox 106R03584 (Black) ❌
HP 64 (Black ink) → Xerox toner ❌
Brother TN730 → Xerox 106R03584 (different brand) ❌
```

**After:**
```
Brother TN221C (Cyan) → Brother TN225C (Cyan) ✅ or "no change"
HP 64 (Black ink) → HP 64XL (Black ink) ✅ or "no change"
Brother TN730 → Brother TN750 (same brand/color/category) ✅
```

---

## 📞 Need Help?

1. **Check logs:** `supabase functions logs process-document`
2. **Review docs:** See `COMPATIBILITY_GUARDRAILS_IMPLEMENTATION.md`
3. **Test queries:** Run SQL verification queries above
4. **Roll back:** Previous version still in git history

---

## ⏱️ Estimated Timeline

| Task | Time | Can Skip? |
|------|------|-----------|
| 1. Database migration | 5 min | ❌ Required |
| 2. Fix color types | 3 min | ⚠️ Recommended |
| 3. Populate groups | 3 min | ⚠️ Recommended |
| 4. Deploy function | 2 min | ❌ Required |
| 5. Test | 5 min | ⚠️ Highly recommended |
| **TOTAL** | **18 min** | |

---

## ✨ You're Done!

After completing these steps:
- ✅ No more cross-brand recommendations
- ✅ No more color mismatches  
- ✅ No more category confusion
- ✅ Valid upgrades still work
- ✅ Better data quality overall

**Happy deploying! 🚀**

