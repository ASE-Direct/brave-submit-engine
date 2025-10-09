#!/usr/bin/env tsx

/**
 * Update Vendor SKU Columns via Direct SQL
 * 
 * Generates SQL UPDATE statements from catalog file
 * No API keys needed!
 * 
 * Usage:
 *   npx tsx scripts/update-vendor-skus-sql.ts path/to/catalog.xlsx > update.sql
 */

import { readFileSync } from 'fs';
import * as XLSX from 'xlsx';

interface CatalogRow {
  'OEM Number': string;
  'ASE OEM Number': string;
  'ASE Clover Number': string;
  'Staples Part Number': string;
}

interface SKUMapping {
  primary_sku: string;
  oem_number: string | null;
  wholesaler_sku: string | null;
  staples_sku: string | null;
}

function escapeSql(value: string | null): string {
  if (!value) return 'NULL';
  // Escape single quotes by doubling them
  return `'${value.replace(/'/g, "''")}'`;
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: npx tsx scripts/update-vendor-skus-sql.ts path/to/catalog.xlsx');
    process.exit(1);
  }
  
  const filePath = args[0];
  
  console.error('📄 Reading file:', filePath);
  
  const fileBuffer = readFileSync(filePath);
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    raw: false,
    defval: ''
  }) as CatalogRow[];
  
  console.error(`📊 Total rows: ${rows.length}`);
  
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
    if (skuSet.has(primarySku)) continue;
    skuSet.add(primarySku);
    
    mappings.push({
      primary_sku: primarySku,
      oem_number: oemNumber || null,
      wholesaler_sku: aseOemNumber || null,
      staples_sku: staplesPartNumber || null,
    });
  }
  
  console.error(`✨ Extracted ${mappings.length} unique SKU mappings\n`);
  console.error('🔄 Generating SQL UPDATE statements...\n');
  
  // Output SQL (to stdout)
  console.log('-- Update vendor SKU columns');
  console.log('-- Generated from:', filePath);
  console.log('-- Date:', new Date().toISOString());
  console.log('');
  
  let count = 0;
  for (const mapping of mappings) {
    const sql = `UPDATE master_products SET oem_number = ${escapeSql(mapping.oem_number)}, wholesaler_sku = ${escapeSql(mapping.wholesaler_sku)}, staples_sku = ${escapeSql(mapping.staples_sku)} WHERE sku = ${escapeSql(mapping.primary_sku)};`;
    console.log(sql);
    count++;
    
    if (count % 100 === 0) {
      console.log(`-- Progress: ${count}/${mappings.length}`);
    }
  }
  
  console.log('');
  console.log('-- Complete!');
  console.log(`-- Total statements: ${count}`);
  
  console.error(`\n✅ Generated ${count} SQL UPDATE statements`);
  console.error('📋 SQL output written to stdout (redirect to file or copy/paste)');
}

main();

