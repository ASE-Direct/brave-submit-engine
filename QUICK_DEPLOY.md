# ⚡ Quick Deploy - Get Running in 5 Minutes

The fastest path from code to production.

---

## 🚀 Step 1: Set OpenAI Key (30 seconds)

```bash
supabase secrets set OPENAI_API_KEY=sk-proj-your-actual-key-here
```

---

## 🚀 Step 2: Deploy Edge Functions (2 minutes)

```bash
# Deploy all at once
supabase functions deploy
```

Wait for confirmation:
```
✓ Deployed Function submit-document
✓ Deployed Function process-document
✓ Deployed Function get-processing-status
✓ Deployed Function get-results
```

---

## 🚀 Step 3: Verify Deployment (30 seconds)

```bash
# Check functions are live
supabase functions list
```

Should show all 4 functions as **ACTIVE**.

---

## 🚀 Step 4: Test It! (2 minutes)

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Open browser:**
   ```
   http://localhost:5173
   ```

3. **Upload test file:**
   - Use: `sample-data/53 Toner.xlsx - Sheet1.csv`
   - Fill in any test info
   - Complete reCAPTCHA
   - Submit!

4. **Watch the magic:**
   - Processing animation shows real progress
   - Results display actual savings
   - PDF downloads with BAV logo

---

## ✅ Done!

If you see results and can download a PDF, **you're live!** 🎉

---

## 🐛 If Something Goes Wrong

### Functions won't deploy?
```bash
# Check you're linked to the right project
supabase link --project-ref qpiijzpslfjwikigrbol
```

### Processing fails?
```bash
# Check the logs
supabase functions logs process-document --tail
```

### No products matched?
```bash
# Verify catalog is imported
npm run import-catalog
```

---

## 📚 Need More Details?

- Full deployment guide: `DEPLOYMENT_GUIDE.md`
- Testing guide: `TESTING_GUIDE.md`
- Complete checklist: `FINAL_DEPLOYMENT_CHECKLIST.md`

---

**That's it! Now go save some money and the environment! 💰🌱**

