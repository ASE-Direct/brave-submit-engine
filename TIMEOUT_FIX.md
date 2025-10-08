# Timeout & Chunking Fix

## Problem Identified

Your document processing got stuck at **59% (1500/1519 items)** with status:
- **"Matched 1500/1519 products - continuing..."**
- Last update: 02:51:04 (stopped after ~66 seconds)
- The final chunk (items 1501-1519) never processed

### Root Causes

1. **Chunk Size Too Large**: 300 items per chunk was too much when combined with:
   - Semantic search (OpenAI embeddings)
   - Database queries
   - Savings calculations
   
2. **No Error Handling**: The self-invocation for the next chunk had no retry logic or error checking

3. **Fire-and-Forget Invocation**: Used `.catch()` instead of proper `await`, so failures were silently ignored

## Solutions Implemented

### 1. Reduced Chunk Size
```typescript
const CHUNK_SIZE = 200; // Down from 300
```
- Safer for function timeout limits (150 seconds)
- More chunks but more reliable
- 1519 items = 8 chunks instead of 6

### 2. Added Retry Logic
```typescript
async function invokeSelf(context: ProcessingContext, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Attempt invocation
      const response = await fetch(...)
      if (!response.ok) throw new Error(...)
      return result;
    } catch (error) {
      // Exponential backoff: 2s, 4s, 8s
      if (attempt === retries) {
        // Update job status to failed
        throw error;
      }
      await delay(Math.pow(2, attempt) * 1000);
    }
  }
}
```

### 3. Proper Error Handling
- Now properly `awaits` the self-invocation
- Updates job status to 'failed' if retries exhaust
- Logs detailed error messages for debugging

### 4. Better Logging
```typescript
console.log(`🔄 Invoking next chunk (attempt ${attempt}/${retries})...`);
console.log(`✅ Successfully invoked next chunk`);
console.error(`❌ Self-invocation attempt ${attempt} failed:`, error);
```

## Testing

### Next Steps
1. Upload a test document with 1000+ items
2. Monitor the logs in Supabase Dashboard
3. Verify all chunks complete successfully
4. Check that savings calculations run

### Expected Behavior
- Chunks of 200 items each
- Retry up to 3 times on failure
- Clear log messages for each chunk
- Proper error reporting if anything fails

## Chunk Processing Flow

```
Upload 1519 items
│
├─ Chunk 1: Items 1-200 (Progress: 15-20%)
├─ Chunk 2: Items 201-400 (Progress: 20-30%)
├─ Chunk 3: Items 401-600 (Progress: 30-40%)
├─ Chunk 4: Items 601-800 (Progress: 40-50%)
├─ Chunk 5: Items 801-1000 (Progress: 50-60%)
├─ Chunk 6: Items 1001-1200 (Progress: 60-70%)
├─ Chunk 7: Items 1201-1400 (Progress: 70-80%)
└─ Chunk 8: Items 1401-1519 (Progress: 80-85%)
   │
   └─ Savings Calculation (Progress: 85-95%)
      └─ PDF Generation (Progress: 95-100%)
```

## Logs to Watch For

✅ **Success:**
```
🚀 Processing chunk 1 for job: xxx
📦 Processing chunk 1: items 1-200 of 1519
✅ Chunk complete: 180/200 matched (90%)
⏭️  Continuing with chunk 2...
🔄 Invoking next chunk (attempt 1/3)...
✅ Successfully invoked next chunk
```

❌ **Failure (now handled):**
```
❌ Self-invocation attempt 1 failed: [error]
⏳ Retrying in 2000ms...
🔄 Invoking next chunk (attempt 2/3)...
✅ Successfully invoked next chunk
```

## Additional Improvements Made

- Cost per page calculations now work correctly
- Skip items without unit_price or page_yield individually
- Better logging for savings analysis
- Detailed summary at end of processing

## Deployment

✅ **Deployed:** October 8, 2025
📍 **Project:** qpiijzpslfjwikigrbol  
🔗 **Dashboard:** https://supabase.com/dashboard/project/qpiijzpslfjwikigrbol/functions
