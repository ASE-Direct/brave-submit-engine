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
 * Parse CSV/Excel document with AI assistance
 */
async function parseDocument(content: string, fileName: string) {
  console.log('📄 Parsing document:', fileName);

  // Parse CSV content
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  
  console.log('📊 Found columns:', headers);

  // Parse rows
  const items: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // Simple CSV parsing (handles basic cases)
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    // Extract product information with fuzzy matching
    const item = extractProductInfo(row, headers);
    if (item) {
      items.push(item);
    }
  }

  console.log(`✅ Parsed ${items.length} items`);

  return {
    items,
    totalItems: items.length,
    headers
  };
}

/**
 * Extract product info from row with flexible column matching
 */
function extractProductInfo(row: Record<string, string>, headers: string[]) {
  // Find relevant columns by matching common patterns
  const productNameCol = headers.find(h => 
    /product|item|description|name/i.test(h)
  );
  const skuCol = headers.find(h => 
    /sku|part|number|oem|code/i.test(h)
  );
  const qtyCol = headers.find(h => 
    /qty|quantity|count|units/i.test(h)
  );
  const priceCol = headers.find(h => 
    /price|cost|amount/i.test(h) && !/total/i.test(h)
  );

  if (!productNameCol) {
    return null; // Need at least product name
  }

  const productName = row[productNameCol];
  if (!productName || productName.length < 2) {
    return null;
  }

  const sku = skuCol ? row[skuCol] : '';
  const quantityStr = qtyCol ? row[qtyCol]?.replace(/[^0-9.]/g, '') : '1';
  const priceStr = priceCol ? row[priceCol]?.replace(/[^0-9.]/g, '') : '0';

  const quantity = parseInt(quantityStr) || 1;
  const unitPrice = parseFloat(priceStr) || 0;

  return {
    raw_product_name: productName,
    raw_sku: sku || null,
    raw_description: productName,
    quantity,
    unit_price: unitPrice,
    total_price: quantity * unitPrice
  };
}

/**
 * Match products to master catalog using multi-tier strategy
 */
async function matchProducts(items: any[], jobId: string) {
  console.log('🔍 Matching products to catalog...');
  const matched: any[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    console.log(`  Matching ${i + 1}/${items.length}: ${item.raw_product_name}`);

    // Tier 1: Exact SKU match (fastest, free)
    let match = await exactSKUMatch(item.raw_sku);
    
    // Tier 2: Full-text search (fast, free)
    if (!match || match.score < 0.9) {
      match = await fullTextSearch(item.raw_product_name);
    }

    // Tier 3: Semantic search with embeddings (fast, cheap)
    if (!match || match.score < 0.8) {
      match = await semanticSearch(item.raw_product_name);
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

  return matched;
}

/**
 * Tier 1: Exact SKU matching
 */
async function exactSKUMatch(sku: string) {
  if (!sku) return null;

  const { data, error } = await supabase
    .from('master_products')
    .select('*')
    .eq('sku', sku)
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
 * Tier 2: Full-text search
 */
async function fullTextSearch(productName: string) {
  if (!productName) return null;

  // Create search query (remove special chars)
  const searchTerms = productName
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(term => term.length > 2)
    .join(' & ');

  const { data, error } = await supabase
    .from('master_products')
    .select('*')
    .textSearch('search_vector', searchTerms)
    .eq('active', true)
    .limit(1);

  if (!error && data && data.length > 0) {
    return {
      product: data[0],
      score: 0.85,
      method: 'fuzzy_name'
    };
  }

  return null;
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
  const { error } = await supabase
    .from('order_items_extracted')
    .insert({
      processing_job_id: jobId,
      raw_product_name: item.raw_product_name,
      raw_sku: item.raw_sku,
      raw_description: item.raw_description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
      matched_product_id: item.matched_product?.id || null,
      match_score: item.match_score,
      match_method: item.match_method,
      current_total_cost: item.total_price
    });

  if (error) {
    console.error('Error saving extracted item:', error);
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

      // Update database
      await supabase
        .from('order_items_extracted')
        .update({
          recommended_product_id: recommendation.product.id,
          recommended_quantity: recommendation.quantity,
          recommended_total_cost: optimizedCost,
          cost_savings: savings,
          cost_savings_percentage: (savings / currentCost) * 100,
          savings_reason: recommendation.reason,
          recommendation_type: recommendation.type,
          environmental_savings: {
            cartridges_saved: recommendation.cartridges_saved,
            co2_reduced: recommendation.cartridges_saved * (item.matched_product.category === 'toner_cartridge' ? 5.2 : 2.5)
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

  // Check for larger sizes (XL, XXL)
  if (currentProduct.size_category === 'standard') {
    const { data: largerSizes } = await supabase
      .from('master_products')
      .select('*')
      .eq('brand', currentProduct.brand)
      .eq('model', currentProduct.model?.replace('standard', 'xl'))
      .eq('category', currentProduct.category)
      .in('size_category', ['xl', 'xxl'])
      .eq('active', true)
      .limit(1);

    if (largerSizes && largerSizes.length > 0) {
      const xlProduct = largerSizes[0];
      
      // Calculate if XL is better value
      const currentPageYield = currentProduct.page_yield || 300;
      const xlPageYield = xlProduct.page_yield || 600;
      
      if (xlPageYield > currentPageYield) {
        const quantityNeeded = Math.ceil((item.quantity * currentPageYield) / xlPageYield);
        const xlTotalCost = quantityNeeded * xlProduct.unit_price;
        
        if (xlTotalCost < item.total_price) {
          return {
            product: xlProduct,
            quantity: quantityNeeded,
            total_cost: xlTotalCost,
            cartridges_saved: item.quantity - quantityNeeded,
            reason: `Switch to ${xlProduct.size_category.toUpperCase()} size (${xlPageYield} pages vs ${currentPageYield} pages) - saves ${item.quantity - quantityNeeded} cartridges`,
            type: 'larger_size'
          };
        }
      }
    }
  }

  // Check for bulk pricing
  if (currentProduct.bulk_price && currentProduct.bulk_minimum) {
    if (item.quantity >= currentProduct.bulk_minimum) {
      const bulkCost = item.quantity * currentProduct.bulk_price;
      if (bulkCost < item.total_price) {
        return {
          product: currentProduct,
          quantity: item.quantity,
          total_cost: bulkCost,
          cartridges_saved: 0,
          reason: `Bulk pricing available (${currentProduct.bulk_minimum}+ units at $${currentProduct.bulk_price})`,
          type: 'bulk_pricing'
        };
      }
    }
  }

  return null;
}

/**
 * Generate PDF report and upload to storage
 */
async function generateReport(savingsAnalysis: any, context: ProcessingContext): Promise<string> {
  console.log('📄 Generating PDF report...');
  
  try {
    // Prepare report data
    const reportData = {
      customer: {
        firstName: context.customerInfo.firstName,
        lastName: context.customerInfo.lastName,
        company: context.customerInfo.company,
        email: context.customerInfo.email
      },
      summary: savingsAnalysis.summary,
      breakdown: savingsAnalysis.breakdown.map((item: any) => ({
        current_product: {
          name: item.raw_product_name || 'Unknown Product',
          sku: item.raw_sku || 'N/A',
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_cost: item.total_price
        },
        recommended_product: item.recommendation ? {
          name: item.recommendation.product.product_name,
          sku: item.recommendation.product.sku,
          quantity_needed: item.recommendation.quantity,
          unit_price: item.recommendation.product.unit_price,
          total_cost: item.recommendation.total_cost,
          bulk_discount_applied: item.recommendation.type === 'bulk_pricing'
        } : undefined,
        savings: item.savings > 0 ? {
          cost_savings: item.savings,
          cost_savings_percentage: (item.savings / item.total_price) * 100,
          cartridges_saved: item.recommendation?.cartridges_saved || 0,
          co2_reduced: (item.recommendation?.cartridges_saved || 0) * 2.5
        } : undefined,
        reason: item.recommendation?.reason,
        recommendation_type: item.recommendation?.type
      }))
    };

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
  const { error } = await supabase
    .from('savings_reports')
    .insert({
      processing_job_id: context.jobId,
      submission_id: context.submissionId,
      ...savingsAnalysis.summary,
      report_data: savingsAnalysis,
      pdf_url: reportUrl,
      customer_name: `${context.customerInfo.firstName} ${context.customerInfo.lastName}`,
      company_name: context.customerInfo.company,
      email: context.customerInfo.email
    });

  if (error) {
    console.error('Error saving report:', error);
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

