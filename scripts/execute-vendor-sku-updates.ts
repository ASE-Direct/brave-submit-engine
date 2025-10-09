#!/usr/bin/env tsx

/**
 * Execute Vendor SKU Updates
 * 
 * Executes all SQL UPDATE statements in batches
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log('🚀 Starting vendor SKU updates...\n');
  
  // Read the SQL file
  const sqlContent = readFileSync('/tmp/vendor-sku-updates.sql', 'utf-8');
  const updateStatements = sqlContent.split('\n').filter(line => line.trim().startsWith('UPDATE'));
  
  console.log(`📊 Total UPDATE statements: ${updateStatements.length}\n`);
  
  const BATCH_SIZE = 50;
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < updateStatements.length; i += BATCH_SIZE) {
    const batch = updateStatements.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(updateStatements.length / BATCH_SIZE);
    
    console.log(`📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} statements)...`);
    
    // Combine batch into single SQL
    const batchSql = batch.join('\n');
    
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: batchSql });
      
      if (error) {
        // If batch fails, try individually
        console.log('  ⚠️  Batch failed, trying individually...');
        for (const stmt of batch) {
          try {
            await supabase.rpc('exec_sql', { sql: stmt });
            successCount++;
          } catch (err: any) {
            errorCount++;
          }
        }
      } else {
        successCount += batch.length;
        console.log(`  ✅ Batch complete (${successCount} total updated)`);
      }
    } catch (err: any) {
      console.error(`  ❌ Batch error:`, err.message);
      errorCount += batch.length;
    }
    
    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n🎉 Updates complete!');
  console.log(`✅ Successfully updated: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  
  // Verify
  const { data } = await supabase
    .from('master_products')
    .select('staples_sku')
    .not('staples_sku', 'is', null);
  
  if (data) {
    console.log(`\n✨ Products with Staples SKU: ${data.length}`);
  }
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});

