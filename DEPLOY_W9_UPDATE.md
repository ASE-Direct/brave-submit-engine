# Deploy W9 PDF Insertion Update

## Quick Deployment Steps

### 1. Review Changes
```bash
git status
git diff supabase/functions/shared/pdf-generator-customer.ts
```

### 2. Add Files to Git
```bash
git add supabase/functions/shared/pdf-generator-customer.ts
git add supabase/functions/shared/w9Data.ts
git add W9_PDF_INSERTION.md
git add public/W9.10.9.23.pdf
```

### 3. Commit Changes
```bash
git commit -m "Add W9 form to customer savings report before contact page"
```

### 4. Deploy to Supabase Edge Functions
```bash
# Deploy the process-document function (which imports pdf-generator-customer)
supabase functions deploy process-document

# Or deploy all functions
supabase functions deploy
```

### 5. Test the Deployment
1. Go to the BAV Savings Challenge website
2. Upload a sample CSV file
3. Wait for processing to complete
4. Download/view the generated customer report PDF
5. Verify the W9 form appears as page 3 (before the contact page)

## What Changed

- **Modified:** `pdf-generator-customer.ts` - Added W9 merging logic
- **Added:** `w9Data.ts` - Base64-encoded W9 PDF (319KB)
- **Added:** `W9_PDF_INSERTION.md` - Implementation documentation
- **Added:** `public/W9.10.9.23.pdf` - Original W9 PDF file

## Expected Result

Customer reports will now be 4 pages:
1. Executive Summary
2. Environmental Impact
3. **W9 Form** ← NEW
4. Contact Information

## Rollback Plan (if needed)

If issues occur, revert the commit:
```bash
git revert HEAD
git push origin main
supabase functions deploy process-document
```

## Notes

- No database changes required
- No environment variable changes needed
- Backward compatible (fails gracefully if W9 merge fails)
- Internal sales reports are unchanged (3+ pages)

---

**Ready to deploy!** 🚀

