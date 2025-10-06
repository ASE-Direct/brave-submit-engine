# Deployment Guide - AI Document Processing System

This guide will help you deploy all the edge functions and test the system end-to-end.

---

## 🚀 Quick Deployment

### Step 1: Install Supabase CLI (if not already installed)

```bash
brew install supabase/tap/supabase
```

### Step 2: Link to your Supabase project

```bash
supabase link --project-ref qpiijzpslfjwikigrbol
```

### Step 3: Set Edge Function Environment Variables

You need to set these secrets in your Supabase dashboard or via CLI:

```bash
# Set OpenAI API Key
supabase secrets set OPENAI_API_KEY=sk-proj-your-openai-key-here

# Confirm other keys are set (should already be set)
supabase secrets list
```

**Required secrets:**
- `OPENAI_API_KEY` - Your OpenAI API key
- `RECAPTCHA_SECRET_KEY` - Your reCAPTCHA secret (already set)
- `SUPABASE_URL` - Auto-set by Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Auto-set by Supabase
- `SUPABASE_ANON_KEY` - Auto-set by Supabase

### Step 4: Deploy Edge Functions

```bash
# Deploy all functions at once
supabase functions deploy process-document
supabase functions deploy get-processing-status
supabase functions deploy get-results

# Or deploy all at once:
supabase functions deploy
```

### Step 5: Test the System

Upload one of your sample files through the UI!

---

## 📁 Edge Functions Overview

### 1. `submit-document` ✅
**Status:** Already deployed  
**Purpose:** Handles initial document upload and storage  
**Returns:** `{ success: true, submissionId: "uuid" }`

### 2. `process-document` 🆕
**Purpose:** Main processing pipeline
- Parses CSV/Excel files
- Matches products to catalog
- Calculates savings
- Generates report

**Triggered by:** Frontend after successful upload  
**Returns:** `{ success: true, processing_job_id: "uuid" }`

### 3. `get-processing-status` 🆕
**Purpose:** Returns current processing status for polling  
**Endpoint:** `GET /get-processing-status?submissionId=uuid`  
**Returns:**
```json
{
  "id": "job-uuid",
  "status": "processing",
  "progress": 65,
  "current_step": "Matching products...",
  "started_at": "2025-10-05T10:30:00Z"
}
```

### 4. `get-results` 🆕
**Purpose:** Returns final results and report  
**Endpoint:** `GET /get-results?submissionId=uuid`  
**Returns:**
```json
{
  "summary": {
    "total_cost_savings": 5000,
    "cartridges_saved": 50,
    "co2_reduced_pounds": 125
  },
  "report": {
    "pdf_url": "https://...",
    "created_at": "2025-10-05T10:32:00Z"
  }
}
```

---

## 🧪 Testing Strategy

### Test 1: Simple Order (5-10 items)

```bash
# Use: sample-data/53 Toner.xlsx - Sheet1.csv
# Expected: Fast processing (<60s), high match rate
```

1. Upload file through UI
2. Watch processing animation
3. Verify results show:
   - Matched products
   - Cost savings
   - Environmental impact

### Test 2: Complex Order (50+ items)

```bash
# Use: sample-data/Surgery Partners 2023...csv
# Expected: Longer processing (~90-120s), mixed results
```

### Test 3: Edge Cases

Test with:
- Empty CSV
- Malformed data
- Unknown products
- Very large files

---

## 🔍 Monitoring & Debugging

### View Edge Function Logs

```bash
# View logs for specific function
supabase functions logs process-document --tail

# View all function logs
supabase functions logs --tail
```

### Check Database

```sql
-- Check recent processing jobs
SELECT 
  pj.id,
  pj.status,
  pj.progress,
  pj.current_step,
  pj.error_message,
  ds.company,
  pj.created_at
FROM processing_jobs pj
JOIN document_submissions ds ON pj.submission_id = ds.id
ORDER BY pj.created_at DESC
LIMIT 10;

-- Check completed reports
SELECT 
  id,
  company_name,
  total_cost_savings,
  cartridges_saved,
  co2_reduced_pounds,
  created_at
FROM savings_reports
ORDER BY created_at DESC
LIMIT 5;
```

### Common Issues

#### Issue: "Function timeout"
**Solution:** Edge functions have a 5-minute timeout. If processing takes longer:
1. Reduce batch size in matching
2. Increase rate limiting delays
3. Split into multiple functions

#### Issue: "No products matched"
**Solution:**
1. Check master_products table has data
2. Verify embeddings are generated
3. Check search_vector is populated

#### Issue: "OpenAI rate limit"
**Solution:**
1. Add delays between API calls
2. Use retry logic with exponential backoff
3. Consider upgrading OpenAI tier

---

## 📊 Performance Monitoring

### Expected Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Processing Time | <90s | Testing needed |
| Match Accuracy | >95% | Testing needed |
| Error Rate | <2% | Testing needed |
| Cost per Document | <$0.25 | ~$0.10-0.15 |

### Monitoring Commands

```bash
# Count processing jobs by status
supabase db query "
  SELECT status, COUNT(*) 
  FROM processing_jobs 
  GROUP BY status
"

# Average processing time
supabase db query "
  SELECT 
    AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_seconds
  FROM processing_jobs
  WHERE status = 'completed'
    AND completed_at IS NOT NULL
"
```

---

## 🔐 Security Checklist

Before going live:

- [ ] OpenAI API key is stored in Supabase secrets
- [ ] RLS policies are enabled on all tables
- [ ] CORS headers are properly configured
- [ ] File upload size limits are enforced
- [ ] reCAPTCHA is working and verified
- [ ] Sensitive data is encrypted
- [ ] Rate limiting is enabled
- [ ] Error messages don't expose internal details

---

## 🌐 Frontend Deployment

The frontend is already deployed on your platform. After deploying edge functions:

1. Verify environment variables in frontend:
   ```
   VITE_SUPABASE_URL=https://qpiijzpslfjwikigrbol.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

2. Build and deploy:
   ```bash
   npm run build
   ```

3. Test end-to-end flow

---

## 📝 Post-Deployment Tasks

### 1. Monitor Initial Usage

Watch the first 10-20 submissions carefully:
- Check processing times
- Verify match accuracy
- Review error rates
- Monitor costs

### 2. Gather Feedback

From first users:
- Are savings calculations accurate?
- Is the report clear and useful?
- Any confusing or missing information?
- Performance acceptable?

### 3. Optimize

Based on data:
- Tune matching thresholds
- Adjust calculation formulas
- Improve error messages
- Optimize performance bottlenecks

### 4. Scale

As volume increases:
- Monitor OpenAI costs
- Watch database performance
- Consider caching strategies
- Implement queue system if needed

---

## 🆘 Support & Maintenance

### Regular Tasks

**Daily:**
- Check error logs
- Monitor processing failures
- Review unusual results

**Weekly:**
- Update product catalog
- Review cost reports
- Analyze match accuracy
- Update documentation

**Monthly:**
- Review OpenAI usage/costs
- Optimize slow queries
- Update embeddings if catalog changed significantly
- Review and improve prompts

### Getting Help

1. **Check logs:** `supabase functions logs --tail`
2. **Check database:** Run monitoring queries above
3. **Test locally:** Use sample files to reproduce issues
4. **Review docs:** Check all .md files in project

---

## ✅ Deployment Checklist

- [ ] All migrations applied
- [ ] Master catalog imported (655+ products)
- [ ] OpenAI API key set in secrets
- [ ] Edge functions deployed:
  - [ ] process-document
  - [ ] get-processing-status
  - [ ] get-results
- [ ] Frontend environment variables set
- [ ] Frontend built and deployed
- [ ] Test with sample file successful
- [ ] Monitoring dashboard set up
- [ ] Error alerting configured
- [ ] Documentation reviewed

---

## 🎉 You're Ready!

Once all edge functions are deployed and tested, your system is live and ready to process customer orders!

**Next:** Upload a test file and watch the magic happen! 🚀

