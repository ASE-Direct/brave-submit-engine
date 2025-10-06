# Quick Start Implementation Guide

This guide will walk you through implementing the AI document processing system step by step.

---

## ✅ Prerequisites Checklist

Before starting, ensure you have:

- [ ] Supabase project set up ✓ (already done)
- [ ] OpenAI API key ([get one here](https://platform.openai.com/api-keys))
- [ ] Master product catalog file (Excel/CSV)
- [ ] Sample test order files for testing
- [ ] Node.js 18+ installed
- [ ] Supabase CLI installed

---

## 📋 Step-by-Step Implementation

### Step 1: Set Up OpenAI API Key

1. Get your OpenAI API key from [platform.openai.com](https://platform.openai.com)
2. Add it to Supabase secrets:

```bash
# Using Supabase CLI
supabase secrets set OPENAI_API_KEY=sk-proj-your-key-here

# Or add in Supabase Dashboard:
# Project Settings > Edge Functions > Secrets
```

### Step 2: Create Database Schema

Run the migrations to create necessary tables:

```bash
# This will create the SQL files in supabase/migrations/
```

We need to create these tables:
1. `processing_jobs` - Track document processing status
2. `master_products` - Store product catalog
3. `order_items_extracted` - Store extracted order items
4. `savings_reports` - Store generated reports

**I'll help you create these migrations in the next step.**

### Step 3: Enable pgvector Extension

For semantic search capabilities:

```sql
-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;
```

### Step 4: Install Required Packages

For local development/testing:

```bash
npm install --save-dev @types/node
```

Edge Functions will use Deno (no npm install needed there).

### Step 5: Create OpenAI Agents

You have two options:

#### Option A: Create Agents Programmatically (Recommended)

Create a setup script:

```typescript
// scripts/setup-agents.ts
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function setupAgents() {
  // Create Parser Agent
  const parserAgent = await openai.beta.assistants.create({
    name: "Document Parser Agent",
    model: "gpt-4o",
    instructions: "See OPENAI_AGENTS_GUIDE.md for full instructions",
    tools: [{ type: "code_interpreter" }]
  });
  
  console.log('Parser Agent ID:', parserAgent.id);
  
  // Create Matching Agent
  const matchingAgent = await openai.beta.assistants.create({
    name: "Product Matching Agent",
    model: "gpt-4o",
    instructions: "See OPENAI_AGENTS_GUIDE.md for full instructions"
  });
  
  console.log('Matching Agent ID:', matchingAgent.id);
  
  // Create Savings Agent
  const savingsAgent = await openai.beta.assistants.create({
    name: "Savings Analysis Agent",
    model: "gpt-4o",
    instructions: "See OPENAI_AGENTS_GUIDE.md for full instructions"
  });
  
  console.log('Savings Agent ID:', savingsAgent.id);
  
  console.log('\n📝 Add these to your Supabase secrets:');
  console.log(`PARSER_AGENT_ID=${parserAgent.id}`);
  console.log(`MATCHER_AGENT_ID=${matchingAgent.id}`);
  console.log(`ANALYST_AGENT_ID=${savingsAgent.id}`);
}

setupAgents().catch(console.error);
```

Run it:
```bash
npx tsx scripts/setup-agents.ts
```

Then add the agent IDs to Supabase secrets:
```bash
supabase secrets set PARSER_AGENT_ID=asst_xxx
supabase secrets set MATCHER_AGENT_ID=asst_yyy
supabase secrets set ANALYST_AGENT_ID=asst_zzz
```

#### Option B: Create Agents via OpenAI Playground

1. Go to [platform.openai.com/assistants](https://platform.openai.com/assistants)
2. Create three assistants with the specifications from `OPENAI_AGENTS_GUIDE.md`
3. Copy the assistant IDs
4. Add to Supabase secrets

### Step 6: Import Master Product Catalog

Create and run the import script:

```bash
# Create the script (I'll provide this)
npx tsx scripts/import-catalog.ts data/master-catalog.xlsx
```

This will:
- Parse your product catalog
- Generate embeddings for each product
- Insert into `master_products` table

### Step 7: Create Edge Functions

We need to create:

1. **process-document** - Main processing pipeline
2. **get-processing-status** - Check processing status
3. **get-results** - Fetch results

```bash
# Create the functions (I'll provide the code)
supabase functions new process-document
supabase functions new get-processing-status
supabase functions new get-results
```

### Step 8: Deploy Edge Functions

```bash
# Deploy all functions
supabase functions deploy process-document
supabase functions deploy get-processing-status
supabase functions deploy get-results
```

### Step 9: Update Frontend

Update these files to integrate with the new backend:

1. `src/components/ProcessingAnimation.tsx` - Poll for real status
2. `src/components/ResultsPage.tsx` - Display real results
3. `src/lib/api/processing.ts` - API client functions (new file)

### Step 10: Test End-to-End

1. Start your dev server:
```bash
npm run dev
```

2. Upload a test order file
3. Monitor the processing in Supabase Dashboard
4. View the generated report

---

## 🧪 Testing Strategy

### Phase 1: Unit Tests

Test each component independently:

```typescript
// Test document parsing
const parsed = await parseDocument('test-order.xlsx');
console.log('Extracted items:', parsed.items);

// Test product matching
const match = await matchProduct({
  product_name: "HP 64 Black Ink",
  sku: "N9J90AN"
});
console.log('Match confidence:', match.confidence);

// Test savings calculation
const savings = calculateCostSavings({
  current: { quantity: 5, unit_price: 29.99 },
  recommended: { unit_price: 39.99, page_yield: 600 }
});
console.log('Savings:', savings);
```

### Phase 2: Integration Tests

Test the full pipeline with sample files:

1. **Simple order** (5 items, all exact matches)
2. **Complex order** (50+ items, mixed brands)
3. **Messy data** (missing SKUs, typos)
4. **Edge cases** (empty file, wrong format)

### Phase 3: User Acceptance Testing

1. Upload real customer orders
2. Verify accuracy of matches (>95% target)
3. Check savings calculations
4. Review report quality

---

## 📊 Monitoring & Debugging

### View Processing Jobs

```sql
-- Check recent jobs
SELECT 
  id,
  status,
  progress,
  current_step,
  created_at,
  completed_at
FROM processing_jobs
ORDER BY created_at DESC
LIMIT 10;
```

### View Extracted Data

```sql
-- See what was extracted from a job
SELECT 
  raw_product_name,
  quantity,
  unit_price,
  matched_product_id,
  confidence_score
FROM order_items_extracted
WHERE processing_job_id = 'your-job-id';
```

### Check Savings Reports

```sql
-- View generated reports
SELECT 
  id,
  total_cost_savings,
  cartridges_saved,
  co2_reduced_pounds,
  pdf_url
FROM savings_reports
ORDER BY created_at DESC;
```

### Debug OpenAI Agents

```typescript
// View thread messages to see agent reasoning
const messages = await openai.beta.threads.messages.list(threadId);
console.log(messages.data);
```

---

## 💰 Cost Estimation & Optimization

### Expected Costs (per document)

| Component | Cost | Notes |
|-----------|------|-------|
| GPT-4o API calls | $0.10-0.25 | 3-4 agents x 1-2 calls each |
| Embeddings | $0.001-0.01 | For product matching |
| Storage | $0.001 | File + report storage |
| **Total** | **$0.11-0.26** | Per document processed |

### Optimization Tips

1. **Use gpt-4o-mini for simple tasks** - 60% cheaper
2. **Cache product embeddings** - Generate once, use many times
3. **Batch similar items** - Process similar products together
4. **Implement early matching** - Try exact match before AI

Example optimized flow:
```typescript
// Try cheap methods first
const exactMatch = await findExactSKUMatch(item.sku);
if (exactMatch && exactMatch.confidence > 0.95) {
  return exactMatch; // No AI needed - FREE
}

// Try embeddings (cheap)
const semanticMatch = await findSemanticMatch(item);
if (semanticMatch && semanticMatch.confidence > 0.85) {
  return semanticMatch; // $0.0001
}

// Only use expensive AI as fallback
return await aiMatch(item); // $0.05-0.10
```

This can reduce costs from $0.25 to $0.05 per document.

---

## 🚀 Going to Production

### Pre-Launch Checklist

- [ ] All migrations applied
- [ ] Master catalog imported with embeddings
- [ ] OpenAI agents created and tested
- [ ] Edge functions deployed
- [ ] Environment variables set
- [ ] RLS policies enabled
- [ ] Error handling implemented
- [ ] Logging configured
- [ ] Rate limiting enabled
- [ ] Backup strategy in place

### Production Settings

```bash
# Recommended Supabase secrets for production
OPENAI_API_KEY=sk-proj-...
PARSER_AGENT_ID=asst_...
MATCHER_AGENT_ID=asst_...
ANALYST_AGENT_ID=asst_...
RECAPTCHA_SECRET_KEY=...

# Optional
OPENAI_ORG_ID=org-...
SENTRY_DSN=... # For error tracking
SLACK_WEBHOOK=... # For notifications
```

### Monitoring Setup

1. **OpenAI Dashboard** - Monitor API usage and costs
2. **Supabase Logs** - Track edge function performance
3. **Database Queries** - Monitor processing_jobs table
4. **Alerts** - Set up notifications for failures

---

## 🆘 Troubleshooting

### Common Issues

#### Issue: "Agent failed with status: failed"

**Solution:** Check OpenAI logs and thread messages
```typescript
const run = await openai.beta.threads.runs.retrieve(threadId, runId);
console.log('Error:', run.last_error);
```

#### Issue: "No products matched"

**Solution:** 
1. Verify master catalog is imported
2. Check embeddings are generated
3. Review product naming consistency

#### Issue: "Processing stuck at 40%"

**Solution:**
1. Check edge function logs
2. Verify OpenAI API key is valid
3. Check for rate limiting

#### Issue: "Incorrect savings calculations"

**Solution:**
1. Verify product page_yield data
2. Check bulk pricing thresholds
3. Review calculation logic

---

## 📚 Next Steps

1. **Review all documentation:**
   - `AI_PROCESSING_PLAN.md` - Overall architecture
   - `DATA_STRUCTURES.md` - Data formats
   - `OPENAI_AGENTS_GUIDE.md` - Agent implementation

2. **Prepare your data:**
   - Master product catalog
   - Sample test orders
   - Expected savings calculations for validation

3. **Set up OpenAI account:**
   - Create API key
   - Set up billing
   - Consider usage limits

4. **Let me know when ready:**
   - I'll help create the database migrations
   - I'll build the edge functions
   - I'll update the frontend components

---

## 🎯 Success Criteria

Before considering the implementation complete, verify:

- [ ] Can upload Excel/CSV files successfully
- [ ] Processing completes in <2 minutes
- [ ] 95%+ products matched correctly
- [ ] Savings calculations are accurate
- [ ] PDF report generates properly
- [ ] Frontend shows real-time progress
- [ ] Results display correctly
- [ ] Error handling works
- [ ] Cost per document < $0.30

---

## 💬 Questions?

If you need clarification on any step or run into issues:

1. Check the detailed guides in this repository
2. Review the code comments
3. Check Supabase/OpenAI logs
4. Ask for help!

---

**Ready to start? Let's begin with Step 1! 🚀**

