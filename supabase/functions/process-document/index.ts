import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import OpenAI from 'npm:openai@4';
import * as XLSX from 'npm:xlsx@0.18.5';
import { generatePDFReport } from '../shared/pdf-generator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// Initialize clients
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const openai = new OpenAI({ apiKey: openaiApiKey });

interface ProcessingContext {
  submissionId: string;
  jobId: string;
  fileUrl: string;
  fileName: string;
  customerInfo: {
    firstName: string;
    lastName: string;
    company: string;
    email: string;
  };
  // Chunked processing support
  chunkIndex?: number;      // Current chunk being processed (0-based)
  totalItems?: number;       // Total items in document
  itemsProcessed?: number;   // Items processed so far
}

/**
 * Update processing job progress
 */
async function updateProgress(
  jobId: string,
  progress: number,
  step: string,
  updates: Record<string, any> = {}
) {
  const { error } = await supabase
    .from('processing_jobs')
    .update({
      progress,
      current_step: step,
      updated_at: new Date().toISOString(),
      ...updates
    })
    .eq('id', jobId);

  if (error) {
    console.error('Error updating progress:', error);
  }
}

/**
 * Main processing orchestrator with CHUNKED PROCESSING for large files
 */
async function processDocument(context: ProcessingContext) {
  const chunkIndex = context.chunkIndex || 0;
  const CHUNK_SIZE = 200; // Process 200 items per chunk (safe for timeout with savings calc)
  
  console.log(`🚀 Processing chunk ${chunkIndex + 1} for job:`, context.jobId);

  try {
    // Step 1: Download and parse file (only on first chunk)
    if (chunkIndex === 0) {
      await updateProgress(context.jobId, 5, 'Downloading file...');
      const fileContent = await downloadFile(context.fileUrl, context.fileName);
      
      await updateProgress(context.jobId, 10, 'Parsing document...');
      const parsedData = await parseDocument(fileContent, context.fileName);
      
      // Store parsed items in job metadata for next chunks
      await supabase
        .from('processing_jobs')
        .update({
          metadata: {
            total_items: parsedData.items.length,
            headers: parsedData.headers,
            parsed_at: new Date().toISOString()
          }
        })
        .eq('id', context.jobId);
      
      context.totalItems = parsedData.items.length;
      await updateProgress(context.jobId, 15, `Extracted ${parsedData.items.length} items - starting batch processing`);
      
      // Process first chunk
      await processChunk(parsedData.items, 0, CHUNK_SIZE, context);
      
    } else {
      // Subsequent chunks: re-download and parse to get items
      const fileContent = await downloadFile(context.fileUrl, context.fileName);
      const parsedData = await parseDocument(fileContent, context.fileName);
      context.totalItems = parsedData.items.length;
      
      // Process this chunk
      await processChunk(parsedData.items, chunkIndex, CHUNK_SIZE, context);
    }

    // Check if more chunks needed
    const itemsProcessed = (chunkIndex + 1) * CHUNK_SIZE;
    const totalItems = context.totalItems || 0;
    
    if (itemsProcessed < totalItems) {
      // More chunks to process - invoke function again
      const nextChunkIndex = chunkIndex + 1;
      const progress = 15 + Math.floor((itemsProcessed / totalItems) * 45); // 15-60% for matching
      
      await updateProgress(
        context.jobId, 
        progress, 
        `Matched ${itemsProcessed}/${totalItems} products - continuing...`
      );
      
      console.log(`⏭️  Continuing with chunk ${nextChunkIndex + 1}...`);
      
      // Self-invoke for next chunk (with proper error handling)
      try {
        await invokeSelf({
          ...context,
          chunkIndex: nextChunkIndex,
          itemsProcessed
        });
        console.log(`✅ Next chunk invoked successfully`);
      } catch (err) {
        console.error('❌ Failed to invoke next chunk:', err);
        // Don't throw - let the function complete gracefully
        // The error is already logged in processing_jobs by invokeSelf
      }
      
      return { success: true, status: 'chunking', nextChunk: nextChunkIndex };
    }

    // All chunks complete - move to savings calculation
    console.log('✅ All matching complete, calculating savings...');
    await updateProgress(context.jobId, 60, 'All items matched! Calculating savings...');

    // Get all matched items from database WITH matched product details
    const { data: allMatchedItems, error: fetchError } = await supabase
      .from('order_items_extracted')
      .select(`
        *,
        matched_product:matched_product_id (
          id,
          sku,
          product_name,
          brand,
          model,
          category,
          size_category,
          color_type,
          page_yield,
          unit_price,
          active
        )
      `)
      .eq('processing_job_id', context.jobId);

    if (fetchError) {
      console.error('❌ Error fetching matched items:', fetchError);
      throw new Error(`Failed to fetch matched items: ${fetchError.message}`);
    }

    if (!allMatchedItems || allMatchedItems.length === 0) {
      throw new Error('No matched items found in database');
    }

    console.log(`📊 Retrieved ${allMatchedItems.length} items from database for savings calculation`);

    // Step 3: Calculate savings (60-80%)
    await updateProgress(context.jobId, 65, 'Analyzing savings opportunities...');
    const savingsAnalysis = await calculateSavings(allMatchedItems, context.jobId);
    
    await updateProgress(context.jobId, 80, 'Generating report...');

    // Step 4: Generate PDF report (80-95%)
    const reportUrl = await generateReport(savingsAnalysis, context);
    
    await updateProgress(context.jobId, 95, 'Saving results...');

    // Step 5: Save final results (95-100%)
    await saveFinalReport(savingsAnalysis, context, reportUrl);
    
    await updateProgress(context.jobId, 100, 'Complete', {
      status: 'completed',
      completed_at: new Date().toISOString(),
      report_url: reportUrl,
      savings_analysis: savingsAnalysis.summary
    });

    console.log('✅ Processing complete:', context.jobId);
    return { success: true, status: 'completed' };

  } catch (error) {
    console.error('❌ Processing error:', error);
    
    await updateProgress(context.jobId, 0, 'Failed', {
      status: 'failed',
      error_message: error instanceof Error ? error.message : 'Unknown error',
      completed_at: new Date().toISOString()
    });

    throw error;
  }
}

/**
 * Process a single chunk of items
 */
async function processChunk(
  allItems: any[], 
  chunkIndex: number, 
  chunkSize: number,
  context: ProcessingContext
) {
  const startIdx = chunkIndex * chunkSize;
  const endIdx = Math.min(startIdx + chunkSize, allItems.length);
  const chunk = allItems.slice(startIdx, endIdx);
  
  console.log(`📦 Processing chunk ${chunkIndex + 1}: items ${startIdx + 1}-${endIdx} of ${allItems.length}`);
  
  // Match products in this chunk
  await matchProducts(chunk, context.jobId, startIdx);
}

/**
 * Self-invoke the function for next chunk (async continuation) with retry logic
 */
async function invokeSelf(context: ProcessingContext, retries = 3) {
  const functionUrl = `${supabaseUrl}/functions/v1/process-document`;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🔄 Invoking next chunk (attempt ${attempt}/${retries})...`);
      
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          submissionId: context.submissionId,
          _internal: true,
          _context: context
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Self-invocation failed: ${response.status} - ${errorText}`);
      }
      
      const result = await response.json();
      console.log(`✅ Successfully invoked next chunk:`, result);
      return result;
      
    } catch (error) {
      console.error(`❌ Self-invocation attempt ${attempt} failed:`, error);
      
      if (attempt === retries) {
        // On final failure, update job to show error
        await supabase
          .from('processing_jobs')
          .update({
            status: 'failed',
            error_message: `Failed to continue processing after chunk ${context.chunkIndex}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            completed_at: new Date().toISOString()
          })
          .eq('id', context.jobId);
        
        throw error;
      }
      
      // Exponential backoff: 2s, 4s, 8s
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`⏳ Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Download file from Supabase Storage
 */
async function downloadFile(fileUrl: string, fileName: string): Promise<string | ArrayBuffer> {
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`);
  }
  
  // Check if file is Excel format (binary)
  const isExcel = fileName.toLowerCase().endsWith('.xlsx') || 
                  fileName.toLowerCase().endsWith('.xls');
  
  if (isExcel) {
    return await response.arrayBuffer();
  }
  
  return await response.text();
}

/**
 * Parse CSV/Excel document with intelligent header detection
 */
async function parseDocument(content: string | ArrayBuffer, fileName: string) {
  console.log('📄 Parsing document:', fileName);

  // Detect file type
  const isExcel = fileName.toLowerCase().endsWith('.xlsx') || 
                  fileName.toLowerCase().endsWith('.xls');
  
  let rows: any[][] = [];
  let headers: string[] = [];
  let headerIndex = 0;

  if (isExcel && content instanceof ArrayBuffer) {
    // Parse Excel file
    console.log('📊 Parsing Excel file...');
    const workbook = XLSX.read(content, { type: 'array' });
    
    // Get first worksheet
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    console.log(`📊 Reading sheet: ${firstSheetName}`);
    
    // Convert to array of arrays
    const rawData = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1,  // Return array of arrays
      defval: '',  // Default value for empty cells
      blankrows: false  // Skip blank rows
    }) as any[][];
    
    // Smart header detection for Excel
    const headerResult = findDataHeaderFromRows(rawData);
    headerIndex = headerResult.headerIndex;
    headers = headerResult.headers;
    
    // Get data rows (after header)
    rows = rawData.slice(headerIndex + 1);
    
    console.log('📊 Found header at row', headerIndex + 1);
    console.log('📊 Columns:', headers);
    console.log(`📊 Total data rows: ${rows.length}`);
    
  } else if (typeof content === 'string') {
    // Parse CSV content
    console.log('📊 Parsing CSV file...');
    const lines = content.trim().split('\n');
    
    // Smart header detection - find the actual data header row
    const { headerRow, headerIndex: csvHeaderIndex } = findDataHeader(lines);
    headerIndex = csvHeaderIndex;
    headers = headerRow.split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    
    console.log('📊 Found header at row', headerIndex + 1);
    console.log('📊 Columns:', headers);

    // Parse rows starting after the header
    for (let i = headerIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      // Advanced CSV parsing (handles quoted commas)
      const values = parseCSVLine(line);
      rows.push(values);
    }
  } else {
    throw new Error('Invalid content type for parsing');
  }

  // Extract product information from rows
  const items: any[] = [];
  for (const values of rows) {
    if (!values || values.length === 0) continue;
    
    // Convert row array to object
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index]?.toString() || '';
    });

    // Extract product information with intelligent column detection
    const item = extractProductInfo(row, headers);
    if (item) {
      items.push(item);
    }
  }

  console.log(`✅ Parsed ${items.length} items from ${rows.length} rows`);

  return {
    items,
    totalItems: items.length,
    headers
  };
}

/**
 * Intelligently find the actual data header row from Excel rows (array of arrays)
 */
function findDataHeaderFromRows(rows: any[][]): { headers: string[]; headerIndex: number } {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    
    // Convert row to string for analysis
    const rowText = row.join(' ').toLowerCase();
    
    // Look for common column headers that indicate actual data
    const dataIndicators = [
      'sku', 'oem', 'item', 'product', 'description', 
      'quantity', 'qty', 'price', 'cost', 'amount',
      'part', 'number', 'model', 'uom'
    ];
    
    const hasMultipleIndicators = dataIndicators.filter(indicator => 
      rowText.includes(indicator)
    ).length >= 3;
    
    if (hasMultipleIndicators) {
      console.log(`✓ Found data header at row ${i + 1}`);
      const headers = row.map((cell: any) => cell?.toString().trim() || '');
      return { headers, headerIndex: i };
    }
  }
  
  // Fallback to first non-empty row
  console.log('⚠️ Using first row as header (no clear header found)');
  const firstRow = rows[0] || [];
  const headers = firstRow.map((cell: any) => cell?.toString().trim() || '');
  return { headers, headerIndex: 0 };
}

/**
 * Intelligently find the actual data header row (skips metadata/blank rows) - CSV version
 */
function findDataHeader(lines: string[]): { headerRow: string; headerIndex: number } {
  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    const lowerLine = line.toLowerCase();
    
    // Look for common column headers that indicate actual data
    const dataIndicators = [
      'sku', 'oem', 'item', 'product', 'description', 
      'quantity', 'qty', 'price', 'cost', 'amount',
      'part', 'number', 'model', 'uom'
    ];
    
    const hasMultipleIndicators = dataIndicators.filter(indicator => 
      lowerLine.includes(indicator)
    ).length >= 3;
    
    if (hasMultipleIndicators) {
      console.log(`✓ Found data header at row ${i + 1}`);
      return { headerRow: line, headerIndex: i };
    }
  }
  
  // Fallback to first non-empty line
  console.log('⚠️ Using first line as header (no clear header found)');
  return { headerRow: lines[0], headerIndex: 0 };
}

/**
 * Advanced CSV line parser that handles quoted commas
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  values.push(current.trim());
  return values;
}

/**
 * Extract product info from row with intelligent multi-column detection
 */
function extractProductInfo(row: Record<string, string>, headers: string[]) {
  // Find ALL relevant columns using multiple strategies
  const productNameCol = headers.find(h => 
    /item\s*description|product\s*name|description|item|product/i.test(h)
  );
  
  // Look for multiple SKU-like columns (Staples SKU, OEM Number, Part Number, etc.)
  const skuColumns = headers.filter(h => 
    /sku|oem|part\s*number|part\s*#|model|catalog/i.test(h)
  );
  
  // Find quantity column - be very specific to avoid wrong columns
  const qtyCol = headers.find(h => {
    const lower = h.toLowerCase().trim();
    // Exact matches first
    if (lower === 'qty' || lower === 'quantity') return true;
    // Exclude columns with 'sell', 'uom', 'in' to avoid "QTY in Sell UOM"
    if (/sell|uom/i.test(h)) return false;
    // Then check patterns
    return /^qty$|^quantity$/i.test(lower);
  });
  
  const priceCol = headers.find(h => {
    const lower = h.toLowerCase().trim();
    // Exact matches for common price columns
    if (lower === 'sale' || lower === 'price' || lower === 'unit price') return true;
    // Pattern match excluding totals
    return /(unit\s*price|price|cost|amount|sale)/i.test(h) && !/total|extended/i.test(h);
  });

  // Need at least a product name or SKU
  const productName = productNameCol ? row[productNameCol] : '';
  const skus = skuColumns.map(col => row[col]).filter(Boolean);
  
  if (!productName && skus.length === 0) {
    return null;
  }
  
  // Skip header-like rows or metadata
  if (!productName || productName.length < 2 || 
      /^(account|customer|report|date|total)/i.test(productName)) {
    return null;
  }

  // Extract SKU (prefer OEM number, then Staples SKU, then any SKU)
  const oemCol = headers.find(h => /oem/i.test(h));
  const staplesSkuCol = headers.find(h => /staples.*sku/i.test(h));
  const primarySku = (oemCol && row[oemCol]) || (staplesSkuCol && row[staplesSkuCol]) || skus[0] || '';
  
  // Get all SKUs for matching attempts
  const allSkus = skus.filter(s => s && s.length > 0);

  const quantityStr = qtyCol ? row[qtyCol]?.replace(/[^0-9.]/g, '') : '1';
  const priceStr = priceCol ? row[priceCol]?.replace(/[^0-9.]/g, '') : '0';

  let quantity = parseInt(quantityStr) || 1;
  let unitPrice = parseFloat(priceStr) || 0;
  
  // Validation: Reject obviously wrong values (likely wrong column)
  // Max reasonable quantity for a single order line: 10,000 units
  // Max reasonable unit price: $100,000
  if (quantity > 10000) {
    console.warn(`Suspicious quantity ${quantity} for ${productName}, capping to 10000`);
    quantity = 10000;
  }
  
  if (unitPrice > 100000) {
    console.warn(`Suspicious unit price ${unitPrice} for ${productName}, capping to 100000`);
    unitPrice = 100000;
  }
  
  // Calculate total with safety cap (DECIMAL(10,2) max is 99,999,999.99)
  const MAX_DECIMAL = 99999999.99;
  let totalPrice = quantity * unitPrice;
  if (totalPrice > MAX_DECIMAL) {
    console.warn(`Total price ${totalPrice} exceeds max, capping to ${MAX_DECIMAL}`);
    totalPrice = MAX_DECIMAL;
  }

  return {
    raw_product_name: productName.trim(),
    raw_sku: primarySku.trim() || null,
    raw_description: productName.trim(),
    all_skus: allSkus, // Keep all SKUs for matching
    quantity,
    unit_price: unitPrice,
    total_price: totalPrice
  };
}

/**
 * Match products to master catalog - OPTIMIZED FOR CHUNKED PROCESSING
 */
async function matchProducts(items: any[], jobId: string, startOffset = 0) {
  console.log(`🔍 Matching ${items.length} products (offset ${startOffset})...`);
  const BATCH_SIZE = 50; // Conservative batch size (50 concurrent operations)
  const matched: any[] = [];

  // Process items in batches for efficiency
  for (let batchStart = 0; batchStart < items.length; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, items.length);
    const batch = items.slice(batchStart, batchEnd);
    
    console.log(`📦 Batch ${Math.floor(batchStart/BATCH_SIZE) + 1}/${Math.ceil(items.length/BATCH_SIZE)} (${batchStart + 1}-${batchEnd})`);

    // Match all items in batch concurrently
    const batchPromises = batch.map(async (item, idx) => {
      const globalIdx = startOffset + batchStart + idx;
      try {
        const matchResult = await matchSingleProduct(item, globalIdx + 1, 0);
        return matchResult;
      } catch (error) {
        console.error(`Error matching item ${globalIdx + 1}:`, error);
        return {
          ...item,
          matched_product: null,
          match_score: 0,
          match_method: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    matched.push(...batchResults);

    // Save batch to database in bulk
    await saveBatchItems(batchResults, jobId);
    
    console.log(`  ✓ Saved batch ${Math.floor(batchStart/BATCH_SIZE) + 1}`);
  }

  const matchedCount = matched.filter(m => m.matched_product).length;
  console.log(`✅ Chunk complete: ${matchedCount}/${items.length} matched (${Math.round(matchedCount/items.length*100)}%)`);

  return matched;
}

/**
 * Match a single product through multiple tiers (AI disabled for performance)
 */
async function matchSingleProduct(item: any, index: number, total: number) {
  console.log(`  Matching ${index}/${total}: ${item.raw_product_name} [SKU: ${item.raw_sku}]`);

  let match: { product: any; score: number; method: string } | null = null;
  
  // Tier 1: Try exact match on ALL available SKUs
  if (item.all_skus && item.all_skus.length > 0) {
    for (const sku of item.all_skus) {
      match = await exactSKUMatch(sku);
      if (match) {
        console.log(`    ✓ Matched via SKU: ${sku}`);
        break;
      }
    }
  }
  
  // Tier 2: Fuzzy SKU match (handles minor variations)
  if (!match && item.raw_sku) {
    match = await fuzzySKUMatch(item.raw_sku);
    if (match) {
      console.log(`    ✓ Matched via fuzzy SKU`);
    }
  }

  // Tier 3: Full-text search on product name
  if (!match || match.score < 0.85) {
    const textMatch = await fullTextSearch(item.raw_product_name);
    if (textMatch && (!match || textMatch.score > match.score)) {
      match = textMatch;
      console.log(`    ✓ Matched via full-text search`);
    }
  }

  // Tier 4: Semantic search (SKIP if we have decent match already - optimization)
  if (!match || match.score < 0.70) {
    const semanticMatch = await semanticSearch(item.raw_product_name);
    if (semanticMatch && (!match || semanticMatch.score > match.score)) {
      match = semanticMatch;
      console.log(`    ✓ Matched via semantic search`);
    }
  }

  // Tier 5: AI Agent fallback (DISABLED for performance - AI is too slow for large batches)
  // TODO: Re-enable AI for final polish pass after all chunks complete
  // if (canUseAI && (!match || match.score < 0.30)) {
  //   console.log(`    🤖 Using AI agent for difficult match...`);
  //   const aiMatch = await aiAgentMatch(item);
  //   if (aiMatch && (!match || aiMatch.score > match.score)) {
  //     match = aiMatch;
  //     console.log(`    ✓ Matched via AI agent`);
  //   }
  // }

  if (!match) {
    console.log(`    ✗ No match found`);
  }

  // Store matched item
  return {
    ...item,
    matched_product: match?.product || null,
    match_score: match?.score || 0,
    match_method: match?.method || 'none'
  };
}

/**
 * Tier 5: AI Agent for intelligent product matching (implements AI_PROCESSING_PLAN.md agents)
 */
async function aiAgentMatch(item: any) {
  if (!item.raw_product_name || item.raw_product_name.length < 3) return null;

  try {
    // Use OpenAI to intelligently parse product name and find best match
    const prompt = `You are an expert product matching agent for office supplies. Given a customer's product description, identify the key attributes and suggest the most likely matching product.

Customer Product: "${item.raw_product_name}"
${item.raw_sku ? `Customer SKU: "${item.raw_sku}"` : ''}

Extract these attributes:
- Brand (HP, Brother, Canon, etc.)
- Product Type (Toner, Ink Cartridge, Paper, etc.)
- Model/Part Number
- Color (Black, Cyan, Magenta, Yellow, Tri-Color)
- Size Category (Standard, XL, XXL)

Respond with ONLY a JSON object in this exact format:
{
  "brand": "extracted brand or null",
  "product_type": "toner_cartridge|ink_cartridge|paper|other",
  "model": "extracted model number or null",
  "color": "black|cyan|magenta|yellow|color|null",
  "size": "standard|xl|xxl|null",
  "search_query": "best search terms for database"
}`;

    // Try GPT-5-mini first, with fallback to GPT-4o-mini if not available
    let response;
    try {
      response = await openai.chat.completions.create({
        model: 'gpt-5-mini', // Preferred: Fast and cheap for simple parsing
        messages: [{ role: 'user', content: prompt }],
        // Note: GPT-5 doesn't support temperature parameter, uses default of 1
        reasoning_effort: 'low', // Use low reasoning for fast, consistent extraction
        max_completion_tokens: 200,
        response_format: { type: 'json_object' }
      });
    } catch (modelError: any) {
      // Fallback to gpt-4o-mini if gpt-5-mini isn't available or if there's a parameter error
      const shouldFallback = 
        modelError?.error?.code === 'model_not_found' || 
        modelError?.status === 404 ||
        modelError?.status === 400; // Catch parameter errors too
      
      if (shouldFallback) {
        console.log('    ⚠️ gpt-5-mini not available or parameter error, falling back to gpt-4o-mini');
        response = await openai.chat.completions.create({
          model: 'gpt-4o-mini', // Fallback model
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1, // gpt-4o-mini supports temperature
          max_completion_tokens: 200,
          response_format: { type: 'json_object' }
        });
      } else {
        throw modelError;
      }
    }

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    console.log(`      AI extracted:`, parsed);

    // Build intelligent search query based on AI extraction
    const searchParts: string[] = [];
    if (parsed.brand) searchParts.push(parsed.brand);
    if (parsed.model) searchParts.push(parsed.model);
    if (parsed.color && parsed.color !== 'null') searchParts.push(parsed.color);
    if (parsed.size && parsed.size !== 'null') searchParts.push(parsed.size);
    
    const searchQuery = parsed.search_query || searchParts.join(' ');

    // Search database with AI-enhanced query
    const { data, error } = await supabase
      .from('master_products')
      .select('*')
      .or(`product_name.ilike.%${searchQuery}%,brand.ilike.%${parsed.brand || ''}%`)
      .eq('active', true)
      .limit(5);

    if (!error && data && data.length > 0) {
      // Find best match by comparing attributes
      let bestMatch = data[0];
      let bestScore = 0.65; // Base AI score

      for (const product of data) {
        let score = 0.65;
        
        // Boost score for matching attributes
        if (parsed.brand && product.brand?.toLowerCase().includes(parsed.brand.toLowerCase())) score += 0.15;
        if (parsed.model && (product.model?.toLowerCase().includes(parsed.model.toLowerCase()) || 
                             product.sku?.toLowerCase().includes(parsed.model.toLowerCase()))) score += 0.15;
        if (parsed.color && product.color_type?.toLowerCase() === parsed.color) score += 0.05;
        
        if (score > bestScore) {
          bestScore = score;
          bestMatch = product;
        }
      }

      return {
        product: bestMatch,
        score: Math.min(bestScore, 0.95), // Cap AI matches at 0.95 (never 1.0 since it's not exact)
        method: 'ai_suggested'
      };
    }

    return null;
  } catch (error) {
    console.error('AI agent error:', error);
    return null;
  }
}

/**
 * Tier 1: Exact SKU matching
 */
async function exactSKUMatch(sku: string) {
  if (!sku || sku.length < 2) return null;

  // Clean the SKU
  const cleanSku = sku.trim().toUpperCase();

  const { data, error } = await supabase
    .from('master_products')
    .select('*')
    .eq('sku', cleanSku)
    .eq('active', true)
    .single();

  if (!error && data) {
    return {
      product: data,
      score: 1.0,
      method: 'exact_sku'
    };
  }

  return null;
}

/**
 * Tier 2: Fuzzy SKU matching (handles case, spaces, dashes)
 */
async function fuzzySKUMatch(sku: string) {
  if (!sku || sku.length < 2) return null;

  // Normalize SKU: uppercase, remove spaces/dashes
  const normalizedSku = sku.trim().toUpperCase().replace(/[\s\-_]/g, '');

  // Try ILIKE search (case-insensitive pattern match)
  const { data, error } = await supabase
    .from('master_products')
    .select('*')
    .ilike('sku', `%${normalizedSku}%`)
    .eq('active', true)
    .limit(5);

  if (!error && data && data.length > 0) {
    // Find best match by comparing normalized SKUs
    for (const product of data) {
      const productSkuNorm = product.sku.toUpperCase().replace(/[\s\-_]/g, '');
      if (productSkuNorm === normalizedSku) {
        return {
          product,
          score: 0.95,
          method: 'fuzzy_sku'
        };
      }
    }
    
    // Return first partial match if no exact normalized match
    return {
      product: data[0],
      score: 0.85,
      method: 'fuzzy_sku'
    };
  }

  return null;
}

/**
 * Tier 3: Enhanced full-text search
 */
async function fullTextSearch(productName: string) {
  if (!productName || productName.length < 3) return null;

  // Extract key terms (brand, model, color, etc.)
  const normalizedName = productName
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .trim();
  
  // Create search query with important terms
  const searchTerms = normalizedName
    .split(/\s+/)
    .filter(term => term.length > 1) // Keep even 2-char terms (HP, XL, etc.)
    .slice(0, 8) // Limit to first 8 terms
    .join(' & ');

  if (!searchTerms) return null;

  const { data, error } = await supabase
    .from('master_products')
    .select('*')
    .textSearch('search_vector', searchTerms, {
      type: 'websearch'
    })
    .eq('active', true)
    .limit(3);

  if (!error && data && data.length > 0) {
    // Score based on term overlap
    const bestMatch = data[0];
    const matchScore = calculateTextMatchScore(normalizedName, bestMatch);
    
    return {
      product: bestMatch,
      score: matchScore,
      method: 'fuzzy_name'
    };
  }

  return null;
}

/**
 * Calculate match score based on term overlap
 */
function calculateTextMatchScore(searchText: string, product: any): number {
  const searchTerms = new Set(searchText.split(/\s+/).filter(t => t.length > 1));
  const productText = `${product.product_name} ${product.brand} ${product.model || ''}`
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ');
  const productTerms = new Set(productText.split(/\s+/).filter(t => t.length > 1));
  
  let matchedTerms = 0;
  for (const term of searchTerms) {
    if (productTerms.has(term)) {
      matchedTerms++;
    }
  }
  
  const overlapRatio = matchedTerms / searchTerms.size;
  return Math.max(0.7, Math.min(0.95, 0.7 + (overlapRatio * 0.25)));
}

/**
 * Tier 3: Semantic search with embeddings
 */
async function semanticSearch(productName: string) {
  if (!productName) return null;

  try {
    // Generate embedding for search query
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: productName,
    });

    const embedding = embeddingResponse.data[0].embedding;

    // Vector similarity search
    const { data, error } = await supabase.rpc('match_products', {
      query_embedding: embedding,
      match_threshold: 0.7,
      match_count: 1
    });

    if (!error && data && data.length > 0) {
      const result = data[0];
      return {
        product: result,
        score: result.similarity || 0.75,
        method: 'semantic'
      };
    }
  } catch (error) {
    console.error('Semantic search error:', error);
  }

  return null;
}

/**
 * Save batch of extracted items to database (BULK INSERT for performance)
 */
async function saveBatchItems(items: any[], jobId: string) {
  if (items.length === 0) return;

  // Cap numeric values to prevent overflow (DECIMAL(10,2) max is 99,999,999.99)
  const MAX_DECIMAL = 99999999.99;
  const MAX_INTEGER = 2147483647;
  const capValue = (val: number) => Math.min(Math.max(val || 0, 0), MAX_DECIMAL);
  const capInteger = (val: number) => Math.min(Math.max(val || 0, 0), MAX_INTEGER);
  const capScore = (val: number) => Math.min(Math.max(val || 0, 0), 1); // match_score must be 0-1

  const rows = items.map(item => {
    // Validate match_method against CHECK constraint
    const validMethods = ['exact_sku', 'fuzzy_sku', 'fuzzy_name', 'semantic', 'ai_suggested', 'manual', 'none', 'error', 'timeout'];
    let matchMethod = item.match_method || 'none';
    if (!validMethods.includes(matchMethod)) {
      console.warn(`Invalid match_method: ${matchMethod}, defaulting to 'none'`);
      matchMethod = 'none';
    }

    return {
      processing_job_id: jobId,
      raw_product_name: item.raw_product_name?.substring(0, 500) || null,
      raw_sku: item.raw_sku?.substring(0, 100) || null,
      raw_description: item.raw_description?.substring(0, 1000) || null,
      quantity: capInteger(item.quantity),
      unit_price: capValue(item.unit_price),
      total_price: capValue(item.total_price),
      matched_product_id: item.matched_product?.id || null,
      match_score: capScore(item.match_score), // Ensure 0-1 range
      match_method: matchMethod,
      current_total_cost: capValue(item.total_price)
    };
  });

  const { error } = await supabase
    .from('order_items_extracted')
    .insert(rows);

  if (error) {
    console.error('❌ Error saving batch items:', error);
    console.error('Batch size:', items.length);
    console.error('First item:', { 
      name: items[0].raw_product_name, 
      sku: items[0].raw_sku,
      qty: items[0].quantity,
      price: items[0].unit_price,
      match_score: items[0].match_score,
      match_method: items[0].match_method
    });
    
    // Try saving items one by one to identify problematic rows
    console.log('🔄 Attempting individual inserts to identify failing rows...');
    for (let i = 0; i < items.length; i++) {
      const { error: singleError } = await supabase
        .from('order_items_extracted')
        .insert([rows[i]]);
      
      if (singleError) {
        console.error(`❌ Failed to save item ${i + 1}:`, singleError);
        console.error('Problematic item data:', rows[i]);
      }
    }
  } else {
    console.log(`✅ Saved batch of ${items.length} items`);
  }
}

/**
 * Calculate cost and environmental savings
 */
async function calculateSavings(matchedItems: any[], jobId: string) {
  console.log('💰 Calculating savings...');

  let totalCurrentCost = 0;
  let totalOptimizedCost = 0;
  let totalSavings = 0;
  let itemsWithSavings = 0;
  let itemsAnalyzed = 0;
  let itemsSkipped = 0;
  let cartridgesSaved = 0;
  let co2Reduced = 0;

  const breakdown: any[] = [];

  for (const item of matchedItems) {
    // Skip if no match found
    if (!item.matched_product) {
      breakdown.push({
        ...item,
        savings: null,
        recommendation: 'No match found'
      });
      itemsSkipped++;
      console.log(`  ⊘ Skipped (no match): ${item.raw_product_name}`);
      continue;
    }

    const matchedProduct = item.matched_product;
    
    // Check if we have required data for savings calculation
    const hasUnitPrice = matchedProduct.unit_price && matchedProduct.unit_price > 0;
    const hasPageYield = matchedProduct.page_yield && matchedProduct.page_yield > 0;
    const hasUserPrice = item.unit_price && item.unit_price > 0;
    
    if (!hasUnitPrice || !hasPageYield) {
      // Skip items without cost or page_yield - can't calculate savings
      const currentCost = item.total_price || 0;
      totalCurrentCost += currentCost;
      totalOptimizedCost += currentCost;
      
      breakdown.push({
        ...item,
        savings: 0,
        recommendation: 'Insufficient data for savings calculation'
      });
      itemsSkipped++;
      console.log(`  ⊘ Skipped (missing data): ${item.raw_product_name} - unit_price: ${hasUnitPrice ? '✓' : '✗'}, page_yield: ${hasPageYield ? '✓' : '✗'}`);
      continue;
    }

    // We have enough data - analyze this item
    itemsAnalyzed++;
    const currentCost = item.total_price || 0;
    totalCurrentCost += currentCost;

    // Calculate cost per page for comparison
    const userCostPerPage = hasUserPrice && hasPageYield 
      ? item.unit_price / matchedProduct.page_yield 
      : null;
    const ourCostPerPage = matchedProduct.unit_price / matchedProduct.page_yield;
    
    console.log(`  📊 Analyzing: ${item.raw_product_name}`);
    console.log(`     User paying: $${item.unit_price}/unit, Cost/page: $${userCostPerPage?.toFixed(4) || 'N/A'}`);
    console.log(`     Our price: $${matchedProduct.unit_price}/unit (${matchedProduct.page_yield} pages), Cost/page: $${ourCostPerPage.toFixed(4)}`);

    // Find better alternatives (larger sizes, bulk pricing)
    const recommendation = await findBetterAlternative(item, matchedProduct);

    if (recommendation) {
      const optimizedCost = recommendation.total_cost;
      const savings = currentCost - optimizedCost;

      totalOptimizedCost += optimizedCost;
      totalSavings += savings;

      if (savings > 0) {
        itemsWithSavings++;
        console.log(`     💰 Savings: $${savings.toFixed(2)} (${((savings/currentCost)*100).toFixed(1)}%)`);
      }

      // Environmental impact
      if (recommendation.cartridges_saved > 0) {
        cartridgesSaved += recommendation.cartridges_saved;
        const co2PerCartridge = matchedProduct.category === 'toner_cartridge' ? 5.2 : 2.5;
        co2Reduced += recommendation.cartridges_saved * co2PerCartridge;
      }

      // Update database with capped values
      const MAX_DECIMAL = 99999999.99;
      const capValue = (val: number) => Math.min(Math.max(val || 0, 0), MAX_DECIMAL);
      
      await supabase
        .from('order_items_extracted')
        .update({
          recommended_product_id: recommendation.product.id,
          recommended_quantity: recommendation.quantity || 0,
          recommended_total_cost: capValue(optimizedCost),
          cost_savings: capValue(savings),
          cost_savings_percentage: Math.min(Math.max((savings / currentCost) * 100, 0), 100),
          savings_reason: recommendation.reason?.substring(0, 500) || null,
          recommendation_type: recommendation.type,
          environmental_savings: {
            cartridges_saved: Math.max(0, recommendation.cartridges_saved || 0),
            co2_reduced: Math.max(0, (recommendation.cartridges_saved || 0) * (matchedProduct.category === 'toner_cartridge' ? 5.2 : 2.5))
          }
        })
        .eq('processing_job_id', jobId)
        .eq('raw_product_name', item.raw_product_name);

      breakdown.push({
        ...item,
        recommendation,
        savings
      });
    } else {
      totalOptimizedCost += currentCost;
      breakdown.push({
        ...item,
        savings: 0,
        recommendation: 'Already optimized'
      });
      console.log(`     ✓ Already optimized (no better alternative found)`);
    }
  }

  console.log(`\n📊 Savings Summary:`);
  console.log(`   Total items: ${matchedItems.length}`);
  console.log(`   Items analyzed: ${itemsAnalyzed}`);
  console.log(`   Items with savings: ${itemsWithSavings}`);
  console.log(`   Items skipped: ${itemsSkipped}`);
  console.log(`   Total savings: $${totalSavings.toFixed(2)}`);

  return {
    summary: {
      total_current_cost: totalCurrentCost,
      total_optimized_cost: totalOptimizedCost,
      total_cost_savings: totalSavings,
      savings_percentage: totalCurrentCost > 0 ? (totalSavings / totalCurrentCost) * 100 : 0,
      total_items: matchedItems.length,
      items_with_savings: itemsWithSavings,
      environmental: {
        cartridges_saved: cartridgesSaved,
        co2_reduced_pounds: co2Reduced,
        trees_saved: co2Reduced / 48, // 1 tree absorbs ~48 lbs CO2/year
        plastic_reduced_pounds: cartridgesSaved * 0.5
      }
    },
    breakdown
  };
}

/**
 * Find better alternative products (larger sizes, bulk pricing)
 */
async function findBetterAlternative(item: any, currentProduct: any) {
  if (!currentProduct) return null;

  // Skip if already XL/XXL
  if (currentProduct.size_category && ['xl', 'xxl'].includes(currentProduct.size_category.toLowerCase())) {
    return null;
  }

  // Already checked in calculateSavings, but double-check here
  if (!currentProduct.page_yield || currentProduct.page_yield === 0) {
    return null;
  }

  if (!currentProduct.unit_price || currentProduct.unit_price === 0) {
    return null;
  }

  // OPTIMIZED: Single query for XL alternatives
  if (currentProduct.sku) {
    const baseSku = currentProduct.sku.replace(/A$/i, '');
    const xlSkus = [baseSku + 'X', baseSku + 'XL', currentProduct.sku + 'XL', currentProduct.sku + 'X'];

    const { data: xlProducts } = await supabase
      .from('master_products')
      .select('*')
      .in('sku', xlSkus)
      .eq('active', true)
      .limit(1);

    if (xlProducts && xlProducts.length > 0) {
      const xlProduct = xlProducts[0];
      
      // Ensure XL product has required data
      if (xlProduct.unit_price > 0 && xlProduct.page_yield > 0) {
        const savings = calculateSavingsForAlternative(item, currentProduct, xlProduct);
        if (savings) return savings;
      }
    }
  }

  return null;
}

/**
 * Calculate savings for an alternative product using cost per page comparison
 */
function calculateSavingsForAlternative(item: any, currentProduct: any, xlProduct: any) {
  const currentPageYield = currentProduct.page_yield || 1000;
  const xlPageYield = xlProduct.page_yield || 2000;
  
  // Only recommend if XL has significantly higher yield (at least 20% more)
  if (xlPageYield <= currentPageYield * 1.2) {
    return null;
  }
  
  // Calculate cost per page for both products
  const currentCostPerPage = currentProduct.unit_price / currentPageYield;
  const xlCostPerPage = xlProduct.unit_price / xlPageYield;
  
  // Only recommend if XL has better cost per page
  if (xlCostPerPage >= currentCostPerPage) {
    return null;
  }
  
  // Calculate total pages user needs (based on their current order)
  const totalPages = item.quantity * currentPageYield;
  
  // Calculate how many XL cartridges needed for same page count
  const quantityNeeded = Math.ceil(totalPages / xlPageYield);
  
  // Calculate total costs
  // User's current cost (what they're paying now)
  const userCurrentTotalCost = item.total_price || (item.quantity * item.unit_price);
  
  // Our recommended cost (using XL product)
  const ourRecommendedCost = quantityNeeded * xlProduct.unit_price;
  
  // Calculate savings
  const costSavings = userCurrentTotalCost - ourRecommendedCost;
  
  // Only recommend if there are actual savings
  if (costSavings <= 0) {
    return null;
  }
  
  const cartridgesSaved = item.quantity - quantityNeeded;
  const savingsPercentage = (costSavings / userCurrentTotalCost) * 100;
  
  // Calculate cost per page savings
  const userCostPerPage = item.unit_price && currentPageYield > 0 
    ? item.unit_price / currentPageYield 
    : currentCostPerPage;
  const costPerPageSavings = userCostPerPage - xlCostPerPage;
  
  return {
    product: xlProduct,
    quantity: quantityNeeded,
    total_cost: ourRecommendedCost,
    cartridges_saved: Math.max(0, cartridgesSaved),
    cost_per_page: xlCostPerPage,
    cost_per_page_savings: costPerPageSavings,
    reason: `Switch to ${xlProduct.size_category?.toUpperCase() || 'High Yield'} ${xlProduct.product_name} (${xlPageYield.toLocaleString()} pages vs ${currentPageYield.toLocaleString()} pages). Cost per page: $${xlCostPerPage.toFixed(4)} vs current $${userCostPerPage.toFixed(4)}. Saves ${cartridgesSaved} cartridges and $${costSavings.toFixed(2)} (${savingsPercentage.toFixed(1)}% savings)`,
    type: 'larger_size'
  };
}

/**
 * Generate PDF report and upload to storage
 */
async function generateReport(savingsAnalysis: any, context: ProcessingContext): Promise<string> {
  console.log('📄 Generating PDF report...');
  
  try {
    // Prepare report data with thorough null checking
    const reportData = {
      customer: {
        firstName: context.customerInfo.firstName,
        lastName: context.customerInfo.lastName,
        company: context.customerInfo.company,
        email: context.customerInfo.email
      },
      summary: savingsAnalysis.summary,
      breakdown: savingsAnalysis.breakdown
        .filter((item: any) => item && item.raw_product_name) // Filter out null/invalid items
        .map((item: any) => ({
          current_product: {
            name: item.raw_product_name || 'Unknown Product',
            sku: item.raw_sku || 'N/A',
            quantity: item.quantity || 0,
            unit_price: item.unit_price || 0,
            total_cost: item.total_price || 0
          },
          recommended_product: (item.recommendation && item.recommendation.product && item.recommendation.product.product_name) ? {
            name: item.recommendation.product.product_name,
            sku: item.recommendation.product.sku || 'N/A',
            quantity_needed: item.recommendation.quantity || 0,
            unit_price: item.recommendation.product.unit_price || 0,
            total_cost: item.recommendation.total_cost || 0,
            bulk_discount_applied: item.recommendation.type === 'bulk_pricing'
          } : undefined,
          savings: (item.savings && item.savings > 0 && item.total_price > 0) ? {
            cost_savings: item.savings,
            cost_savings_percentage: (item.savings / item.total_price) * 100,
            cartridges_saved: item.recommendation?.cartridges_saved || 0,
            co2_reduced: (item.recommendation?.cartridges_saved || 0) * 2.5
          } : undefined,
          reason: item.recommendation?.reason || undefined,
          recommendation_type: item.recommendation?.type || undefined
        }))
    };

    // Validate report data before generating PDF
    if (!reportData.summary || !reportData.breakdown) {
      console.error('❌ Invalid report data structure');
      return '/BMO_Savings_Kit.pdf';
    }

    // Filter out invalid items from breakdown
    reportData.breakdown = reportData.breakdown.filter((item: any) => {
      return item.current_product && 
             item.current_product.name && 
             item.current_product.name.length > 0;
    });

    console.log(`📄 Generating PDF with ${reportData.breakdown.length} items...`);

    // Generate PDF
    const pdfBytes = await generatePDFReport(reportData);
    
    // Upload to Supabase Storage - use same folder as CSV
    const fileName = `report.pdf`;
    const storagePath = `${context.submissionId}/${fileName}`;
    
    console.log('📤 Uploading PDF to:', storagePath);
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('document-submissions')
      .upload(storagePath, pdfBytes, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      console.error('❌ PDF upload error:', uploadError);
      throw new Error(`Failed to upload PDF: ${uploadError.message}`);
    }

    console.log('✅ PDF uploaded successfully:', uploadData);

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('document-submissions')
      .getPublicUrl(storagePath);

    console.log('✅ PDF report generated and uploaded:', urlData.publicUrl);
    return urlData.publicUrl;
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    // Return placeholder if PDF generation fails (don't fail entire process)
    return '/BMO_Savings_Kit.pdf';
  }
}

/**
 * Save final report to database
 */
async function saveFinalReport(savingsAnalysis: any, context: ProcessingContext, reportUrl: string) {
  // Cap numeric values to prevent overflow (DECIMAL(10,2) max is 99,999,999.99)
  const MAX_DECIMAL = 99999999.99;
  const capValue = (val: number) => Math.min(Math.max(val || 0, 0), MAX_DECIMAL);

  const { error } = await supabase
    .from('savings_reports')
    .insert({
      processing_job_id: context.jobId,
      submission_id: context.submissionId,
      total_current_cost: capValue(savingsAnalysis.summary.total_current_cost),
      total_optimized_cost: capValue(savingsAnalysis.summary.total_optimized_cost),
      total_cost_savings: capValue(savingsAnalysis.summary.total_cost_savings),
      savings_percentage: Math.min(savingsAnalysis.summary.savings_percentage || 0, 100),
      total_items: savingsAnalysis.summary.total_items || 0,
      items_with_savings: savingsAnalysis.summary.items_with_savings || 0,
      // Flatten environmental data with capping
      cartridges_saved: Math.min(savingsAnalysis.summary.environmental.cartridges_saved || 0, 999999),
      co2_reduced_pounds: capValue(savingsAnalysis.summary.environmental.co2_reduced_pounds),
      trees_saved: capValue(savingsAnalysis.summary.environmental.trees_saved),
      plastic_reduced_pounds: capValue(savingsAnalysis.summary.environmental.plastic_reduced_pounds),
      report_data: savingsAnalysis,
      pdf_url: reportUrl,
      customer_name: `${context.customerInfo.firstName} ${context.customerInfo.lastName}`,
      company_name: context.customerInfo.company,
      email: context.customerInfo.email
    });

  if (error) {
    console.error('Error saving report:', error);
    console.error('Summary values:', {
      current_cost: savingsAnalysis.summary.total_current_cost,
      optimized_cost: savingsAnalysis.summary.total_optimized_cost,
      savings: savingsAnalysis.summary.total_cost_savings
    });
    throw error;
  }
}

/**
 * Main handler
 */
Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { submissionId, _internal, _context } = body;
    
    // Handle internal self-invocation for chunking
    if (_internal && _context) {
      console.log('🔄 Internal chunked invocation detected');
      await processDocument(_context);
      return new Response(
        JSON.stringify({ success: true, status: 'chunk_processed' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!submissionId) {
      return new Response(
        JSON.stringify({ error: 'Missing submissionId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get submission details
    const { data: submission, error: submissionError } = await supabase
      .from('document_submissions')
      .select('*')
      .eq('id', submissionId)
      .single();

    if (submissionError || !submission) {
      return new Response(
        JSON.stringify({ error: 'Submission not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create processing job
    const { data: job, error: jobError } = await supabase
      .from('processing_jobs')
      .insert({
        submission_id: submissionId,
        status: 'processing',
        progress: 0,
        current_step: 'Initializing...',
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (jobError || !job) {
      throw new Error('Failed to create processing job');
    }

    // Build context
    const context: ProcessingContext = {
      submissionId,
      jobId: job.id,
      fileUrl: submission.file_url,
      fileName: submission.file_name,
      customerInfo: {
        firstName: submission.first_name,
        lastName: submission.last_name,
        company: submission.company,
        email: submission.email
      }
    };

    // Start processing (async - don't await)
    processDocument(context).catch(console.error);

    // Return immediately
    return new Response(
      JSON.stringify({
        success: true,
        processing_job_id: job.id,
        message: 'Processing started'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

