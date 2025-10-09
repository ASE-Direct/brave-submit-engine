#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { config } from 'dotenv';

config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('🚀 Executing all vendor SKU updates...\n');
  
  // Get all batch files
  const batchFiles = readdirSync('/tmp')
    .filter(f => f.startsWith('batch_'))
    .sort();
  
  console.log(`📦 Found ${batchFiles.length} batch files\n`);
  
  let totalSuccess = 0;
  
  for (let i = 0; i < batchFiles.length; i++) {
    const file = batchFiles[i];
    console.log(`[${i + 1}/${batchFiles.length}] Processing ${file}...`);
    
    const sql = readFileSync(`/tmp/${file}`, 'utf-8');
    const statements = sql.trim().split('\n').filter(s => s.trim());
    
    // Execute each statement
    for (const stmt of statements) {
      try {
        await supabase.rpc('query', { query_text: stmt });
        totalSuccess++;
      } catch (err) {
        // Try direct approach
        const match = stmt.match(/WHERE sku = '([^']+)'/);
        if (match) {
          const sku = match[1];
          const oemMatch = stmt.match(/oem_number = (?:'([^']+)'|NULL)/);
          const wsMatch = stmt.match(/wholesaler_sku = (?:'([^']+)'|NULL)/);
          const staplesMatch = stmt.match(/staples_sku = (?:'([^']+)'|NULL)/);
          
          const updates: any = {};
          if (oemMatch) updates.oem_number = oemMatch[1] === 'NULL' ? null : oemMatch[1];
          if (wsMatch) updates.wholesaler_sku = wsMatch[1] === 'NULL' ? null : wsMatch[1];
          if (staplesMatch) updates.staples_sku = staplesMatch[1] === 'NULL' ? null : staplesMatch[1];
          
          const { error } = await supabase
            .from('master_products')
            .update(updates)
            .eq('sku', sku);
          
          if (!error) totalSuccess++;
        }
      }
    }
    
    console.log(`  ✓ Completed (${totalSuccess} total updated so far)`);
  }
  
  console.log(`\n🎉 Complete! Updated ${totalSuccess} products`);
  
  // Verify
  const { count } = await supabase
    .from('master_products')
    .select('*', { count: 'exact', head: true })
    .not('staples_sku', 'is', null);
  
  console.log(`✨ Products with Staples SKU: ${count}`);
}

main();

