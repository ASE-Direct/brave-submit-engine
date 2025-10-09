#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import * as XLSX from 'xlsx';
import { config } from 'dotenv';

// Load environment variables
config();

// Read env
const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface Update {
  sku: string;
  oem_number: string | null;
  wholesaler_sku: string | null;
  staples_sku: string | null;
}

async function main() {
  console.log('🚀 Bulk updating vendor SKUs...\n');
  
  // Read the master catalog
  const filePath = 'sample-data/Staples.To.Clover.9.26.25 (3).xlsx';
  const fileBuffer = readFileSync(filePath);
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {
    raw: false,
    defval: ''
  }) as any[];
  
  console.log(`📊 Processing ${rows.length} rows from catalog\n`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    
    const oemNumber = (row['OEM Number'] || '').trim();
    const aseOemNumber = (row['ASE OEM Number'] || '').trim();
    const staplesPartNumber = (row['Staples Part Number'] || '').trim();
    
    const primarySku = oemNumber || aseOemNumber;
    if (!primarySku) continue;
    
    try {
      const { error } = await supabase
        .from('master_products')
        .update({
          oem_number: oemNumber || null,
          wholesaler_sku: aseOemNumber || null,
          staples_sku: staplesPartNumber || null,
        })
        .eq('sku', primarySku);
      
      if (error) {
        errorCount++;
      } else {
        successCount++;
        if (successCount % 100 === 0) {
          console.log(`✓ Progress: ${successCount} updated`);
        }
      }
    } catch (err) {
      errorCount++;
    }
  }
  
  console.log(`\n🎉 Complete!`);
  console.log(`✅ Successfully updated: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  
  // Verify
  const { count } = await supabase
    .from('master_products')
    .select('*', { count: 'exact', head: true })
    .not('staples_sku', 'is', null);
  
  console.log(`\n✨ Products with Staples SKU: ${count}`);
}

main();

