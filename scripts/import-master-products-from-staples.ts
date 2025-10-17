/**
 * Import Master Products from Staples.To.Clover.9.26.25.xlsx - Sheet1 (1).csv
 * 
 * This script:
 * 1. Reads the CSV file
 * 2. Maps CSV columns to master_products table columns
 * 3. Ensures ASE Clover Numbers have -R suffix
 * 4. Truncates and reloads master_products table with exact CSV data
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'csv-parse/sync';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables!');
  console.error('Required: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface CSVRow {
  'Seq': string;
  'OEM Number': string;
  'ASE OEM Number': string;
  'ASE Clover Number': string;
  'Clover Yield': string;
  'Notes': string;
  'Clover COGS': string;
  'ASE Price': string;
  'Contract Status': string;
  'Laser Rank': string;
  'Color Laser Rank': string;
  'MFR PART NUMBER': string; // There are multiple MFR PART NUMBER columns
  'Part # From Description': string;
  'Staples Part Number': string;
  'Ability One Flag': string;
  'MFR NAME': string;
  'DESCRIPTION': string;
  'LONG DESCRIPTION': string;
  'EXTENDED DESCRIPTION': string;
  'UOM': string;
  'Pack per Quantity': string;
  'Final UPC CODE': string;
  'UNSPC': string;
  'PRODUCT CLASS': string;
  'PRODUCT DEPARTMENT': string;
  'PRODUCT SUB-DEP\'T': string;
  'Image Link': string;
  'COO Name': string;
  'COO': string;
  'Post Consumer Rec Content': string;
  'Total Recycled': string;
  'Recycled Content': string;
  'NSN Item': string;
  'NSN Item 13-digit': string;
  'Dropship Flag': string;
  'PARTNER LIST PRICE': string;
  'PARTNER COST': string;
  'Action': string;
}

function parsePrice(priceStr: string): number | null {
  if (!priceStr || priceStr.trim() === '' || priceStr.trim() === 'N/A') {
    return null;
  }
  // Remove dollar signs, spaces, commas
  const cleaned = priceStr.replace(/[$,\s]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

function parsePercentage(percentStr: string): number | null {
  if (!percentStr || percentStr.trim() === '' || percentStr.trim() === '0%') {
    return null;
  }
  const cleaned = percentStr.replace(/%/g, '');
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? null : parsed;
}

function parseInteger(intStr: string): number | null {
  if (!intStr || intStr.trim() === '' || intStr.trim() === 'N/A') {
    return null;
  }
  const parsed = parseInt(intStr, 10);
  return isNaN(parsed) ? null : parsed;
}

function ensureRSuffix(cloverNumber: string): string {
  if (!cloverNumber || cloverNumber.trim() === '') {
    return '';
  }
  const trimmed = cloverNumber.trim();
  // CSV already has -R suffix, so just return the trimmed value
  return trimmed;
}

function detectCategory(productClass: string, productDept: string, description: string): string {
  const classLower = productClass.toLowerCase();
  const deptLower = productDept.toLowerCase();
  const descLower = description.toLowerCase();
  
  if (classLower.includes('toner') || deptLower.includes('toner')) {
    return 'toner_cartridge';
  }
  if (classLower.includes('ink') || deptLower.includes('ink')) {
    return 'ink_cartridge';
  }
  if (descLower.includes('toner')) {
    return 'toner_cartridge';
  }
  if (descLower.includes('ink')) {
    return 'ink_cartridge';
  }
  
  return 'office_supplies';
}

function detectColorType(description: string): string | null {
  const descLower = description.toLowerCase();
  
  if (descLower.includes('black') && !descLower.includes('color') && !descLower.includes('tri')) {
    return 'black';
  }
  if (descLower.includes('cyan')) {
    return 'cyan';
  }
  if (descLower.includes('magenta')) {
    return 'magenta';
  }
  if (descLower.includes('yellow') && !descLower.includes('high yield')) {
    return 'yellow';
  }
  if (descLower.includes('tri-color') || descLower.includes('tricolor') || descLower.includes('c/m/y')) {
    return 'color';
  }
  
  return null;
}

function detectSizeCategory(description: string): string {
  const descLower = description.toLowerCase();
  
  if (descLower.includes('xxl') || descLower.includes('extra high') || descLower.includes('super high')) {
    return 'xxl';
  }
  if (descLower.includes('xl') || descLower.includes('high yield')) {
    return 'xl';
  }
  if (descLower.includes('standard')) {
    return 'standard';
  }
  
  return 'standard';
}

function detectYieldClass(description: string): string {
  const descLower = description.toLowerCase();
  
  if (descLower.includes('super high yield')) {
    return 'super_high';
  }
  if (descLower.includes('extra high yield')) {
    return 'extra_high';
  }
  if (descLower.includes('high yield') || descLower.includes('xl')) {
    return 'high';
  }
  
  return 'standard';
}

function detectOemVsCompatible(mfrName: string, description: string): string {
  const mfrLower = mfrName.toLowerCase();
  const descLower = description.toLowerCase();
  
  if (mfrLower.includes('tru red') || descLower.includes('remanufactured')) {
    return 'reman';
  }
  if (descLower.includes('compatible')) {
    return 'compatible';
  }
  
  return 'OEM';
}

async function main() {
  console.log('🔄 Starting Master Products Import from Staples CSV...\n');

  // Read CSV file
  const csvPath = path.join(__dirname, '../sample-data/Staples.To.Clover.9.26.25.xlsx - Sheet1 (1).csv');
  console.log(`📂 Reading CSV from: ${csvPath}`);
  
  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  
  // Parse CSV with proper handling of quotes and commas
  const records = csv.parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as CSVRow[];

  console.log(`✅ Parsed ${records.length} rows from CSV\n`);

  // Step 1: Get existing SKUs
  console.log('🔍 Fetching existing products from database...');
  const { data: existingProducts, error: fetchError } = await supabase
    .from('master_products')
    .select('sku, id');

  if (fetchError) {
    console.error('❌ Error fetching existing products:', fetchError);
    process.exit(1);
  }

  const existingSkuMap = new Map(existingProducts?.map(p => [p.sku, p.id]) || []);
  console.log(`✅ Found ${existingSkuMap.size} existing products\n`);

  // Step 2: Process records - we'll use upsert (update or insert)
  console.log('📥 Processing records for upsert...\n');
  
  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;
  const batchSize = 100;
  const batches: any[][] = [];
  let currentBatch: any[] = [];
  const seenSkus = new Set<string>();

  for (const row of records) {
    try {
      // Ensure ASE Clover Number has -R suffix
      const sku = ensureRSuffix(row['ASE Clover Number']);
      
      if (!sku || sku === '-R') {
        skippedCount++;
        continue;
      }

      // De-duplicate within CSV (keep first occurrence)
      if (seenSkus.has(sku)) {
        console.warn(`⚠️  Skipping duplicate SKU: ${sku}`);
        skippedCount++;
        continue;
      }
      seenSkus.add(sku);

      const pageYield = parseInteger(row['Clover Yield']);
      const packQty = parseInteger(row['Pack per Quantity']) || 1;
      const unitPrice = parsePrice(row['ASE Price']);
      const cost = parsePrice(row['Clover COGS']);
      const listPrice = parsePrice(row['PARTNER LIST PRICE']);
      
      // Ensure unit_price is not null - use fallback if needed
      const finalUnitPrice = unitPrice || cost || listPrice || 0.01;
      
      const category = detectCategory(row['PRODUCT CLASS'], row['PRODUCT DEPARTMENT'], row['DESCRIPTION']);
      const colorType = detectColorType(row['DESCRIPTION']);
      const sizeCategory = detectSizeCategory(row['DESCRIPTION']);
      const yieldClass = detectYieldClass(row['DESCRIPTION']);
      const oemVsCompatible = detectOemVsCompatible(row['MFR NAME'], row['DESCRIPTION']);

      const product = {
        // Core fields
        sku,
        product_name: row['DESCRIPTION'] || '',
        category,
        brand: row['MFR NAME'] || null,
        model: row['OEM Number'] || null,
        unit_price: finalUnitPrice,
        bulk_price: null,
        bulk_minimum: null,
        list_price: listPrice,
        cost,
        page_yield: pageYield,
        color_type: colorType,
        size_category: sizeCategory,
        uom: row['UOM'] || 'EA',
        pack_quantity: packQty,
        co2_per_unit: category === 'ink_cartridge' ? 2.5 : 5.2,
        recyclable: true,
        recycled_content_percentage: parsePercentage(row['Total Recycled']),
        weight_plastic: null,
        weight_aluminum: null,
        weight_steel: null,
        weight_copper: null,
        alternative_product_ids: null,
        replaces_products: null,
        related_skus: null,
        manufacturer: row['MFR NAME'] || null,
        description: row['LONG DESCRIPTION'] || row['DESCRIPTION'] || '',
        long_description: row['EXTENDED DESCRIPTION'] || null,
        image_url: row['Image Link'] || null,
        active: true,
        family_series: null,
        yield_class: yieldClass,
        compatible_printers: null,
        oem_vs_compatible: oemVsCompatible,
        uom_std: row['UOM'] || 'EA',
        pack_qty_std: packQty,
        ase_unit_price: finalUnitPrice,
        inventory_status: 'in_stock',
        oem_number: row['OEM Number'] || null,
        wholesaler_sku: row['ASE OEM Number'] || null,
        staples_sku: row['Staples Part Number'] || null,
        depot_sku: null,
        compatibility_group: null,
        model_pattern: null,
        
        // NEW: Direct CSV column mappings
        seq: parseInteger(row['Seq']),
        ase_oem_number: row['ASE OEM Number'] || null,
        clover_yield: pageYield,
        notes: row['Notes'] || null,
        clover_cogs: cost,
        ase_price: unitPrice,
        contract_status: row['Contract Status'] || null,
        laser_rank: row['Laser Rank'] || null,
        color_laser_rank: row['Color Laser Rank'] || null,
        mfr_part_number: row['MFR PART NUMBER'] || null,
        part_number_from_description: row['Part # From Description'] || null,
        ability_one_flag: row['Ability One Flag'] || null,
        mfr_name: row['MFR NAME'] || null,
        final_upc_code: row['Final UPC CODE'] || null,
        unspc: row['UNSPC'] || null,
        product_class: row['PRODUCT CLASS'] || null,
        product_department: row['PRODUCT DEPARTMENT'] || null,
        product_subdept: row['PRODUCT SUB-DEP\'T'] || null,
        coo_name: row['COO Name'] || null,
        coo: row['COO'] || null,
        post_consumer_rec_content: row['Post Consumer Rec Content'] || null,
        total_recycled_percent: row['Total Recycled'] || null,
        recycled_content_flag: row['Recycled Content'] || null,
        nsn_item: row['NSN Item'] || null,
        nsn_item_13digit: row['NSN Item 13-digit'] || null,
        dropship_flag: row['Dropship Flag'] || null,
        partner_list_price: listPrice,
        partner_cost: parsePrice(row['PARTNER COST']),
        action: row['Action'] || null,
      };

      currentBatch.push(product);

      if (currentBatch.length >= batchSize) {
        batches.push([...currentBatch]);
        currentBatch = [];
      }
    } catch (error) {
      console.error(`❌ Error processing row:`, error);
      errorCount++;
    }
  }

  // Add remaining items
  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  console.log(`📦 Created ${batches.length} batches of up to ${batchSize} records each`);
  console.log(`⚠️  Skipped ${skippedCount} rows (empty or duplicate SKUs)\n`);

  // Upsert batches (insert new, update existing)
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`📤 Upserting batch ${i + 1}/${batches.length} (${batch.length} records)...`);
    
    const { data, error } = await supabase
      .from('master_products')
      .upsert(batch, { 
        onConflict: 'sku',
        ignoreDuplicates: false 
      });

    if (error) {
      console.error(`❌ Error upserting batch ${i + 1}:`, error);
      errorCount += batch.length;
    } else {
      successCount += batch.length;
      console.log(`✅ Batch ${i + 1} upserted successfully`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Import Summary:');
  console.log('='.repeat(60));
  console.log(`✅ Successfully inserted: ${successCount} products`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`📈 Total processed: ${successCount + errorCount}`);
  console.log('='.repeat(60));
  
  console.log('\n✨ Master products import complete!');
}

main().catch(console.error);

