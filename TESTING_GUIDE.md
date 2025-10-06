# 🧪 Testing Guide - End-to-End Testing

This guide will walk you through testing the complete AI document processing system.

---

## 🚀 Pre-Testing Checklist

Before testing, ensure:

- [ ] All edge functions are deployed
- [ ] OpenAI API key is set in Supabase secrets
- [ ] Master catalog is imported (655 products)
- [ ] Frontend is running (`npm run dev`)

---

## 📋 Test Scenarios

### Test 1: Small Order (Quick Test)
**File:** `sample-data/53 Toner.xlsx - Sheet1.csv`  
**Expected Duration:** 30-60 seconds  
**Expected Results:**
- ✅ High match rate (>90%)
- ✅ Some savings opportunities
- ✅ PDF generated with BAV branding

**Steps:**
1. Open the app in your browser
2. Fill in customer information:
   - First Name: `Test`
   - Last Name: `User`
   - Company: `Test Company`
   - Email: `test@example.com`
   - Phone: `555-1234`
3. Upload `53 Toner.xlsx - Sheet1.csv`
4. Complete reCAPTCHA
5. Click "Submit Order for Analysis"
6. **Watch the processing animation** (real-time progress)
7. **View the results page** with actual savings data
8. **Download the PDF** with your BAV logo

**What to Check:**
- ✓ Progress updates smoothly
- ✓ No errors in browser console
- ✓ Results show real numbers (not placeholders)
- ✓ PDF has BAV branding
- ✓ Environmental metrics calculated

---

### Test 2: Medium Order
**File:** `sample-data/Item Usage Submitted - Toner Report - 2.1.25-8.27.25.xlsx - All Toner Orders.csv`  
**Expected Duration:** 60-90 seconds  
**Expected Results:**
- ✅ Good match rate (>85%)
- ✅ Multiple savings opportunities
- ✅ Detailed breakdown

**Steps:**
1. Submit with different customer info
2. Upload the medium-sized file
3. Monitor processing
4. Review detailed breakdown in results

**What to Check:**
- ✓ Handles more items gracefully
- ✓ Savings calculations accurate
- ✓ Cartridge savings calculated
- ✓ Recommendations make sense

---

### Test 3: Large Order
**File:** `sample-data/Surgery Partners 2023 item usage staples pricing.xlsx - Sheet1.csv`  
**Expected Duration:** 90-120 seconds  
**Expected Results:**
- ✅ Decent match rate (>75%)
- ✅ Various recommendation types
- ✓ Some products may not match (expected)

**Steps:**
1. Submit the large file
2. **Patience required** - this will take up to 2 minutes
3. Check results for variety of matches

**What to Check:**
- ✓ Doesn't timeout
- ✓ Progress updates throughout
- ✓ Handles unmatched products gracefully
- ✓ Shows "No match found" for unknown items

---

## 🔍 Monitoring During Tests

### 1. **Browser Developer Console**

Open DevTools and watch for:

```javascript
// Expected logs:
"Submission successful: {submissionId: '...'}"
"Processing document..."
// Watch progress updates
// Check for errors
```

### 2. **Supabase Edge Function Logs**

In a terminal, run:

```bash
# Watch process-document logs
supabase functions logs process-document --tail

# You should see:
# 🚀 Starting document processing: <jobId>
# 📄 Parsing document: <filename>
# 📊 Found columns: [...]
# ✅ Parsed N items
# 🔍 Matching products to catalog...
# 💰 Calculating savings...
# 📄 Generating PDF report...
# ✅ Processing complete: <jobId>
```

### 3. **Database Status**

Query the database during processing:

```sql
-- Check processing job status
SELECT 
  id,
  status,
  progress,
  current_step,
  created_at,
  updated_at
FROM processing_jobs
ORDER BY created_at DESC
LIMIT 5;

-- Check extracted items
SELECT 
  raw_product_name,
  matched_product_id,
  match_score,
  match_method,
  cost_savings
FROM order_items_extracted
WHERE processing_job_id = '<your-job-id>'
ORDER BY cost_savings DESC NULLS LAST;

-- Check final report
SELECT 
  company_name,
  total_cost_savings,
  cartridges_saved,
  co2_reduced_pounds,
  total_items,
  items_with_savings
FROM savings_reports
ORDER BY created_at DESC
LIMIT 1;
```

---

## ✅ Success Criteria

### Processing
- [ ] All test files process without errors
- [ ] Progress updates smoothly (0% → 100%)
- [ ] Processing completes in reasonable time (<2 min)
- [ ] No timeout errors

### Matching
- [ ] Products are matched to catalog
- [ ] Match scores are reasonable (>0.7)
- [ ] Multiple matching strategies used (exact, fuzzy, semantic)
- [ ] Unmatched products handled gracefully

### Calculations
- [ ] Cost savings calculated correctly
- [ ] Percentage savings make sense (>0%, <50%)
- [ ] Environmental metrics calculated
- [ ] Cartridge counts logical

### PDF Report
- [ ] PDF generates successfully
- [ ] BAV logo/branding present
- [ ] Customer info displayed
- [ ] Summary metrics accurate
- [ ] Detailed breakdown clear
- [ ] Contact info included
- [ ] Professional appearance

### Frontend
- [ ] No console errors
- [ ] Loading states work
- [ ] Results display real data
- [ ] PDF preview works
- [ ] Download button works
- [ ] Confetti animation triggers 🎉

---

## 🐛 Common Issues & Solutions

### Issue: "Processing timeout"
**Cause:** File too large or too many API calls  
**Solution:** 
- Check edge function logs for specific error
- Verify OpenAI API key is valid
- Check if rate limited

### Issue: "No products matched"
**Cause:** Product names don't match catalog  
**Solution:**
- Check what's in the CSV vs master catalog
- Verify embeddings were generated
- Test semantic search manually

### Issue: "PDF generation failed"
**Cause:** PDF library error or storage issue  
**Solution:**
- Check edge function logs for error
- Verify storage bucket is public
- Check if jsPDF dependency loaded

### Issue: Frontend shows stale data
**Cause:** Caching or state not updating  
**Solution:**
- Hard refresh browser (Cmd+Shift+R)
- Check API responses in Network tab
- Verify submissionId is passed correctly

---

## 📊 Performance Benchmarks

Based on initial tests, expected performance:

| File Size | Items | Expected Time | API Calls | Est. Cost |
|-----------|-------|--------------|-----------|-----------|
| Small (<100KB) | 10-50 | 30-60s | 50-100 | $0.05-0.10 |
| Medium (<500KB) | 50-200 | 60-90s | 100-300 | $0.10-0.15 |
| Large (<2MB) | 200-500 | 90-120s | 300-700 | $0.15-0.25 |

**Cost Breakdown:**
- OpenAI Embeddings: ~$0.0001 per item
- OpenAI Text (if needed): ~$0.001 per item
- Supabase: Free tier sufficient
- Edge Functions: Free tier sufficient

---

## 🎯 Test Results Template

Use this to document your test results:

```markdown
### Test Date: [DATE]

**Test 1: Small Order**
- File: 53 Toner.xlsx
- Duration: ____ seconds
- Items Processed: ____
- Items Matched: ____
- Total Savings: $____
- Cartridges Saved: ____
- Status: ✅ / ❌
- Notes: ___________

**Test 2: Medium Order**
- File: Item Usage Submitted
- Duration: ____ seconds
- Items Processed: ____
- Items Matched: ____
- Total Savings: $____
- Cartridges Saved: ____
- Status: ✅ / ❌
- Notes: ___________

**Test 3: Large Order**
- File: Surgery Partners
- Duration: ____ seconds
- Items Processed: ____
- Items Matched: ____
- Total Savings: $____
- Cartridges Saved: ____
- Status: ✅ / ❌
- Notes: ___________

**Overall Results:**
- All tests passed: ✅ / ❌
- Ready for production: ✅ / ❌
- Issues found: ___________
- Next steps: ___________
```

---

## 🚦 Ready to Test!

1. **Start the frontend:**
   ```bash
   npm run dev
   ```

2. **Open in browser:**
   ```
   http://localhost:5173
   ```

3. **Begin with Test 1** (small order)

4. **Watch the logs:**
   ```bash
   supabase functions logs process-document --tail
   ```

5. **Document your results** using the template above

---

## 📞 Need Help?

If you encounter issues:

1. Check edge function logs
2. Check browser console
3. Query database for details
4. Review error messages
5. Check DEPLOYMENT_GUIDE.md troubleshooting section

**Good luck! Let's see those savings! 💰🌱**

