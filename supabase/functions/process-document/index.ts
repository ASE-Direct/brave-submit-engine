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

// ============================================================================
// NORMALIZATION HELPERS (Battle-Tested Deterministic Approach)
// ============================================================================

/**
 * Normalize UOM to canonical values
 */
function normalizeUOM(uom?: string): 'EA' | 'BX' | 'CS' | 'PK' | 'CT' {
  if (!uom) return 'EA';
  
  const lower = uom.toLowerCase().trim();
  if (lower === 'ea' || lower === 'each') return 'EA';
  if (lower === 'bx' || lower === 'box') return 'BX';
  if (lower === 'cs' || lower === 'case') return 'CS';
  if (lower === 'pk' || lower === 'pack' || lower === 'package') return 'PK';
  if (lower === 'ct' || lower === 'carton') return 'CT';
  
  return 'EA'; // Default to each
}

/**
 * Normalize price to per-each basis (THE GOLDEN RULE)
 * You cannot compare prices until they're on the same basis.
 */
interface NormalizedPrice {
  pricePerEach: number;  // Price for a single unit
  quantityInEach: number; // Total quantity in "each" units
  packQty: number;        // Pack quantity used
  uomStd: string;         // Standardized UOM
}

function normalizePriceAndQuantity(
  price: number,
  quantity: number,
  packQty: number = 1,
  uom: string = 'EA'
): NormalizedPrice {
  const safePackQty = Math.max(packQty || 1, 1);
  const normalizedUom = normalizeUOM(uom);
  
  // Price per single unit (each)
  const pricePerEach = price / safePackQty;
  
  // Total quantity in "each" units
  // If buying in packs/boxes, multiply quantity by pack size
  const quantityInEach = normalizedUom === 'EA' 
    ? quantity 
    : quantity * safePackQty;
  
  return {
    pricePerEach,
    quantityInEach,
    packQty: safePackQty,
    uomStd: normalizedUom
  };
}

/**
 * Calculate Cost Per Page (CPP) - Key metric for toner/ink optimization
 */
function calculateCostPerPage(pricePerEach: number, pageYield: number): number | null {
  if (!pageYield || pageYield <= 0) return null;
  if (!pricePerEach || pricePerEach <= 0) return null;
  
  return pricePerEach / pageYield;
}

/**
 * Determine yield rank for comparison (higher is better)
 */
function yieldRank(yieldClass?: string): number {
  const ranks: Record<string, number> = {
    'standard': 1,
    'high': 2,
    'extra_high': 3,
    'super_high': 4
  };
  
  return ranks[yieldClass || 'standard'] || 1;
}

// ============================================================================
// HIGHER-YIELD OPTIMIZATION (Battle-Tested CPP-Based Recommendations)
// ============================================================================

interface VolumeHints {
  monthlyPages?: number;
  horizonMonths?: number;
}

interface HigherYieldRecommendation {
  recommended: any; // Recommended product
  recommendedPrice: number; // Price per unit (ase_unit_price or unit_price)
  cppCurrent: number; // Cost per page of current
  cppRecommended: number; // Cost per page of recommended
  est12moSavingsAtVolume: number; // Estimated 12-month savings
  quantityNeeded: number; // How many of recommended product
  reason: string; // Explanation
}

/**
 * Suggest higher-yield alternative within same product family
 * 
 * This implements the battle-tested approach:
 * 1. Find products in same family_series + color
 * 2. Filter to equal or higher yield_class
 * 3. Calculate CPP (cost per page) for each
 * 4. Recommend lowest CPP with material savings
 */
async function suggestHigherYield(
  currentProduct: any,
  userQuantity: number,
  userUnitPrice: number,
  volume: VolumeHints = { monthlyPages: 1000, horizonMonths: 12 }
): Promise<HigherYieldRecommendation | null> {
  // Validate we have required data
  if (!currentProduct.family_series) {
    console.log('    ⊘ No family_series for optimization');
    return null;
  }
  
  if (!currentProduct.page_yield || currentProduct.page_yield <= 0) {
    console.log('    ⊘ No page_yield for CPP calculation');
    return null;
  }
  
  // Check BOTH ase_unit_price and unit_price (use either), FALLBACK to cost
  const currentAsePrice = (currentProduct.ase_unit_price && currentProduct.ase_unit_price > 0)
    ? currentProduct.ase_unit_price
    : (currentProduct.unit_price && currentProduct.unit_price > 0)
      ? currentProduct.unit_price
      : currentProduct.cost;
    
  if (!currentAsePrice || currentAsePrice <= 0) {
    console.log('    ⊘ No ase_unit_price, unit_price, or cost for comparison');
    return null;
  }
  
  // Calculate volume for comparison
  const pages = (volume.monthlyPages ?? 1000) * (volume.horizonMonths ?? 12);
  
  // Get family peers (same family_series, same color, equal or higher yield)
  const { data: familyProducts, error } = await supabase
    .from('master_products')
    .select('*')
    .eq('family_series', currentProduct.family_series)
    .eq('active', true)
    .not('page_yield', 'is', null)
    .gte('page_yield', currentProduct.page_yield * 0.8); // Allow slightly lower yield for edge cases
  // Note: Not filtering by price here - we'll filter in JS to check both ase_unit_price and unit_price
  
  if (error || !familyProducts || familyProducts.length === 0) {
    console.log('    ⊘ No family alternatives found');
    return null;
  }
  
  // Filter by color match (strict for toner/ink)
  const sameColorFamily = familyProducts.filter(p => {
    // Must match color
    if (currentProduct.color_type && p.color_type !== currentProduct.color_type) {
      return false;
    }
    
    // Must be equal or higher yield class
    if (yieldRank(p.yield_class) < yieldRank(currentProduct.yield_class)) {
      return false;
    }
    
    // Must have valid pricing (check BOTH fields, FALLBACK to cost)
    const hasPrice = (p.ase_unit_price && p.ase_unit_price > 0) || (p.unit_price && p.unit_price > 0) || (p.cost && p.cost > 0);
    if (!hasPrice) {
      return false;
    }
    
    if (!p.page_yield || p.page_yield <= 0) {
      return false;
    }
    
    return true;
  });
  
  if (sameColorFamily.length === 0) {
    console.log('    ⊘ No matching color family alternatives');
    return null;
  }
  
  // Calculate CPP for each candidate
  const currentCPP = calculateCostPerPage(currentAsePrice, currentProduct.page_yield);
  
  if (!currentCPP) {
    console.log('    ⊘ Cannot calculate CPP for current product');
    return null;
  }
  
  // Rank by CPP (lowest is best)
  const ranked = sameColorFamily
    .map(p => {
      // Use whichever price field is available, FALLBACK to cost
      const pPrice = (p.ase_unit_price && p.ase_unit_price > 0) ? p.ase_unit_price : (p.unit_price && p.unit_price > 0) ? p.unit_price : p.cost;
      const cpp = calculateCostPerPage(pPrice, p.page_yield);
      if (!cpp) return null;
      
      const periodCost = cpp * pages;
      const savingsPerYear = (currentCPP - cpp) * pages;
      
      return { 
        product: p, 
        cpp, 
        periodCost,
        savingsPerYear
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => a.cpp - b.cpp);
  
  if (ranked.length === 0) {
    return null;
  }
  
  const best = ranked[0];
  
  // Only recommend if:
  // 1. It's a different product
  // 2. It has materially better CPP (at least 5% savings)
  // 3. Savings are meaningful (>$5/year)
  const cppSavingsPct = ((currentCPP - best.cpp) / currentCPP) * 100;
  
  if (best.product.id === currentProduct.id) {
    return null; // Same product
  }
  
  if (best.cpp >= currentCPP * 0.95) {
    console.log(`    ⊘ CPP not materially better: ${best.cpp.toFixed(4)} vs ${currentCPP.toFixed(4)}`);
    return null; // Not enough savings (<5%)
  }
  
  if (best.savingsPerYear < 5) {
    console.log(`    ⊘ Savings too small: $${best.savingsPerYear.toFixed(2)}/year`);
    return null; // Savings too small
  }
  
  // Calculate how many units needed to meet user's volume
  const userTotalPages = userQuantity * currentProduct.page_yield;
  const quantityNeeded = Math.ceil(userTotalPages / best.product.page_yield);
  
  // Calculate actual savings based on user's current spending
  const userCurrentCost = userQuantity * userUnitPrice;
  // Use whichever price field is available for the recommended product, FALLBACK to cost
  const recommendedPrice = (best.product.ase_unit_price && best.product.ase_unit_price > 0) 
    ? best.product.ase_unit_price 
    : (best.product.unit_price && best.product.unit_price > 0)
      ? best.product.unit_price
      : best.product.cost;
  const recommendedCost = quantityNeeded * recommendedPrice;
  const actualSavings = userCurrentCost - recommendedCost;
  
  // Only recommend if there are actual dollar savings
  if (actualSavings <= 0) {
    console.log(`    ⊘ No actual savings: user pays $${userCurrentCost.toFixed(2)}, recommended $${recommendedCost.toFixed(2)}`);
    return null;
  }
  
  const cartridgesSaved = userQuantity - quantityNeeded;
  
  return {
    recommended: best.product,
    recommendedPrice, // Include the price we calculated
    cppCurrent: currentCPP,
    cppRecommended: best.cpp,
    est12moSavingsAtVolume: best.savingsPerYear,
    quantityNeeded,
    reason: `Switch to ${best.product.yield_class?.toUpperCase() || 'High Yield'} ${best.product.product_name} ` +
            `(${best.product.page_yield.toLocaleString()} pages vs ${currentProduct.page_yield.toLocaleString()} pages). ` +
            `Cost per page: $${best.cpp.toFixed(4)} vs current $${currentCPP.toFixed(4)} ` +
            `(${cppSavingsPct.toFixed(1)}% better). ` +
            `Saves ${cartridgesSaved} cartridge${cartridgesSaved !== 1 ? 's' : ''} and $${actualSavings.toFixed(2)} ` +
            `(${((actualSavings / userCurrentCost) * 100).toFixed(1)}% savings).`
  };
}

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

// ============================================================================
// ENHANCED DATA STRUCTURES FOR IMPROVED PROCESSING
// ============================================================================

/**
 * Enhanced extracted item with comprehensive SKU tracking
 */
interface EnhancedExtractedItem {
  rowNumber: number;
  raw_product_name: string;
  raw_description: string;
  raw_sku: string | null;
  
  // ALL SKU fields found (not just primary)
  sku_fields: {
    primary_sku?: string;
    oem_number?: string;
    wholesaler_code?: string;
    staples_sku?: string;
    depot_code?: string;
    all_skus: string[]; // Combined array for matching
  };
  
  quantity: number;
  unit_price: number;
  total_price: number;
  uom?: string;
  
  // Data quality tracking
  extraction_quality: {
    has_sku: boolean;
    has_price: boolean;
    has_quantity: boolean;
    has_description: boolean;
    confidence: number; // 0-1
  };
}

/**
 * Match attempt logging for transparency
 */
interface MatchAttempt {
  method: string;
  attempted_value?: string;
  score: number;
  product_id?: string;
  timestamp: Date;
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
  const CHUNK_SIZE = 100; // Process 100 items per chunk (safe for timeout with semantic search + savings calc)
  
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
          ase_unit_price,
          list_price,
          cost,
          family_series,
          yield_class,
          pack_quantity,
          uom,
          active,
          wholesaler_sku,
          oem_number,
          staples_sku,
          depot_sku
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
  
  console.log(`\n📦 Processing chunk ${chunkIndex + 1}: items ${startIdx + 1}-${endIdx} of ${allItems.length}`);
  
  // ENHANCEMENT: Validate extraction quality (only on first chunk)
  if (chunkIndex === 0) {
    const extractionValidation = validateExtraction(chunk);
    console.log(`📋 Extraction validation: ${extractionValidation.quality}`);
    
    // Store validation in job metadata (optional - for tracking)
    try {
      await supabase
        .from('processing_jobs')
        .update({
          metadata: {
            extraction_validation: extractionValidation,
            updated_at: new Date().toISOString()
          }
        })
        .eq('id', context.jobId);
    } catch (err) {
      console.error('Failed to store extraction validation:', err);
    }
  }
  
  // Match products in this chunk
  const matchedChunk = await matchProducts(chunk, context.jobId, startIdx);
  
  // ENHANCEMENT: Validate matching quality
  const matchingValidation = validateMatching(matchedChunk);
  console.log(`📋 Matching validation: ${matchingValidation.quality}`);
  
  // If quality is poor, log warning
  if (matchingValidation.quality === 'poor') {
    console.warn(`⚠️  Poor matching quality detected - consider manual review`);
  }
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
    
    console.log(`📊 Available sheets: ${workbook.SheetNames.join(', ')}`);
    
    // Find the sheet with the most data
    let bestSheet = workbook.SheetNames[0];
    let maxRows = 0;
    
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false, raw: false });
      const rowCount = data.length;
      console.log(`   "${sheetName}": ${rowCount} rows`);
      
      if (rowCount > maxRows) {
        maxRows = rowCount;
        bestSheet = sheetName;
      }
    }
    
    console.log(`📊 Using sheet with most data: "${bestSheet}" (${maxRows} rows)`);
    const worksheet = workbook.Sheets[bestSheet];
    
    // Convert to array of arrays - keep all values as strings
    const rawData = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1,  // Return array of arrays
      defval: '',  // Default value for empty cells
      blankrows: false,  // Skip blank rows
      raw: false  // Don't convert dates/numbers - keep as formatted strings
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

  // Normalize headers: convert empty strings to unique column names to prevent key collisions
  const normalizedHeaders = headers.map((h, idx) => {
    if (h.trim() === '') {
      return `__COL_${idx}__`;
    }
    return h;
  });
  
  console.log(`📊 Original headers: ${JSON.stringify(headers)}`);
  if (normalizedHeaders.some((h, idx) => h !== headers[idx])) {
    console.log(`📊 Normalized headers: ${JSON.stringify(normalizedHeaders)}`);
  }
  
  // Convert all rows to objects using normalized headers
  const rowObjects: Record<string, string>[] = [];
  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const values = rows[rowIdx];
    if (!values || values.length === 0) continue;
    
    const row: Record<string, string> = {};
    normalizedHeaders.forEach((header, index) => {
      row[header] = values[index]?.toString() || '';
    });
    rowObjects.push(row);
  }
  
  // Intelligent column type detection (analyzes data patterns for unlabeled columns)
  // Check for: empty strings, __EMPTY, Column_1, __COL_X__, etc.
  const hasGenericHeaders = normalizedHeaders.some(h => {
    const trimmed = h.trim();
    return /^(Column_\d+|__EMPTY(_\d+)?|__COL_\d+__)$/i.test(trimmed);
  });
  let detectedCols: ReturnType<typeof detectColumnTypes> | undefined;
  
  if (hasGenericHeaders) {
    console.log('🔍 Detected generic/unlabeled column names - analyzing data patterns...');
    detectedCols = detectColumnTypes(rowObjects, normalizedHeaders);
    console.log('✓ Intelligent column detection results:');
    console.log(`   Price column: ${detectedCols.priceCol || 'not detected'}`);
    console.log(`   Quantity column: ${detectedCols.qtyCol || 'not detected'}`);
    console.log(`   Product name column: ${detectedCols.productNameCol || 'not detected'}`);
    console.log(`   SKU columns (${detectedCols.skuCols.length}): ${detectedCols.skuCols.join(', ') || 'none'}`);
  }

  // Extract product information from rows
  const items: any[] = [];
  for (let rowIdx = 0; rowIdx < rowObjects.length; rowIdx++) {
    const row = rowObjects[rowIdx];
    
    // Extract product information with intelligent column detection
    // Pass rowIdx + 1 for human-readable row numbers (1-based)
    const item = extractProductInfo(row, normalizedHeaders, rowIdx + 1, detectedCols);
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
  console.log(`🔍 Header detection: analyzing ${Math.min(rows.length, 20)} rows...`);
  
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i];
    if (!row || row.length === 0) {
      console.log(`   Row ${i + 1}: empty, skipping`);
      continue;
    }
    
    // Convert row cells to individual lowercase strings for matching
    const cellsLower = row.map((cell: any) => String(cell || '').toLowerCase().trim());
    
    // Look for common column headers - be flexible with matching
    const dataIndicators = [
      'date', 'sku', 'oem', 'item', 'product', 'description', 'desc',
      'quantity', 'qty', 'price', 'cost', 'amount', 'total',
      'part', 'number', 'model', 'uom', 'name', 'po', 'order'
    ];
    
    // Check how many cells contain these indicators
    const matchCount = cellsLower.filter(cell => 
      dataIndicators.some(indicator => cell === indicator || cell.includes(indicator))
    ).length;
    
    console.log(`   Row ${i + 1}: ${matchCount} header keywords found, first 8: [${row.slice(0, 8).join(', ')}]`);
    
    // If we find 2+ header keywords, it's likely a header row (regardless of numeric content)
    // Lowered from 3 to 2 to handle files with minimal but clear headers like "Part Number, Description"
    if (matchCount >= 2) {
      console.log(`✓ Found data header at row ${i + 1} (${matchCount} header keywords)`);
      const headers = row.map((cell: any) => cell?.toString().trim() || '');
      console.log(`📍 Headers: ${JSON.stringify(headers.slice(0, 10))}`);
      return { headers, headerIndex: i };
    }
  }
  
  // Fallback: No headers found, use first data row and create synthetic column names
  console.log('⚠️ No header keywords found - file may not have headers');
  
  // Use first row with data
  const firstDataRow = rows.find(r => r && r.filter((c: any) => String(c || '').trim().length > 0).length >= 3);
  
  if (firstDataRow) {
    const numCols = firstDataRow.length;
    // Create synthetic headers based on common patterns: Col1, Col2, etc.
    const syntheticHeaders = Array.from({ length: numCols }, (_, i) => `Column_${i + 1}`);
    console.log(`📍 Creating synthetic headers for ${numCols} columns: ${JSON.stringify(syntheticHeaders.slice(0, 10))}`);
    console.log(`📍 First data row: ${JSON.stringify(firstDataRow.slice(0, 10))}`);
    
    // Return with headerIndex: -1 to indicate no actual header row (start from row 0)
    return { headers: syntheticHeaders, headerIndex: -1 };
  }
  
  // Last resort: use first row as both headers and data 
  const firstRow = rows[0] || [];
  const headers = firstRow.map((cell: any) => cell?.toString().trim() || `Column_${rows[0].indexOf(cell) + 1}`);
  console.log(`📍 Last resort - using first row: ${JSON.stringify(headers.slice(0, 10))}`);
  return { headers, headerIndex: -1 };
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
 * Intelligently detect column types by analyzing data patterns across sample rows
 * This handles documents with missing/generic headers like __EMPTY, Column_1, etc.
 */
function detectColumnTypes(rows: Record<string, string>[], headers: string[]): {
  priceCol: string | undefined;
  qtyCol: string | undefined;
  productNameCol: string | undefined;
  skuCols: string[];
} {
  const sampleSize = Math.min(10, rows.length);
  const sample = rows.slice(0, sampleSize);
  
  const analysis: Record<string, {
    numeric: number;
    avgValue: number;
    hasDecimals: number;
    hasText: number;
    avgLength: number;
    hasDollarSign: number;
    looksLikeSku: number;
    looksLikeDescription: number;
  }> = {};
  
  // Analyze each column
  headers.forEach(header => {
    const values = sample.map(r => String(r[header] || '')).filter(v => v.trim().length > 0);
    if (values.length === 0) {
      analysis[header] = { numeric: 0, avgValue: 0, hasDecimals: 0, hasText: 0, avgLength: 0, hasDollarSign: 0, looksLikeSku: 0, looksLikeDescription: 0 };
      return;
    }
    
    let numericCount = 0;
    let totalValue = 0;
    let decimalCount = 0;
    let textCount = 0;
    let totalLength = 0;
    let dollarCount = 0;
    let skuLikeCount = 0;
    let descLikeCount = 0;
    
    values.forEach(val => {
      const trimmed = val.trim();
      totalLength += trimmed.length;
      
      // Check if numeric
      const cleaned = trimmed.replace(/[$,]/g, '');
      const num = parseFloat(cleaned);
      if (!isNaN(num) && trimmed.replace(/[0-9.,$ ]/g, '').length < 3) {
        numericCount++;
        totalValue += num;
        if (cleaned.includes('.')) decimalCount++;
      }
      
      // Check for dollar sign
      if (trimmed.includes('$')) dollarCount++;
      
      // Check if text-heavy
      if (/[a-z]/i.test(trimmed)) textCount++;
      
      // SKU-like: 3-30 chars, mix of letters and numbers, no spaces or few spaces
      if (trimmed.length >= 3 && trimmed.length <= 30 && 
          /[a-z]/i.test(trimmed) && /\d/.test(trimmed) && 
          trimmed.split(' ').length <= 2) {
        skuLikeCount++;
      }
      
      // Description-like: long text with spaces
      if (trimmed.length > 20 && trimmed.split(' ').length >= 3) {
        descLikeCount++;
      }
    });
    
    analysis[header] = {
      numeric: numericCount / values.length,
      avgValue: totalValue / numericCount || 0,
      hasDecimals: decimalCount / values.length,
      hasText: textCount / values.length,
      avgLength: totalLength / values.length,
      hasDollarSign: dollarCount / values.length,
      looksLikeSku: skuLikeCount / values.length,
      looksLikeDescription: descLikeCount / values.length
    };
  });
  
  // Detect price column: numeric, often has decimals, avg value in price range (1-500), may have $
  let priceCol = headers.find(h => {
    const a = analysis[h];
    return a.numeric > 0.7 && a.avgValue > 1 && a.avgValue < 1000 && (a.hasDecimals > 0.3 || a.hasDollarSign > 0);
  });
  
  // Detect quantity column: numeric, low avg value (1-100), rarely decimals
  let qtyCol = headers.find(h => {
    if (h === priceCol) return false; // Don't reuse price column
    const a = analysis[h];
    return a.numeric > 0.7 && a.avgValue >= 1 && a.avgValue <= 1000 && a.hasDecimals < 0.3;
  });
  
  // Detect product name/description: long text with spaces
  let productNameCol = headers.find(h => {
    const a = analysis[h];
    return a.looksLikeDescription > 0.5 || (a.hasText > 0.7 && a.avgLength > 20);
  });
  
  // Detect SKU columns: alphanumeric, medium length, few spaces
  const skuCols = headers.filter(h => {
    if (h === priceCol || h === qtyCol || h === productNameCol) return false;
    const a = analysis[h];
    return a.looksLikeSku > 0.3 || (a.hasText > 0.5 && a.avgLength >= 3 && a.avgLength <= 30);
  });
  
  return { priceCol, qtyCol, productNameCol, skuCols };
}

/**
 * ENHANCED: Extract product info from row with comprehensive multi-column detection
 * 
 * Key improvements:
 * - Detects ALL SKU columns (OEM, Wholesaler, Staples, Depot, Generic)
 * - More lenient validation (extracts items even without prices)
 * - Comprehensive logging with confidence scoring
 * - Data quality tracking per item
 */
function extractProductInfo(row: Record<string, string>, headers: string[], rowNumber: number = 0, detectedCols?: ReturnType<typeof detectColumnTypes>) {
  // Check if we're using synthetic/generic headers (__COL_X__, __EMPTY, Column_1, etc.)
  const usingSyntheticHeaders = headers.some(h => {
    const trimmed = h.trim();
    return /^(Column_\d+|__EMPTY(_\d+)?|__COL_\d+__)$/i.test(trimmed);
  });
  
  let productNameCol, qtyCol, priceCol;
  let skuColumnMap: Record<string, string> = {};
  
  // Use intelligent column detection if provided (for unlabeled columns)
  if (detectedCols) {
    priceCol = detectedCols.priceCol;
    qtyCol = detectedCols.qtyCol;
    productNameCol = detectedCols.productNameCol;
    detectedCols.skuCols.forEach((col, idx) => {
      skuColumnMap[`detected_${idx}`] = col;
    });
  } else if (usingSyntheticHeaders) {
    // Fallback: Position-based detection on this single row
    const values = headers.map(h => row[h]);
    
    const skuIdx = values.findIndex(v => {
      const s = String(v || '').trim();
      return s.length >= 3 && s.length <= 20 && /[A-Z]/i.test(s) && (/\d/.test(s) || /^M-/.test(s));
    });
    
    const descIdx = values.findIndex(v => {
      const s = String(v || '').trim();
      return s.length > 15 && /\s/.test(s);
    });
    
    const qtyIdx = values.findIndex(v => {
      const s = String(v || '').trim();
      const num = parseFloat(s.replace(/[^0-9.]/g, ''));
      return !isNaN(num) && num > 0 && num < 10000 && s.length <= 6;
    });
    
    const priceIdx = values.findIndex((v, i) => {
      if (i === qtyIdx) return false;
      const s = String(v || '').trim();
      return /\$|\./.test(s) || (parseFloat(s.replace(/[^0-9.]/g, '')) > 10);
    });
    
    if (skuIdx >= 0) skuColumnMap['primary'] = headers[skuIdx];
    if (descIdx >= 0) productNameCol = headers[descIdx];
    if (qtyIdx >= 0) qtyCol = headers[qtyIdx];
    if (priceIdx >= 0) priceCol = headers[priceIdx];
  }
  
  // ======================================================================
  // ENHANCEMENT: Comprehensive column mapping
  // ======================================================================
  
  if (!productNameCol) {
    productNameCol = headers.find(h => 
      /product\s*description|item\s*description|product\s*name/i.test(h)
    ) || headers.find(h => 
      /^description$/i.test(h.trim()) || /^item$/i.test(h.trim()) || /^product$/i.test(h.trim())
    );
  }
  
  // IMPROVED: Detect ALL SKU-like columns (not just first match)
  const oemCol = headers.find(h => /oem|part\s*number|part\s*#|mfg.*part/i.test(h));
  const wholesalerCol = headers.find(h => /wholesaler.*product.*code|wholesaler.*code/i.test(h));
  const staplesSkuCol = headers.find(h => /staples.*sku|staples.*item/i.test(h));
  const depotCol = headers.find(h => /depot.*product.*code|depot.*code/i.test(h));
  const genericSkuCol = headers.find(h => /^sku$/i.test(h.trim()) || /^item.*number$/i.test(h.trim()) || /catalog/i.test(h));
  
  if (oemCol) skuColumnMap['oem'] = oemCol;
  if (wholesalerCol) skuColumnMap['wholesaler'] = wholesalerCol;
  if (staplesSkuCol) skuColumnMap['staples'] = staplesSkuCol;
  if (depotCol) skuColumnMap['depot'] = depotCol;
  if (genericSkuCol) skuColumnMap['generic'] = genericSkuCol;
  
  if (!qtyCol) {
    qtyCol = headers.find(h => {
      const lower = h.toLowerCase().trim();
      // Exact matches (case-insensitive)
      if (lower === 'qty' || lower === 'quantity' || lower === 'qty sold' || lower === 'quantity sold') return true;
      // Exclude UOM columns
      if (/sell\s*uom|in\s*sell/i.test(h)) return false;
      // Pattern matches
      return /^qty|^quantity|qty\s*sold|quantity\s*sold/i.test(lower);
    });
  }
  
  if (!priceCol) {
    priceCol = headers.find(h => {
      const lower = h.toLowerCase().trim();
      // Exact matches (case-insensitive)
      if (lower === 'sale' || lower === 'price' || lower === 'unit price' || lower === 'unit cost') return true;
      // ENHANCEMENT: Support various price column formats including "v2 Price", "current price", "customer price", etc.
      if (/v\d+\s*price|current\s*price|customer\s*price|your\s*price/i.test(h)) return true;
      // General pattern matches, excluding total/extended
      return /(unit\s*price|unit\s*cost|price|cost|amount|sale)/i.test(h) && !/total|extended|supplier\s*id/i.test(h);
    });
  }
  
  // Extract values
  const productName = productNameCol ? row[productNameCol]?.trim() : '';
  
  // ENHANCEMENT: Collect ALL SKU values
  const skuFields: any = {
    all_skus: []
  };
  
  if (oemCol && row[oemCol]) {
    skuFields.oem_number = row[oemCol].trim();
    skuFields.all_skus.push(row[oemCol].trim());
  }
  if (wholesalerCol && row[wholesalerCol]) {
    skuFields.wholesaler_code = row[wholesalerCol].trim();
    skuFields.all_skus.push(row[wholesalerCol].trim());
  }
  if (staplesSkuCol && row[staplesSkuCol]) {
    skuFields.staples_sku = row[staplesSkuCol].trim();
    skuFields.all_skus.push(row[staplesSkuCol].trim());
  }
  if (depotCol && row[depotCol]) {
    skuFields.depot_code = row[depotCol].trim();
    skuFields.all_skus.push(row[depotCol].trim());
  }
  if (genericSkuCol && row[genericSkuCol]) {
    skuFields.primary_sku = row[genericSkuCol].trim();
    if (!skuFields.all_skus.includes(row[genericSkuCol].trim())) {
      skuFields.all_skus.push(row[genericSkuCol].trim());
    }
  }
  
  // Primary SKU priority: OEM > Wholesaler > Staples > Depot > Generic
  const primarySku = skuFields.oem_number || 
                     skuFields.wholesaler_code || 
                     skuFields.staples_sku || 
                     skuFields.depot_code || 
                     skuFields.primary_sku || 
                     (skuFields.all_skus.length > 0 ? skuFields.all_skus[0] : null);
  
  // Remove duplicates from all_skus
  skuFields.all_skus = [...new Set(skuFields.all_skus)];
  
  // IMPROVED: More lenient validation - extract even with missing data
  if (!productName && skuFields.all_skus.length === 0) {
    return null;
  }
  
  // Skip obvious header/metadata rows
  if (productName && productName.length > 0 && 
      /^(account|customer|report|date|total|page|subtotal)/i.test(productName)) {
    return null;
  }
  
  // Extract quantity and price (with fallbacks)
  const quantityStr = qtyCol ? row[qtyCol]?.replace(/[^0-9.]/g, '') : '1';
  const priceStr = priceCol ? row[priceCol]?.replace(/[^0-9.]/g, '') : '0';
  
  let quantity = parseInt(quantityStr) || 1;
  let unitPrice = parseFloat(priceStr) || 0;
  
  // Data quality assessment
  const hasPrice = unitPrice > 0;
  const hasSku = skuFields.all_skus.length > 0;
  const hasDescription = productName.length > 0;
  const hasQuantity = quantity > 0;
  
  // Calculate extraction confidence
  let confidence = 0;
  if (hasDescription) confidence += 0.25;
  if (hasSku) confidence += 0.35;
  if (hasPrice) confidence += 0.25;
  if (hasQuantity) confidence += 0.15;
  
  // Log extraction details
  if (rowNumber > 0) {
    const displayName = productName || primarySku || 'Unknown';
    const skuCount = skuFields.all_skus.length;
    console.log(`   Row ${rowNumber}: ✓ "${displayName}" | SKUs: ${skuCount} | Qty: ${quantity} | Price: $${unitPrice.toFixed(2)} | Confidence: ${(confidence*100).toFixed(0)}%`);
    
    if (!hasPrice) {
      console.log(`      ⚠️ No price - will use fallback pricing`);
    }
  }
  
  // Sanity checks with warnings (but don't reject)
  if (quantity > 10000) {
    console.warn(`   Row ${rowNumber}: ⚠️ Very high quantity ${quantity} for ${productName}`);
  }
  
  if (unitPrice > 100000) {
    console.warn(`   Row ${rowNumber}: ⚠️ Very high price $${unitPrice} for ${productName}`);
  }
  
  // Calculate total
  const MAX_DECIMAL = 99999999.99;
  let totalPrice = quantity * unitPrice;
  if (totalPrice > MAX_DECIMAL) {
    totalPrice = MAX_DECIMAL;
  }
  
  return {
    rowNumber,
    raw_product_name: productName || 'Unknown Product',
    raw_sku: primarySku,
    raw_description: productName || primarySku || 'No description',
    sku_fields: skuFields,
    quantity,
    unit_price: unitPrice,
    total_price: totalPrice,
    uom: undefined,
    extraction_quality: {
      has_sku: hasSku,
      has_price: hasPrice,
      has_quantity: hasQuantity,
      has_description: hasDescription,
      confidence
    }
  };
}

/**
 * Match products to master catalog - OPTIMIZED FOR CHUNKED PROCESSING
 */
async function matchProducts(items: any[], jobId: string, startOffset = 0) {
  console.log(`🔍 Matching ${items.length} products (offset ${startOffset})...`);
  const BATCH_SIZE = 25; // Conservative batch size (25 concurrent operations for safety)
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
 * ENHANCED: Match a single product through comprehensive multi-tier matching
 * 
 * Key improvements:
 * - Tries ALL available SKU fields (not just one)
 * - 6-tier matching strategy (exact, fuzzy, combined, full-text, semantic, AI)
 * - Detailed logging with timing metrics
 * - Match attempt tracking for debugging
 */
async function matchSingleProduct(item: any, index: number, total: number) {
  const startTime = Date.now();
  const matchLog: MatchAttempt[] = [];
  
  const displayName = item.raw_product_name || item.raw_sku || 'Unknown';
  console.log(`\n  🔍 [${index}/${total}] Matching: "${displayName}"`);
  
  // Log available SKUs
  if (item.sku_fields && item.sku_fields.all_skus && item.sku_fields.all_skus.length > 0) {
    console.log(`     Available SKUs: [${item.sku_fields.all_skus.join(', ')}]`);
  }
  
  // Log extraction quality
  if (item.extraction_quality) {
    console.log(`     Extraction confidence: ${(item.extraction_quality.confidence * 100).toFixed(0)}%`);
  }

  let bestMatch: { product: any; score: number; method: string } | null = null;
  
  // ======================================================================
  // TIER 1: Exact SKU match on ALL available SKU fields
  // ======================================================================
  if (item.sku_fields && item.sku_fields.all_skus && item.sku_fields.all_skus.length > 0) {
    console.log(`     🎯 TIER 1: Trying exact match on ${item.sku_fields.all_skus.length} SKUs...`);
    
    for (let i = 0; i < item.sku_fields.all_skus.length; i++) {
      const sku = item.sku_fields.all_skus[i];
      if (!sku || sku.length < 2) continue;
      
      const match = await exactSKUMatch(sku);
      matchLog.push({
        method: 'exact_sku',
        attempted_value: sku,
        score: match ? match.score : 0,
        product_id: match?.product?.id,
        timestamp: new Date()
      });
      
      if (match) {
        console.log(`        ✅ Exact match on SKU #${i+1} "${sku}": ${match.product.product_name}`);
        bestMatch = match;
        break; // Found exact match, stop searching
      }
    }
    
    if (bestMatch && bestMatch.score === 1.0) {
      const duration = Date.now() - startTime;
      console.log(`     ✅ MATCHED (exact_sku) in ${duration}ms | Score: 1.00`);
      return {
        ...item,
        matched_product: bestMatch.product,
        match_score: bestMatch.score,
        match_method: bestMatch.method,
        match_attempts: matchLog.length,
        match_duration_ms: duration
      };
    }
  }
  
  // ======================================================================
  // TIER 2: Fuzzy SKU match on ALL available SKU fields
  // ======================================================================
  if (item.sku_fields && item.sku_fields.all_skus && item.sku_fields.all_skus.length > 0) {
    console.log(`     🎯 TIER 2: Trying fuzzy match on ${item.sku_fields.all_skus.length} SKUs...`);
    
    for (const sku of item.sku_fields.all_skus) {
      if (!sku || sku.length < 2) continue;
      
      const match = await fuzzySKUMatch(sku);
      matchLog.push({
        method: 'fuzzy_sku',
        attempted_value: sku,
        score: match ? match.score : 0,
        product_id: match?.product?.id,
        timestamp: new Date()
      });
      
      if (match && (!bestMatch || match.score > bestMatch.score)) {
        console.log(`        ✅ Fuzzy match on "${sku}": ${match.product.product_name} (score: ${match.score.toFixed(2)})`);
        bestMatch = match;
      }
    }
    
    if (bestMatch && bestMatch.score >= 0.90) {
      const duration = Date.now() - startTime;
      console.log(`     ✅ MATCHED (fuzzy_sku) in ${duration}ms | Score: ${bestMatch.score.toFixed(2)}`);
      return {
        ...item,
        matched_product: bestMatch.product,
        match_score: bestMatch.score,
        match_method: bestMatch.method,
        match_attempts: matchLog.length,
        match_duration_ms: duration
      };
    }
  }

  // ======================================================================
  // TIER 3: Combined SKU + Description search
  // ======================================================================
  if (item.sku_fields && item.sku_fields.all_skus.length > 0 && item.raw_product_name) {
    console.log(`     🎯 TIER 3: Trying combined SKU + description...`);
    
    for (const sku of item.sku_fields.all_skus) {
      const combinedSearch = `${sku} ${item.raw_product_name}`;
      const match = await fullTextSearch(combinedSearch);
      matchLog.push({
        method: 'combined_search',
        attempted_value: combinedSearch.substring(0, 50),
        score: match ? match.score : 0,
        product_id: match?.product?.id,
        timestamp: new Date()
      });
      
      if (match && (!bestMatch || match.score > bestMatch.score)) {
        console.log(`        ✅ Combined search: ${match.product.product_name} (score: ${match.score.toFixed(2)})`);
        bestMatch = match;
      }
    }
  }

  // ======================================================================
  // TIER 4: Full-text search on product name
  // ======================================================================
  if (!bestMatch || bestMatch.score < 0.85) {
    console.log(`     🎯 TIER 4: Trying full-text search...`);
    
    const match = await fullTextSearch(item.raw_product_name);
    matchLog.push({
      method: 'full_text',
      attempted_value: item.raw_product_name.substring(0, 50),
      score: match ? match.score : 0,
      product_id: match?.product?.id,
      timestamp: new Date()
    });
    
    if (match && (!bestMatch || match.score > bestMatch.score)) {
      console.log(`        ✅ Full-text match: ${match.product.product_name} (score: ${match.score.toFixed(2)})`);
      bestMatch = match;
    }
  }

  // ======================================================================
  // TIER 5: Semantic search
  // ======================================================================
  if (!bestMatch || bestMatch.score < 0.75) {
    console.log(`     🎯 TIER 5: Trying semantic search...`);
    
    const match = await semanticSearch(item.raw_product_name);
    matchLog.push({
      method: 'semantic',
      attempted_value: item.raw_product_name.substring(0, 50),
      score: match ? match.score : 0,
      product_id: match?.product?.id,
      timestamp: new Date()
    });
    
    if (match && (!bestMatch || match.score > bestMatch.score)) {
      console.log(`        ✅ Semantic match: ${match.product.product_name} (score: ${match.score.toFixed(2)})`);
      bestMatch = match;
    }
  }

  // ======================================================================
  // TIER 6: AI Agent (optional, for low-confidence items)
  // ======================================================================
  const useAIForLowConfidence = false; // Set to true to enable AI fallback
  
  if (useAIForLowConfidence && (!bestMatch || bestMatch.score < 0.65)) {
    console.log(`     🤖 TIER 6: Using AI agent (low confidence)...`);
    
    const match = await aiAgentMatch(item);
    matchLog.push({
      method: 'ai_agent',
      attempted_value: item.raw_product_name.substring(0, 50),
      score: match ? match.score : 0,
      product_id: match?.product?.id,
      timestamp: new Date()
    });
    
    if (match && (!bestMatch || match.score > bestMatch.score)) {
      console.log(`        ✅ AI match: ${match.product.product_name} (score: ${match.score.toFixed(2)})`);
      bestMatch = match;
    }
  }

  // ======================================================================
  // Final Result
  // ======================================================================
  const duration = Date.now() - startTime;
  
  if (bestMatch) {
    console.log(`     ✅ MATCHED in ${duration}ms | Method: ${bestMatch.method} | Score: ${bestMatch.score.toFixed(2)}`);
    console.log(`     📦 Product: ${bestMatch.product.product_name} (SKU: ${bestMatch.product.sku})`);
  } else {
    console.log(`     ❌ NO MATCH after ${matchLog.length} attempts in ${duration}ms`);
    console.log(`     💡 Consider manual review for: "${item.raw_product_name}"`);
  }

  return {
    ...item,
    matched_product: bestMatch?.product || null,
    match_score: bestMatch?.score || 0,
    match_method: bestMatch?.method || 'none',
    match_attempts: matchLog.length,
    match_duration_ms: duration,
    match_log: matchLog
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

    // Use gpt-4o-mini as specified by user requirements
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1, // Low temperature for consistent extraction
      max_completion_tokens: 200,
      response_format: { type: 'json_object' }
    });

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

  // ENHANCED: Search all SKU columns (primary SKU + vendor cross-references)
  const { data, error } = await supabase
    .from('master_products')
    .select('*')
    .or(`sku.eq.${cleanSku},oem_number.eq.${cleanSku},wholesaler_sku.eq.${cleanSku},staples_sku.eq.${cleanSku},depot_sku.eq.${cleanSku}`)
    .eq('active', true)
    .limit(1)
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
  let normalizedSku = sku.trim().toUpperCase().replace(/[\s\-_]/g, '');

  // Strip common manufacturer prefixes (M-, M-HEW, M-LEX, M-BRT, etc.)
  // These are OEM part number prefixes in user files
  const prefixPatterns = [
    /^MHEW/,  // M-HEW (HP)
    /^MLEX/,  // M-LEX (Lexmark)
    /^MBRT/,  // M-BRT (Brother)
    /^MCAN/,  // M-CAN (Canon)
    /^MEPS/,  // M-EPS (Epson)
    /^MXER/,  // M-XER (Xerox)
    /^M/      // Generic M- prefix (must be last)
  ];

  let strippedSku = normalizedSku;
  for (const pattern of prefixPatterns) {
    if (pattern.test(normalizedSku)) {
      strippedSku = normalizedSku.replace(pattern, '');
      break;
    }
  }

  // Try both original and stripped versions
  const skusToTry = [normalizedSku];
  if (strippedSku !== normalizedSku) {
    skusToTry.push(strippedSku);
  }

  for (const searchSku of skusToTry) {
    // ENHANCED: Try ILIKE search across all SKU columns
    const { data, error} = await supabase
      .from('master_products')
      .select('*')
      .or(`sku.ilike.%${searchSku}%,oem_number.ilike.%${searchSku}%,wholesaler_sku.ilike.%${searchSku}%,staples_sku.ilike.%${searchSku}%,depot_sku.ilike.%${searchSku}%`)
      .eq('active', true)
      .limit(5);

    if (!error && data && data.length > 0) {
      // Find best match by comparing normalized SKUs across all SKU fields
      for (const product of data) {
        const productSkus = [
          product.sku,
          product.oem_number,
          product.wholesaler_sku,
          product.staples_sku,
          product.depot_sku
        ].filter(Boolean); // Remove null/undefined
        
        for (const productSku of productSkus) {
          const productSkuNorm = productSku.toUpperCase().replace(/[\s\-_]/g, '');
          if (productSkuNorm === searchSku) {
            return {
              product,
              score: 0.95,
              method: 'fuzzy_sku'
            };
          }
        }
      }
      
      // Return first partial match if no exact normalized match
      return {
        product: data[0],
        score: 0.85,
        method: 'fuzzy_sku'
      };
    }
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

// ============================================================================
// QUALITY VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate extraction quality with comprehensive metrics
 */
function validateExtraction(items: any[]): {
  quality: 'excellent' | 'good' | 'acceptable' | 'poor';
  metrics: any;
  warnings: string[];
} {
  const warnings: string[] = [];
  
  const totalItems = items.length;
  const itemsWithName = items.filter(i => i.raw_product_name && i.raw_product_name.length > 2).length;
  const itemsWithSku = items.filter(i => i.sku_fields && i.sku_fields.all_skus && i.sku_fields.all_skus.length > 0).length;
  const itemsWithPrice = items.filter(i => i.unit_price > 0).length;
  const avgConfidence = items.reduce((sum, i) => sum + (i.extraction_quality?.confidence || 0), 0) / totalItems;
  
  // Assess quality
  let quality: 'excellent' | 'good' | 'acceptable' | 'poor';
  
  if (totalItems === 0) {
    quality = 'poor';
    warnings.push('No items extracted from document');
  } else if (itemsWithName < totalItems * 0.80) {
    quality = 'poor';
    warnings.push(`Only ${itemsWithName}/${totalItems} items have product names`);
  } else if (itemsWithSku < totalItems * 0.30) {
    quality = 'acceptable';
    warnings.push(`Only ${itemsWithSku}/${totalItems} items have SKU numbers`);
  } else if (itemsWithPrice < totalItems * 0.50) {
    quality = 'acceptable';
    warnings.push(`Only ${itemsWithPrice}/${totalItems} items have pricing data`);
  } else if (avgConfidence < 0.60) {
    quality = 'good';
    warnings.push(`Average extraction confidence is ${(avgConfidence * 100).toFixed(0)}%`);
  } else {
    quality = 'excellent';
  }
  
  const metrics = {
    total_items: totalItems,
    items_with_name: itemsWithName,
    items_with_sku: itemsWithSku,
    items_with_price: itemsWithPrice,
    avg_confidence: avgConfidence
  };
  
  console.log(`\n📊 Extraction Quality: ${quality.toUpperCase()}`);
  console.log(`   Total items: ${totalItems}`);
  console.log(`   With names: ${itemsWithName} (${(itemsWithName/totalItems*100).toFixed(0)}%)`);
  console.log(`   With SKUs: ${itemsWithSku} (${(itemsWithSku/totalItems*100).toFixed(0)}%)`);
  console.log(`   With prices: ${itemsWithPrice} (${(itemsWithPrice/totalItems*100).toFixed(0)}%)`);
  console.log(`   Avg confidence: ${(avgConfidence*100).toFixed(0)}%`);
  if (warnings.length > 0) {
    console.log(`   ⚠️  Warnings: ${warnings.join('; ')}`);
  }
  
  return { quality, metrics, warnings };
}

/**
 * Validate matching quality with comprehensive metrics
 */
function validateMatching(matchedItems: any[]): {
  quality: 'excellent' | 'good' | 'acceptable' | 'poor';
  metrics: any;
  warnings: string[];
} {
  const warnings: string[] = [];
  
  const totalItems = matchedItems.length;
  const itemsMatched = matchedItems.filter(i => i.matched_product).length;
  const matchRate = itemsMatched / totalItems;
  
  const exactMatches = matchedItems.filter(i => i.match_method === 'exact_sku').length;
  const fuzzyMatches = matchedItems.filter(i => i.match_method === 'fuzzy_sku').length;
  const semanticMatches = matchedItems.filter(i => i.match_method === 'semantic').length;
  const aiMatches = matchedItems.filter(i => i.match_method === 'ai_suggested').length;
  
  const highConfidence = matchedItems.filter(i => i.match_score >= 0.90).length;
  const mediumConfidence = matchedItems.filter(i => i.match_score >= 0.70 && i.match_score < 0.90).length;
  const lowConfidence = matchedItems.filter(i => i.match_score > 0 && i.match_score < 0.70).length;
  
  const avgScore = matchedItems
    .filter(i => i.match_score > 0)
    .reduce((sum, i) => sum + i.match_score, 0) / itemsMatched || 0;
  
  // Assess quality
  let quality: 'excellent' | 'good' | 'acceptable' | 'poor';
  
  if (matchRate < 0.50) {
    quality = 'poor';
    warnings.push(`Low match rate: ${(matchRate * 100).toFixed(0)}%`);
  } else if (matchRate < 0.75) {
    quality = 'acceptable';
    warnings.push(`Match rate could be better: ${(matchRate * 100).toFixed(0)}%`);
  } else if (highConfidence < itemsMatched * 0.60) {
    quality = 'good';
    warnings.push(`Only ${(highConfidence/itemsMatched*100).toFixed(0)}% high-confidence matches`);
  } else {
    quality = 'excellent';
  }
  
  const metrics = {
    total_items: totalItems,
    items_matched: itemsMatched,
    match_rate: matchRate,
    exact_matches: exactMatches,
    fuzzy_matches: fuzzyMatches,
    semantic_matches: semanticMatches,
    ai_matches: aiMatches,
    high_confidence: highConfidence,
    medium_confidence: mediumConfidence,
    low_confidence: lowConfidence,
    avg_score: avgScore
  };
  
  console.log(`\n📊 Matching Quality: ${quality.toUpperCase()}`);
  console.log(`   Match rate: ${itemsMatched}/${totalItems} (${(matchRate*100).toFixed(0)}%)`);
  console.log(`   Exact SKU: ${exactMatches}, Fuzzy: ${fuzzyMatches}, Semantic: ${semanticMatches}, AI: ${aiMatches}`);
  console.log(`   High conf: ${highConfidence}, Medium: ${mediumConfidence}, Low: ${lowConfidence}`);
  console.log(`   Avg score: ${(avgScore*100).toFixed(0)}%`);
  if (warnings.length > 0) {
    console.log(`   ⚠️  Warnings: ${warnings.join('; ')}`);
  }
  
  return { quality, metrics, warnings };
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
 * UPDATED: Uses normalized prices and CPP-based higher-yield optimization
 */
async function calculateSavings(matchedItems: any[], jobId: string) {
  console.log('💰 Calculating savings with CPP-based optimization...');

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
    // Check BOTH ase_unit_price and unit_price (they're usually the same, use either)
    // FALLBACK: Use cost if no ASE pricing available
    const hasAsePrice = (matchedProduct.ase_unit_price && matchedProduct.ase_unit_price > 0) ||
                        (matchedProduct.unit_price && matchedProduct.unit_price > 0) ||
                        (matchedProduct.cost && matchedProduct.cost > 0);
    const hasPageYield = matchedProduct.page_yield && matchedProduct.page_yield > 0;
    
    // Get the ASE price (use whichever field has a value, prioritize ase_unit_price > unit_price > cost)
    const asePrice = (matchedProduct.ase_unit_price && matchedProduct.ase_unit_price > 0) 
      ? matchedProduct.ase_unit_price 
      : (matchedProduct.unit_price && matchedProduct.unit_price > 0)
        ? matchedProduct.unit_price
        : matchedProduct.cost || 0;
    
    // FALLBACK PRICING LOGIC:
    // 1. Use user's price from their file (if provided)
    // 2. Fall back to catalog's list_price (partner list price)
    // 3. Fall back to ASE price * 1.35 (assume ~35% markup as typical retail)
    let effectiveUserPrice = item.unit_price && item.unit_price > 0 
      ? item.unit_price 
      : matchedProduct.list_price && matchedProduct.list_price > 0
        ? matchedProduct.list_price
        : asePrice * 1.35;
    
    const priceSource = item.unit_price > 0 
      ? 'user_file' 
      : matchedProduct.list_price > 0 
        ? 'partner_list_price'
        : 'estimated';
    
    // If no ASE price at all, we can't calculate any savings
    if (!hasAsePrice) {
      const currentCost = effectiveUserPrice * item.quantity;
      totalCurrentCost += currentCost;
      totalOptimizedCost += currentCost;
      
      breakdown.push({
        ...item,
        savings: 0,
        recommendation: 'No ASE pricing available'
      });
      itemsSkipped++;
      console.log(`  ⊘ Skipped (no ASE price): ${item.raw_product_name}`);
      continue;
    }

    // We have enough data - analyze this item
    itemsAnalyzed++;
    const currentCost = effectiveUserPrice * item.quantity;
    totalCurrentCost += currentCost;

    // Calculate CPP for matched product (using normalized ASE price) - only if we have page yield
    const matchedCPP = hasPageYield ? calculateCostPerPage(asePrice, matchedProduct.page_yield) : null;
    const userCPP = hasPageYield ? calculateCostPerPage(effectiveUserPrice, matchedProduct.page_yield) : null;
    
    console.log(`  📊 Analyzing: ${item.raw_product_name}`);
    console.log(`     User paying: $${effectiveUserPrice.toFixed(2)}/unit (${priceSource}), CPP: ${userCPP ? '$' + userCPP.toFixed(4) : 'N/A (no page yield)'}`);
    console.log(`     ASE price: $${asePrice}/unit${matchedProduct.page_yield ? ` (${matchedProduct.page_yield} pages)` : ''}, CPP: ${matchedCPP ? '$' + matchedCPP.toFixed(4) : 'N/A'}`);

    // STEP 1: Calculate basic price savings (same product, ASE price)
    const basicSavingsPerUnit = effectiveUserPrice - asePrice;
    const basicTotalSavings = basicSavingsPerUnit * item.quantity;
    const basicOptimizedCost = asePrice * item.quantity;

    console.log(`     💵 Basic savings (using ASE price): $${basicTotalSavings.toFixed(2)} ($${basicSavingsPerUnit.toFixed(2)}/unit)`);

    // STEP 2: Try to find higher-yield alternative (only if we have page yield data)
    let higherYieldRec: HigherYieldRecommendation | null = null;
    if (hasPageYield && matchedProduct.family_series) {
      higherYieldRec = await suggestHigherYield(
        matchedProduct,
        item.quantity,
        effectiveUserPrice,  // Use effective price (user price or fallback)
        { monthlyPages: 1000, horizonMonths: 12 }
      );
    }

    // STEP 3: Use whichever option gives better savings
    if (higherYieldRec !== null) {
      // Calculate actual savings using effective price (handles missing user prices)
      const userCurrentTotal = item.quantity * effectiveUserPrice;
      const optimizedCost = higherYieldRec.quantityNeeded * higherYieldRec.recommendedPrice;
      const higherYieldSavings = userCurrentTotal - optimizedCost;

      // Compare: higher-yield savings vs basic savings
      const useHigherYield = higherYieldSavings > basicTotalSavings;

      if (useHigherYield) {
        totalOptimizedCost += optimizedCost;
        totalSavings += higherYieldSavings;

        if (higherYieldSavings > 0) {
          itemsWithSavings++;
          console.log(`     💰 Higher-Yield Savings: $${higherYieldSavings.toFixed(2)} (${((higherYieldSavings/userCurrentTotal)*100).toFixed(1)}%) - BETTER than basic $${basicTotalSavings.toFixed(2)}`);
          console.log(`     📈 CPP improvement: $${higherYieldRec.cppCurrent.toFixed(4)} → $${higherYieldRec.cppRecommended.toFixed(4)}`);
        }

        // Environmental impact
        const cartridgesSavedHere = item.quantity - higherYieldRec.quantityNeeded;
        if (cartridgesSavedHere > 0) {
          cartridgesSaved += cartridgesSavedHere;
          const co2PerCartridge = matchedProduct.category === 'toner_cartridge' ? 5.2 : 2.5;
          co2Reduced += cartridgesSavedHere * co2PerCartridge;
        }

        // Update database with capped values
        const MAX_DECIMAL = 99999999.99;
        const capValue = (val: number) => Math.min(Math.max(val || 0, 0), MAX_DECIMAL);
        
        await supabase
          .from('order_items_extracted')
          .update({
            recommended_product_id: higherYieldRec.recommended.id,
            recommended_quantity: higherYieldRec.quantityNeeded,
            recommended_total_cost: capValue(optimizedCost),
            cost_savings: capValue(higherYieldSavings),
            cost_savings_percentage: Math.min(Math.max((higherYieldSavings / userCurrentTotal) * 100, 0), 100),
            savings_reason: higherYieldRec.reason.substring(0, 500),
            recommendation_type: 'larger_size',
            environmental_savings: {
              cartridges_saved: Math.max(0, cartridgesSavedHere),
              co2_reduced: Math.max(0, cartridgesSavedHere * (matchedProduct.category === 'toner_cartridge' ? 5.2 : 2.5))
            }
          })
          .eq('processing_job_id', jobId)
          .eq('raw_product_name', item.raw_product_name);

        breakdown.push({
          ...item,
          recommendation: {
            product: higherYieldRec.recommended,
            quantity: higherYieldRec.quantityNeeded,
            total_cost: optimizedCost,
            cartridges_saved: cartridgesSavedHere,
            cost_per_page: higherYieldRec.cppRecommended,
            reason: higherYieldRec.reason,
            type: 'larger_size'
          },
          savings: higherYieldSavings
        });
      } else {
        // Basic savings is better - use ASE price for same product
        totalOptimizedCost += basicOptimizedCost;
        totalSavings += basicTotalSavings;

        if (basicTotalSavings > 0) {
          itemsWithSavings++;
          console.log(`     💰 Using Basic Price Savings: $${basicTotalSavings.toFixed(2)} (${((basicTotalSavings/currentCost)*100).toFixed(1)}%) - BETTER than higher-yield $${higherYieldSavings.toFixed(2)}`);
        }

        // Update database with basic savings
        const MAX_DECIMAL = 99999999.99;
        const capValue = (val: number) => Math.min(Math.max(val || 0, 0), MAX_DECIMAL);
        
        await supabase
          .from('order_items_extracted')
          .update({
            recommended_product_id: matchedProduct.id, // Same product, just better price
            recommended_quantity: item.quantity,
            recommended_total_cost: capValue(basicOptimizedCost),
            cost_savings: capValue(basicTotalSavings),
            cost_savings_percentage: Math.min(Math.max((basicTotalSavings / currentCost) * 100, 0), 100),
            savings_reason: `Save $${basicSavingsPerUnit.toFixed(2)}/unit by purchasing at ASE price`,
            recommendation_type: 'better_price'
          })
          .eq('processing_job_id', jobId)
          .eq('raw_product_name', item.raw_product_name);

        breakdown.push({
          ...item,
          recommendation: {
            product: matchedProduct,
            quantity: item.quantity,
            total_cost: basicOptimizedCost,
            reason: `Same product at ASE price: $${asePrice.toFixed(2)}/unit (save $${basicSavingsPerUnit.toFixed(2)}/unit)`,
            type: 'better_price'
          },
          savings: basicTotalSavings
        });
      }
    } else {
      // No higher-yield option - use basic price savings (if any)
      if (basicTotalSavings > 0) {
        totalOptimizedCost += basicOptimizedCost;
        totalSavings += basicTotalSavings;
        itemsWithSavings++;

        console.log(`     💰 Basic Price Savings: $${basicTotalSavings.toFixed(2)} (${((basicTotalSavings/currentCost)*100).toFixed(1)}%)`);

        // Update database with basic savings
        const MAX_DECIMAL = 99999999.99;
        const capValue = (val: number) => Math.min(Math.max(val || 0, 0), MAX_DECIMAL);
        
        await supabase
          .from('order_items_extracted')
          .update({
            recommended_product_id: matchedProduct.id, // Same product, just better price
            recommended_quantity: item.quantity,
            recommended_total_cost: capValue(basicOptimizedCost),
            cost_savings: capValue(basicTotalSavings),
            cost_savings_percentage: Math.min(Math.max((basicTotalSavings / currentCost) * 100, 0), 100),
            savings_reason: `Save $${basicSavingsPerUnit.toFixed(2)}/unit by purchasing at ASE price`,
            recommendation_type: 'better_price'
          })
          .eq('processing_job_id', jobId)
          .eq('raw_product_name', item.raw_product_name);

        breakdown.push({
          ...item,
          recommendation: {
            product: matchedProduct,
            quantity: item.quantity,
            total_cost: basicOptimizedCost,
            reason: `Same product at ASE price: $${asePrice.toFixed(2)}/unit (save $${basicSavingsPerUnit.toFixed(2)}/unit)`,
            type: 'better_price'
          },
          savings: basicTotalSavings
        });
      } else {
        // No savings at all (user already paying at or below ASE price)
        totalOptimizedCost += currentCost;
        breakdown.push({
          ...item,
          savings: 0,
          recommendation: 'Already at or below ASE price'
        });
        console.log(`     ✓ Already at or below ASE price (no savings possible)`);
      }
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

// OLD FUNCTION REMOVED: findBetterAlternative and calculateSavingsForAlternative
// These have been replaced by suggestHigherYield() which uses
// the battle-tested CPP-based family matching approach

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
            wholesaler_sku: item.matched_product?.wholesaler_sku || null,
            quantity: item.quantity || 0,
            unit_price: item.unit_price || 0,
            total_cost: item.total_price || 0
          },
          recommended_product: (item.recommendation && item.recommendation.product && item.recommendation.product.product_name) ? {
            name: item.recommendation.product.product_name,
            sku: item.recommendation.product.sku || 'N/A',
            wholesaler_sku: item.recommendation.product.wholesaler_sku || null,
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

