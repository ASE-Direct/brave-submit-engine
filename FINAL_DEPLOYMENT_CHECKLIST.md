# 🚀 Final Deployment Checklist

Use this checklist to deploy your complete AI document processing system.

---

## 📋 Pre-Deployment

### 1. Environment Setup
- [ ] Supabase CLI installed (`brew install supabase/tap/supabase`)
- [ ] Supabase project linked (`supabase link --project-ref qpiijzpslfjwikigrbol`)
- [ ] OpenAI API key obtained
- [ ] Node.js dependencies installed (`npm install`)

### 2. Database Setup
- [ ] All migrations applied (check `supabase/migrations/`)
- [ ] Master catalog imported (655 products)
- [ ] Embeddings generated for all products
- [ ] Vector search function created
- [ ] RLS policies enabled

**Verify:**
```sql
-- Check products
SELECT COUNT(*) FROM master_products WHERE active = true;
-- Should return: 655

-- Check embeddings
SELECT COUNT(*) FROM master_products WHERE embedding IS NOT NULL;
-- Should return: 655

-- Check function exists
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'match_products';
-- Should return: match_products
```

---

## 🔐 Secrets Configuration

### Set Required Secrets

```bash
# Set OpenAI API Key (REQUIRED)
supabase secrets set OPENAI_API_KEY=sk-proj-your-key-here

# Verify all secrets are set
supabase secrets list

# Expected output should include:
# - OPENAI_API_KEY
# - RECAPTCHA_SECRET_KEY
# - SUPABASE_URL (auto)
# - SUPABASE_SERVICE_ROLE_KEY (auto)
# - SUPABASE_ANON_KEY (auto)
```

---

## 🚀 Deploy Edge Functions

### Deploy All Functions

```bash
# Option 1: Deploy all at once
supabase functions deploy

# Option 2: Deploy individually
supabase functions deploy submit-document
supabase functions deploy process-document
supabase functions deploy get-processing-status
supabase functions deploy get-results
```

### Verify Deployment

```bash
# List all functions
supabase functions list

# Expected output:
# - submit-document (ACTIVE)
# - process-document (ACTIVE)
# - get-processing-status (ACTIVE)
# - get-results (ACTIVE)

# Test a function
curl -i --location --request GET \
  'https://qpiijzpslfjwikigrbol.supabase.co/functions/v1/get-processing-status?submissionId=test' \
  --header 'Authorization: Bearer YOUR_ANON_KEY'
```

---

## 🌐 Frontend Deployment

### 1. Environment Variables

Ensure `.env` or `.env.local` has:

```bash
VITE_SUPABASE_URL=https://qpiijzpslfjwikigrbol.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_RECAPTCHA_SITE_KEY=your-site-key
```

### 2. Build Frontend

```bash
# Production build
npm run build

# Test build locally
npm run preview
```

### 3. Deploy to Hosting

**If using Netlify/Vercel:**
```bash
# Connect repo and deploy
# Environment variables will be set in dashboard
```

**If using custom hosting:**
```bash
# Upload dist/ folder to server
# Configure web server (nginx/apache)
# Set up SSL certificate
```

---

## ✅ Post-Deployment Testing

### 1. Quick Smoke Test

```bash
# Test edge function endpoints
curl https://qpiijzpslfjwikigrbol.supabase.co/functions/v1/get-processing-status?submissionId=test

# Expected: Should return 404 (normal - job doesn't exist)
# Should NOT return: 500 error or function not found
```

### 2. End-to-End Test

1. Open your deployed frontend URL
2. Submit the test file: `sample-data/53 Toner.xlsx - Sheet1.csv`
3. Fill in test customer info
4. Complete reCAPTCHA
5. Submit and watch processing
6. Verify results display
7. Download and check PDF

**Expected Results:**
- ✅ Processing completes in <60 seconds
- ✅ Results show real savings data
- ✅ PDF has BAV branding
- ✅ No console errors

### 3. Database Verification

```sql
-- Check recent submission
SELECT * FROM document_submissions 
ORDER BY created_at DESC LIMIT 1;

-- Check processing job
SELECT * FROM processing_jobs 
ORDER BY created_at DESC LIMIT 1;

-- Check report generated
SELECT * FROM savings_reports 
ORDER BY created_at DESC LIMIT 1;
```

---

## 📊 Monitoring Setup

### 1. Edge Function Logging

```bash
# Monitor in real-time
supabase functions logs process-document --tail

# Or via Supabase Dashboard:
# Project → Edge Functions → Logs
```

### 2. Database Monitoring

Set up alerts for:
- Failed processing jobs
- High error rates
- Slow processing times
- Storage usage

### 3. Cost Monitoring

Track:
- OpenAI API usage
- Supabase storage
- Edge function invocations

**Set budgets/alerts in:**
- OpenAI Dashboard → Usage
- Supabase Dashboard → Settings → Billing

---

## 🔒 Security Review

### Pre-Launch Security Checklist

- [ ] RLS policies enabled on all tables
- [ ] Anon key only has read access where needed
- [ ] Service role key never exposed to frontend
- [ ] CORS configured properly
- [ ] File upload size limits enforced
- [ ] reCAPTCHA verified on all submissions
- [ ] Sensitive data encrypted
- [ ] API keys stored in secrets (not code)
- [ ] Rate limiting configured
- [ ] Input validation on all user data

### Test Security

```bash
# Try to access without authentication
curl https://your-api.supabase.co/rest/v1/master_products

# Should return: authentication required
```

---

## 🎯 Performance Optimization

### Before Launch

1. **Test with Large Files**
   - Upload 500+ item orders
   - Verify no timeouts
   - Check processing time

2. **Optimize if Needed**
   - Increase batch sizes
   - Reduce API calls
   - Add caching

3. **Set Alerts**
   - Slow processing (>2 min)
   - High error rate (>5%)
   - High costs (>$1 per doc)

---

## 📝 Documentation Review

### Ensure These Docs Are Updated

- [ ] `README.md` - Overview and setup
- [ ] `DEPLOYMENT_GUIDE.md` - Deployment instructions
- [ ] `TESTING_GUIDE.md` - Testing procedures
- [ ] `AI_PROCESSING_PLAN.md` - Architecture docs
- [ ] `CURRENT_SUPABASE_SCHEMA.md` - Database schema

### Create Additional Docs (Optional)

- [ ] User guide for customers
- [ ] API documentation
- [ ] Maintenance procedures
- [ ] Troubleshooting guide

---

## 🚨 Rollback Plan

In case something goes wrong:

### 1. Revert Edge Functions

```bash
# List versions
supabase functions list-versions process-document

# Revert to previous version
supabase functions deploy process-document --version <previous-version>
```

### 2. Revert Database

```bash
# List migrations
supabase migration list

# If needed, write down migration
# (Migrations can't be auto-reverted easily)
```

### 3. Emergency Disable

```bash
# Disable processing by setting secret
supabase secrets set PROCESSING_DISABLED=true

# Then update edge function to check this flag
```

---

## 🎉 Launch Checklist

### Right Before Launch

- [ ] All tests passed
- [ ] Security reviewed
- [ ] Performance acceptable
- [ ] Monitoring configured
- [ ] Documentation complete
- [ ] Team trained
- [ ] Support plan ready
- [ ] Rollback plan documented

### Launch Day

1. **Morning:**
   - [ ] Final test on production
   - [ ] Verify monitoring is active
   - [ ] Team on standby

2. **Launch:**
   - [ ] Announce to stakeholders
   - [ ] Monitor first 10 submissions closely
   - [ ] Check logs for errors
   - [ ] Verify reports generating

3. **First Week:**
   - [ ] Daily monitoring
   - [ ] Collect user feedback
   - [ ] Track key metrics
   - [ ] Fix critical issues immediately

---

## 📈 Success Metrics

Track these KPIs:

| Metric | Target | Current |
|--------|--------|---------|
| Success Rate | >95% | ___ |
| Avg Processing Time | <90s | ___ |
| Match Accuracy | >90% | ___ |
| Cost per Document | <$0.25 | ___ |
| Customer Satisfaction | >4.5/5 | ___ |

---

## 🎊 You're Ready to Launch!

### Final Steps:

1. ✅ Complete all checklist items above
2. ✅ Run final end-to-end test
3. ✅ Brief your team
4. ✅ Set up monitoring dashboard
5. 🚀 **DEPLOY!**

### After Launch:

- Monitor closely for first 24 hours
- Respond to issues quickly
- Gather feedback
- Iterate and improve

---

## 📞 Support Contacts

**Technical Issues:**
- Supabase: https://supabase.com/support
- OpenAI: https://help.openai.com

**Project Team:**
- Developer: [Your Name]
- Project Manager: [Name]
- Support: [Email]

---

## 🎯 Next Steps After Launch

1. **Week 1:** Monitor and stabilize
2. **Week 2:** Gather user feedback
3. **Month 1:** Optimize based on data
4. **Month 2:** Add requested features
5. **Ongoing:** Regular updates and maintenance

---

**Congratulations on building an amazing AI-powered system! 🎉**

The future of cost savings and environmental impact starts now! 🌱💰

