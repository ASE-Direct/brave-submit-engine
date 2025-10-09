#!/usr/bin/env tsx

/**
 * Update Vendor SKU Columns Script
 * 
 * Updates existing master_products with vendor SKU cross-references
 * (no embeddings needed - much faster than full re-import!)
 * 
 * Usage:
 *   npx tsx scripts/update-vendor-skus.ts path/to/catalog.xlsx
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import * as XLSX from 'xlsx';
import { config } from 'dotenv';

// Load environment variables
config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

console.log('🔍 Checking environment variables...');
console.log('VITE_SUPABASE_URL:', SUPABASE_URL ? '✓ Set' : '✗ Missing');
console.log('SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? '✓ Set' : '✗ Missing');
console.log('');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface CatalogRow {
  'OEM Number': string;
  'ASE OEM Number': string;
  'ASE Clover Number': string;
  'Staples Part Number': string;
  'DESCRIPTION': string;
}

interface SKUMapping {
  primary_sku: string;
  oem_number: string | null;
  wholesaler_sku: string | null;
  staples_sku: string | null;
  depot_sku: string | null;
}

/**
 * Parse Excel file and extract SKU mappings
 */
function parseSkuMappings(filePath: string): SKUMapping[] {
  console.log('📄 Reading file:', filePath);
  
  const fileBuffer = readFileSync(filePath);
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  
  console.log('📋 Using sheet:', sheetName);
  
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    raw: false,
    defval: ''
  }) as CatalogRow[];
  
  console.log(`📊 Total rows: ${rows.length}`);
  
  const mappings: SKUMapping[] = [];
  const skuSet = new Set<string>();
  
  for (const row of rows) {
    const oemNumber = (row['OEM Number'] || '').trim();
    const aseOemNumber = (row['ASE OEM Number'] || '').trim();
    const aseCloverNumber = (row['ASE Clover Number'] || '').trim();
    const staplesPartNumber = (row['Staples Part Number'] || '').trim();
    
    // Primary SKU (prefer OEM, then ASE OEM, then Clover)
    const primarySku = oemNumber || aseOemNumber || aseCloverNumber;
    
    if (!primarySku) continue;
    
    // Skip duplicates
    if (skuSet.has(primarySku)) continue;
    skuSet.add(primarySku);
    
    mappings.push({
      primary_sku: primarySku,
      oem_number: oemNumber || null,
      wholesaler_sku: aseOemNumber || null, // ASE OEM is effectively a wholesaler SKU
      staples_sku: staplesPartNumber || null,
      depot_sku: null // Not in this file
    });
  }
  
  console.log(`✨ Extracted ${mappings.length} unique SKU mappings`);
  
  // Show sample
  if (mappings.length > 0) {
    console.log('\n📦 Sample mapping:');
    const sample = mappings[0];
    console.log(`  Primary SKU: ${sample.primary_sku}`);
    console.log(`  OEM Number: ${sample.oem_number || '(none)'}`);
    console.log(`  Wholesaler SKU: ${sample.wholesaler_sku || '(none)'}`);
    console.log(`  Staples SKU: ${sample.staples_sku || '(none)'}`);
    console.log(`  Depot SKU: ${sample.depot_sku || '(none)'}`);
  }
  
  return mappings;
}

/**
 * Update products in batches
 */
async function updateProducts(mappings: SKUMapping[]) {
  const BATCH_SIZE = 100;
  let successCount = 0;
  let errorCount = 0;
  let notFoundCount = 0;
  
  console.log('\n🚀 Starting updates...\n');
  
  for (let i = 0; i < mappings.length; i += BATCH_SIZE) {
    const batch = mappings.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(mappings.length / BATCH_SIZE);
    
    console.log(`📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} SKUs)`);
    
    for (const mapping of batch) {
      try {
        // Update by primary SKU
        const { data, error, count } = await supabase
          .from('master_products')
          .update({
            oem_number: mapping.oem_number,
            wholesaler_sku: mapping.wholesaler_sku,
            staples_sku: mapping.staples_sku,
            depot_sku: mapping.depot_sku,
          })
          .eq('sku', mapping.primary_sku)
          .select('id', { count: 'exact', head: true });
        
        if (error) {
          console.error(`  ❌ Error updating ${mapping.primary_sku}:`, error.message);
          errorCount++;
        } else if (count === 0) {
          // SKU not found in database - this is normal for new products
          notFoundCount++;
        } else {
          successCount++;
        }
      } catch (err: any) {
        console.error(`  ❌ Exception updating ${mapping.primary_sku}:`, err.message);
        errorCount++;
      }
    }
    
    console.log(`  ✓ Batch complete (${successCount} updated, ${notFoundCount} not found, ${errorCount} errors)\n`);
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return { successCount, errorCount, notFoundCount };
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('❌ Please provide path to catalog file');
    console.error('Usage: npx tsx scripts/update-vendor-skus.ts path/to/catalog.xlsx');
    process.exit(1);
  }
  
  const filePath = args[0];
  
  console.log('🚀 Starting vendor SKU update...\n');
  
  // Parse catalog
  const mappings = parseSkuMappings(filePath);
  
  if (mappings.length === 0) {
    console.error('❌ No SKU mappings found in catalog');
    process.exit(1);
  }
  
  // Update products
  const { successCount, errorCount, notFoundCount } = await updateProducts(mappings);
  
  console.log('\n🎉 Update complete!');
  console.log(`✅ Successfully updated: ${successCount} products`);
  console.log(`⚠️  Not found in database: ${notFoundCount} products`);
  console.log(`❌ Errors: ${errorCount} products`);
  
  // Verify updates
  console.log('\n📊 Verifying vendor SKU columns...');
  const { data: stats } = await supabase
    .from('master_products')
    .select('oem_number, wholesaler_sku, staples_sku, depot_sku')
    .not('staples_sku', 'is', null);
  
  if (stats) {
    console.log(`✓ Products with Staples SKU: ${stats.length}`);
  }
  
  // Show sample updated products
  const { data: samples } = await supabase
    .from('master_products')
    .select('sku, product_name, oem_number, wholesaler_sku, staples_sku')
    .not('staples_sku', 'is', null)
    .limit(3);
  
  if (samples && samples.length > 0) {
    console.log('\n📦 Sample updated products:');
    samples.forEach((p, idx) => {
      console.log(`\n${idx + 1}. ${p.product_name}`);
      console.log(`   Primary SKU: ${p.sku}`);
      console.log(`   OEM Number: ${p.oem_number || '(none)'}`);
      console.log(`   Wholesaler SKU: ${p.wholesaler_sku || '(none)'}`);
      console.log(`   Staples SKU: ${p.staples_sku || '(none)'}`);
    });
  }
  
  console.log('\n✨ Vendor SKU cross-references are now active!');
  console.log('🧪 Test with your document to verify improved matching.');
}

// Run
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

