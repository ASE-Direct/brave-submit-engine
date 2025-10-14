/**
 * Update master_products.cost column with Partner Cost data from CSV
 * 
 * This script reads the Staples.To.Clover CSV file and updates the cost column
 * in master_products table with the PARTNER COST values.
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse CSV line handling quoted values
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Parse price string (handles "$", "," and spaces)
function parsePrice(priceStr: string): number | null {
  if (!priceStr || priceStr.trim() === '') return null;
  
  const cleaned = priceStr.replace(/[\$,\s]/g, '').trim();
  const parsed = parseFloat(cleaned);
  
  return isNaN(parsed) ? null : parsed;
}

async function main() {
  // Initialize Supabase client
  const supabaseUrl = process.env.SUPABASE_URL || 'https://qpiijzpslfjwikigrbol.supabase.co';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  
  if (!supabaseKey || supabaseKey === '') {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
    console.error('💡 Make sure to set it in your .env file or pass it as an environment variable');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Read CSV file
  const csvPath = path.join(__dirname, '../sample-data/Staples.To.Clover.9.26.25.xlsx - Sheet1 (1).csv');
  console.log(`📄 Reading CSV file: ${csvPath}`);
  
  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = fileContent.split('\n');
  
  console.log(`📊 Total lines in CSV: ${lines.length}`);
  
  // Parse header to find column indices
  const header = parseCSVLine(lines[0]);
  const skuColumnIndex = header.findIndex(col => col.trim() === 'ASE Clover Number');
  const partnerCostIndex = header.findIndex(col => col.trim() === 'PARTNER COST');
  
  console.log(`\n🔍 Column mapping:`);
  console.log(`   - ASE Clover Number (SKU): Column ${skuColumnIndex}`);
  console.log(`   - PARTNER COST: Column ${partnerCostIndex}`);
  
  if (skuColumnIndex === -1 || partnerCostIndex === -1) {
    console.error('❌ Could not find required columns in CSV');
    process.exit(1);
  }
  
  // Parse data rows
  const updates: Array<{ sku: string; cost: number }> = [];
  let skippedCount = 0;
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const columns = parseCSVLine(line);
    let sku = columns[skuColumnIndex]?.trim();
    const partnerCostStr = columns[partnerCostIndex]?.trim();
    
    if (!sku) continue;
    
    // Remove the "-R" suffix from SKUs (Remanufactured indicator in Staples catalog)
    // Database stores SKUs without this suffix
    if (sku.endsWith('-R')) {
      sku = sku.slice(0, -2);
    }
    
    const cost = parsePrice(partnerCostStr);
    
    if (cost === null || cost === 0) {
      skippedCount++;
      continue;
    }
    
    updates.push({ sku, cost });
  }
  
  console.log(`\n📈 Parsed ${updates.length} valid cost updates`);
  console.log(`⚠️  Skipped ${skippedCount} rows (missing or zero cost)`);
  
  // Preview first 5 updates
  console.log(`\n👀 Preview of first 5 updates:`);
  updates.slice(0, 5).forEach(({ sku, cost }) => {
    console.log(`   ${sku} → $${cost.toFixed(2)}`);
  });
  
  // Ask for confirmation
  console.log(`\n⚠️  About to update ${updates.length} products in the database.`);
  console.log(`   This will modify the 'cost' column in master_products table.`);
  
  // Batch update products
  console.log(`\n🚀 Starting database updates...`);
  
  let successCount = 0;
  let errorCount = 0;
  let notFoundCount = 0;
  
  // Process in batches of 50
  const batchSize = 50;
  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);
    
    for (const { sku, cost } of batch) {
      // Update by SKU
      const { data, error, count } = await supabase
        .from('master_products')
        .update({ cost })
        .eq('sku', sku)
        .select('sku');
      
      if (error) {
        console.error(`   ❌ Error updating ${sku}: ${error.message}`);
        errorCount++;
      } else if (!data || data.length === 0) {
        console.log(`   ⚠️  SKU not found: ${sku}`);
        notFoundCount++;
      } else {
        successCount++;
      }
    }
    
    // Progress update
    const progress = Math.min(i + batchSize, updates.length);
    console.log(`   Progress: ${progress}/${updates.length} (${Math.round((progress / updates.length) * 100)}%)`);
  }
  
  console.log(`\n✅ Update complete!`);
  console.log(`   - Successfully updated: ${successCount}`);
  console.log(`   - Not found in database: ${notFoundCount}`);
  console.log(`   - Errors: ${errorCount}`);
  
  // Verify a few random updates
  console.log(`\n🔍 Verifying random sample...`);
  const sampleUpdates = updates.slice(0, 3);
  for (const { sku, cost } of sampleUpdates) {
    const { data } = await supabase
      .from('master_products')
      .select('sku, cost, product_name')
      .eq('sku', sku)
      .single();
    
    if (data) {
      const match = Math.abs(parseFloat(data.cost) - cost) < 0.01;
      console.log(`   ${match ? '✅' : '❌'} ${sku}: $${data.cost} (expected: $${cost.toFixed(2)})`);
      console.log(`      ${data.product_name}`);
    }
  }
}

main().catch(console.error);

