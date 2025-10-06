import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import OpenAI from 'npm:openai@4';
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
 * Main processing orchestrator
 */
async function processDocument(context: ProcessingContext) {
  console.log('🚀 Starting document processing:', context.jobId);

  try {
    // Step 1: Download and parse file (10-30%)
    await updateProgress(context.jobId, 10, 'Downloading file...');
    const fileContent = await downloadFile(context.fileUrl);
    
    await updateProgress(context.jobId, 20, 'Parsing document...');
    const parsedData = await parseDocument(fileContent, context.fileName);
    
    await updateProgress(context.jobId, 30, `Extracted ${parsedData.items.length} items`);

    // Step 2: Match products (30-60%)
    await updateProgress(context.jobId, 35, 'Matching products to catalog...');
    const matchedItems = await matchProducts(parsedData.items, context.jobId);
    
    await updateProgress(context.jobId, 60, `Matched ${matchedItems.length} products`);

    // Step 3: Calculate savings (60-80%)
    await updateProgress(context.jobId, 65, 'Analyzing savings opportunities...');
    const savingsAnalysis = await calculateSavings(matchedItems, context.jobId);
    
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
    return { success: true };

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
 * Download file from Supabase Storage
 */
async function downloadFile(fileUrl: string): Promise<string> {
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`);
  }
  return await response.text();
}

/**
 * Parse CSV/Excel document with intelligent header detection
 */
async function parseDocument(content: string, fileName: string) {
  console.log('📄 Parsing document:', fileName);

  // Parse CSV content
  const lines = content.trim().split('\n');
  
  // Smart header detection - find the actual data header row
  const { headerRow, headerIndex } = findDataHeader(lines);
  const headers = headerRow.split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  
  console.log('📊 Found header at row', headerIndex + 1);
  console.log('📊 Columns:', headers);

  // Parse rows starting after the header
  const items: any[] = [];
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // Advanced CSV parsing (handles quoted commas)
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    // Extract product information with intelligent column detection
    const item = extractProductInfo(row, headers);
    if (item) {
      items.push(item);
    }
  }

  console.log(`✅ Parsed ${items.length} items from ${lines.length - headerIndex - 1} rows`);

  return {
    items,
    totalItems: items.length,
    headers
  };
}

/**
 * Intelligently find the actual data header row (skips metadata/blank rows)
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
 * Match products to master catalog using comprehensive multi-tier strategy
 */
async function matchProducts(items: any[], jobId: string) {
  console.log('🔍 Matching products to catalog...');
  const matched: any[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    console.log(`  Matching ${i + 1}/${items.length}: ${item.raw_product_name} [SKU: ${item.raw_sku}]`);

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

    // Tier 4: Semantic search with embeddings (more expensive, use last)
    if (!match || match.score < 0.75) {
      const semanticMatch = await semanticSearch(item.raw_product_name);
      if (semanticMatch && (!match || semanticMatch.score > match.score)) {
        match = semanticMatch;
        console.log(`    ✓ Matched via semantic search`);
      }
    }

    if (!match) {
      console.log(`    ✗ No match found`);
    }

    // Store matched item
    const matchedItem = {
      ...item,
      matched_product: match?.product || null,
      match_score: match?.score || 0,
      match_method: match?.method || 'none'
    };

    matched.push(matchedItem);

    // Save to database
    await saveExtractedItem(matchedItem, jobId);
  }

  const matchedCount = matched.filter(m => m.matched_product).length;
  console.log(`✅ Matched ${matchedCount} out of ${items.length} items (${Math.round(matchedCount/items.length*100)}%)`);

  return matched;
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
 * Save extracted item to database
 */
async function saveExtractedItem(item: any, jobId: string) {
  // Cap numeric values to prevent overflow (DECIMAL(10,2) max is 99,999,999.99)
  const MAX_DECIMAL = 99999999.99;
  const capValue = (val: number) => Math.min(val || 0, MAX_DECIMAL);

  const { error } = await supabase
    .from('order_items_extracted')
    .insert({
      processing_job_id: jobId,
      raw_product_name: item.raw_product_name?.substring(0, 500) || null,
      raw_sku: item.raw_sku?.substring(0, 100) || null,
      raw_description: item.raw_description?.substring(0, 1000) || null,
      quantity: item.quantity || 0, // Already validated in extraction
      unit_price: capValue(item.unit_price),
      total_price: capValue(item.total_price),
      matched_product_id: item.matched_product?.id || null,
      match_score: item.match_score,
      match_method: item.match_method || null,
      current_total_cost: capValue(item.total_price)
    });

  if (error) {
    console.error('Error saving extracted item:', error);
    console.error('Item data:', { 
      name: item.raw_product_name, 
      sku: item.raw_sku,
      qty: item.quantity,
      price: item.unit_price,
      total: item.total_price
    });
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
  let cartridgesSaved = 0;
  let co2Reduced = 0;

  const breakdown: any[] = [];

  for (const item of matchedItems) {
    if (!item.matched_product) {
      breakdown.push({
        ...item,
        savings: null,
        recommendation: 'No match found'
      });
      continue;
    }

    const currentCost = item.total_price;
    totalCurrentCost += currentCost;

    // Find better alternatives (larger sizes, bulk pricing)
    const recommendation = await findBetterAlternative(item);

    if (recommendation) {
      const optimizedCost = recommendation.total_cost;
      const savings = currentCost - optimizedCost;

      totalOptimizedCost += optimizedCost;
      totalSavings += savings;

      if (savings > 0) {
        itemsWithSavings++;
      }

      // Environmental impact
      if (recommendation.cartridges_saved > 0) {
        cartridgesSaved += recommendation.cartridges_saved;
        const co2PerCartridge = item.matched_product.category === 'toner_cartridge' ? 5.2 : 2.5;
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
            co2_reduced: Math.max(0, (recommendation.cartridges_saved || 0) * (item.matched_product.category === 'toner_cartridge' ? 5.2 : 2.5))
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
    }
  }

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
async function findBetterAlternative(item: any) {
  const currentProduct = item.matched_product;
  if (!currentProduct) return null;

  // Skip if already XL/XXL
  if (currentProduct.size_category && ['xl', 'xxl'].includes(currentProduct.size_category.toLowerCase())) {
    return null;
  }

  // Skip if no page yield (can't calculate savings)
  if (!currentProduct.page_yield || currentProduct.page_yield === 0) {
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
      const savings = calculateSavingsForAlternative(item, currentProduct, xlProduct);
      if (savings) return savings;
    }
  }

  return null;
}

/**
 * Calculate savings for an alternative product
 */
function calculateSavingsForAlternative(item: any, currentProduct: any, xlProduct: any) {
  const currentPageYield = currentProduct.page_yield || 1000;
  const xlPageYield = xlProduct.page_yield || 2000;
  
  // Only recommend if XL has significantly higher yield
  if (xlPageYield <= currentPageYield * 1.2) {
    return null;
  }
  
  // Calculate quantities needed
  const totalPages = item.quantity * currentPageYield;
  const quantityNeeded = Math.ceil(totalPages / xlPageYield);
  
  // Calculate costs
  const xlTotalCost = quantityNeeded * xlProduct.unit_price;
  const currentTotalCost = item.total_price;
  
  // Calculate cost per page
  const currentCostPerPage = currentTotalCost / totalPages;
  const xlCostPerPage = xlTotalCost / totalPages;
  
  // Only recommend if there are actual savings
  if (xlTotalCost >= currentTotalCost) {
    return null;
  }
  
  const cartridgesSaved = item.quantity - quantityNeeded;
  const costSavings = currentTotalCost - xlTotalCost;
  const savingsPercentage = (costSavings / currentTotalCost) * 100;
  
  return {
    product: xlProduct,
    quantity: quantityNeeded,
    total_cost: xlTotalCost,
    cartridges_saved: Math.max(0, cartridgesSaved),
    reason: `Switch to ${xlProduct.size_category?.toUpperCase() || 'High Yield'} (${xlPageYield.toLocaleString()} pages vs ${currentPageYield.toLocaleString()} pages). Saves ${cartridgesSaved.toLocaleString()} cartridges and $${costSavings.toFixed(2)} (${savingsPercentage.toFixed(1)}% savings)`,
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
    const { submissionId } = await req.json();

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

