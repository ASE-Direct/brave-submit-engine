#!/usr/bin/env tsx
/**
 * Update Extended Descriptions in master_products table
 * 
 * Reads the master catalog CSV and updates the description and long_description
 * fields in the master_products table with the extended descriptions.
 */
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

// Load environment variables
config();

// Read env
const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface CatalogRow {
  seq: string;
  oem_number: string;
  ase_oem_number: string;
  ase_clover_number: string;
  clover_yield: string;
  notes: string;
  clover_cogs: string;
  ase_price: string;
  contract_status: string;
  laser_rank: string;
  color_laser_rank: string;
  mfr_part_number_1: string;
  mfr_part_number_2: string;
  part_from_description: string;
  staples_part_number: string;
  empty_col: string;
  mfr_part_number_3: string;
  ability_one_flag: string;
  mfr_name: string;
  description: string;
  long_description: string;
  extended_description: string;
  uom: string;
  pack_per_quantity: string;
  final_upc_code: string;
  unspc: string;
  product_class: string;
  product_department: string;
  product_sub_dept: string;
  image_link: string;
  coo_name: string;
  coo: string;
  post_consumer_rec_content: string;
  total_recycled: string;
  recycled_content: string;
  nsn_item: string;
  nsn_item_13_digit: string;
  dropship_flag: string;
  partner_list_price: string;
  partner_cost: string;
  action: string;
}

/**
 * Parse CSV line handling quoted fields with commas
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"' && nextChar === '"') {
      // Escaped quote
      current += '"';
      i++; // Skip next quote
    } else if (char === '"') {
      // Toggle quote state
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add last field
  result.push(current.trim());
  
  return result;
}

/**
 * Clean and normalize text
 */
function cleanText(text: string): string {
  if (!text) return '';
  return text
    .replace(/^["']|["']$/g, '') // Remove surrounding quotes
    .replace(/""/g, '"') // Unescape quotes
    .trim();
}

/**
 * Main function to update extended descriptions
 */
async function updateExtendedDescriptions() {
  console.log('📝 Starting Extended Description Update...\n');
  
  const csvPath = path.join(process.cwd(), 'sample-data', 'Staples.To.Clover.9.26.25.xlsx - Sheet1 (1).csv');
  
  if (!fs.existsSync(csvPath)) {
    console.error('❌ CSV file not found:', csvPath);
    process.exit(1);
  }
  
  console.log('📂 Reading CSV file:', csvPath);
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n');
  
  console.log(`📊 Found ${lines.length} lines in CSV\n`);
  
  // Skip header row
  const dataLines = lines.slice(1).filter(line => line.trim().length > 0);
  
  let updated = 0;
  let skipped = 0;
  let notFound = 0;
  let errors = 0;
  
  const BATCH_SIZE = 50;
  
  for (let i = 0; i < dataLines.length; i += BATCH_SIZE) {
    const batch = dataLines.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(dataLines.length / BATCH_SIZE);
    
    console.log(`\n📦 Processing batch ${batchNum}/${totalBatches} (items ${i + 1}-${Math.min(i + BATCH_SIZE, dataLines.length)})...`);
    
    for (const line of batch) {
      try {
        const fields = parseCSVLine(line);
        
        if (fields.length < 22) {
          console.log(`  ⊘ Skipping line with insufficient fields (${fields.length} fields)`);
          skipped++;
          continue;
        }
        
        // Extract key fields
        const aseCloverNumber = cleanText(fields[3]); // ASE Clover Number (column D)
        const description = cleanText(fields[19]); // DESCRIPTION (column T)
        const longDescription = cleanText(fields[20]); // LONG DESCRIPTION (column U)
        const extendedDescription = cleanText(fields[21]); // EXTENDED DESCRIPTION (column V)
        
        // Skip if no SKU
        if (!aseCloverNumber || aseCloverNumber === '') {
          skipped++;
          continue;
        }
        
        // Use extended description if available, otherwise use long description
        const finalDescription = description || aseCloverNumber;
        const finalLongDescription = extendedDescription || longDescription || description || aseCloverNumber;
        
        // Find product by SKU (could be in sku, oem_number, or wholesaler_sku)
        // Try with and without -R suffix (remanufactured versions)
        const skuVariants = [
          aseCloverNumber,
          aseCloverNumber.replace(/-R$/i, ''), // Remove -R suffix
          aseCloverNumber.replace('#', '%23') // URL encode #
        ].filter((v, i, arr) => arr.indexOf(v) === i); // Remove duplicates
        
        let products = null;
        let findError = null;
        
        // Try each variant
        for (const variant of skuVariants) {
          const { data, error } = await supabase
            .from('master_products')
            .select('id, sku, description, long_description')
            .or(`sku.ilike.${variant}%,oem_number.ilike.${variant}%,wholesaler_sku.ilike.${variant}%`)
            .limit(1);
          
          if (!error && data && data.length > 0) {
            products = data;
            break;
          }
          
          if (error) {
            findError = error;
          }
        }
        
        if (findError) {
          console.error(`  ❌ Error finding product ${aseCloverNumber}:`, findError.message);
          errors++;
          continue;
        }
        
        if (!products || products.length === 0) {
          notFound++;
          continue;
        }
        
        const product = products[0];
        
        // Update the product
        const { error: updateError } = await supabase
          .from('master_products')
          .update({
            description: finalDescription,
            long_description: finalLongDescription
          })
          .eq('id', product.id);
        
        if (updateError) {
          console.error(`  ❌ Error updating ${product.sku}:`, updateError.message);
          errors++;
          continue;
        }
        
        updated++;
        
        // Log progress every 10 items
        if (updated % 10 === 0) {
          console.log(`  ✅ Updated ${updated} products...`);
        }
        
      } catch (error) {
        console.error(`  ❌ Error processing line:`, error);
        errors++;
      }
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('📊 Update Summary:');
  console.log('='.repeat(70));
  console.log(`✅ Successfully updated: ${updated} products`);
  console.log(`⊘ Skipped (no SKU/data): ${skipped} rows`);
  console.log(`❓ Not found in database: ${notFound} products`);
  console.log(`❌ Errors: ${errors}`);
  console.log('='.repeat(70));
  
  if (updated > 0) {
    console.log('\n🎉 Extended descriptions have been updated successfully!');
  }
}

// Run the update
updateExtendedDescriptions().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

