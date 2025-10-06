#!/usr/bin/env tsx

/**
 * Master Catalog Import Script
 * 
 * Imports product catalog into Supabase master_products table
 * and generates OpenAI embeddings for semantic search.
 * 
 * Usage:
 *   npx tsx scripts/import-master-catalog.ts path/to/catalog.csv
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import OpenAI from 'openai';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

// Configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

console.log('🔍 Checking environment variables...');
console.log('VITE_SUPABASE_URL:', SUPABASE_URL ? '✓ Set' : '✗ Missing');
console.log('SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? '✓ Set' : '✗ Missing');
console.log('OPENAI_API_KEY:', OPENAI_API_KEY ? '✓ Set' : '✗ Missing');
console.log('');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !OPENAI_API_KEY) {
  console.error('❌ Missing required environment variables');
  console.error('');
  console.error('Please create a .env file in the project root with:');
  console.error('');
  console.error('VITE_SUPABASE_URL=https://your-project.supabase.co');
  console.error('SUPABASE_SERVICE_ROLE_KEY=your-service-role-key');
  console.error('OPENAI_API_KEY=sk-proj-your-openai-key');
  console.error('');
  console.error('Or set them as environment variables before running this script.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

interface CatalogRow {
  // Staples CSV format
  'Seq': string;
  'OEM Number': string;
  'Clover Yield': string;
  'Clover COGS': string;
  'ASE Price': string;
  'MFR NAME': string;
  'DESCRIPTION': string;
  'LONG DESCRIPTION': string;
  'UOM': string;
  'Pack per Quantity': string;
  'Staples Part Number': string;
  'Image Link': string;
  // Add more fields as needed
}

interface Product {
  sku: string;
  product_name: string;
  category: string;
  brand: string;
  model: string;
  unit_price: number;
  bulk_price: number | null;
  bulk_minimum: number | null;
  list_price: number | null;
  cost: number | null;
  page_yield: number | null;
  color_type: string | null;
  size_category: string;
  uom: string;
  pack_quantity: number;
  co2_per_unit: number;
  recyclable: boolean;
  manufacturer: string;
  description: string;
  long_description: string;
  image_url: string | null;
  replaces_products: string[];
  related_skus: string[];
  active: boolean;
}

/**
 * Detect category from product description
 */
function detectCategory(description: string): string {
  const lower = description.toLowerCase();
  
  if (lower.includes('toner')) return 'toner_cartridge';
  if (lower.includes('ink')) return 'ink_cartridge';
  if (lower.includes('cartridge')) return 'ink_cartridge';
  if (lower.includes('printer')) return 'printer';
  if (lower.includes('paper')) return 'paper';
  
  return 'office_supplies';
}

/**
 * Detect color type from description
 */
function detectColorType(description: string): string | null {
  const lower = description.toLowerCase();
  
  if (lower.includes('black') || lower.includes('blk')) return 'black';
  if (lower.includes('cyan') || lower.includes('cyn')) return 'cyan';
  if (lower.includes('magenta') || lower.includes('mag')) return 'magenta';
  if (lower.includes('yellow') || lower.includes('ylw') || lower.includes('yel')) return 'yellow';
  if (lower.includes('tri-color') || lower.includes('tricolor') || lower.includes('color')) return 'color';
  
  return null;
}

/**
 * Detect size category from description
 */
function detectSizeCategory(description: string): string {
  const lower = description.toLowerCase();
  
  if (lower.includes('xxl') || lower.includes('super') || lower.includes('ultra')) return 'xxl';
  if (lower.includes('xl') || lower.includes('high yield') || lower.includes('hi-yield') || lower.includes('extra large')) return 'xl';
  if (lower.includes('standard') || !lower.includes('yield')) return 'standard';
  
  return 'standard';
}

/**
 * Calculate CO2 per unit based on category
 */
function calculateCO2(category: string): number {
  if (category === 'toner_cartridge') return 5.2; // Toner has more CO2
  if (category === 'ink_cartridge') return 2.5;  // Ink has less
  return 1.0; // Other products
}

/**
 * Parse price from string (removes $, commas)
 */
function parsePrice(priceStr: string): number | null {
  if (!priceStr) return null;
  const cleaned = priceStr.replace(/[$,\s]/g, '').trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Parse integer from string
 */
function parseInt(str: string): number | null {
  if (!str) return null;
  const parsed = Number.parseInt(str.trim(), 10);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Extract brand from manufacturer or description
 */
function extractBrand(mfr: string, description: string): string {
  // Common brands
  const brands = ['HP', 'CANON', 'BROTHER', 'EPSON', 'LEXMARK', 'DELL', 'XEROX', 'SAMSUNG', 'TRU RED'];
  
  const combined = (mfr + ' ' + description).toUpperCase();
  
  for (const brand of brands) {
    if (combined.includes(brand)) return brand;
  }
  
  return mfr || 'Unknown';
}

/**
 * Extract model number from OEM number or description
 */
function extractModel(oemNumber: string, description: string): string {
  // Try OEM number first
  if (oemNumber && oemNumber.length > 2) {
    return oemNumber;
  }
  
  // Try to extract from description (e.g., "HP 64" -> "64")
  const matches = description.match(/\b(\d+[A-Z]*|[A-Z]+\d+)\b/);
  return matches ? matches[1] : '';
}

/**
 * Generate embedding for semantic search with retry logic
 */
async function generateEmbedding(text: string, retries = 3): Promise<number[]> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });
      
      return response.data[0].embedding;
    } catch (error: any) {
      if (attempt === retries) {
        console.error(`Failed to generate embedding after ${retries} attempts:`, error.message);
        throw error;
      }
      
      // Exponential backoff: 2s, 4s, 8s
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`⚠️  Retry ${attempt}/${retries} after ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Failed to generate embedding');
}

/**
 * Transform CSV row to Product
 */
function transformRow(row: any): Product | null {
  try {
    const oemNumber = row['OEM Number'] || row['Wholesaler Product Code'] || '';
    const description = row['DESCRIPTION'] || row['Product Description'] || '';
    const longDescription = row['LONG DESCRIPTION'] || description;
    const manufacturer = row['MFR NAME'] || row['Primary Supplier Name'] || '';
    const staplesPartNumber = row['Staples Part Number'] || row['Depot Product Code'] || '';
    
    // Skip if no SKU
    if (!oemNumber && !staplesPartNumber) {
      return null;
    }
    
    const category = detectCategory(description);
    const brand = extractBrand(manufacturer, description);
    const model = extractModel(oemNumber, description);
    
    const product: Product = {
      sku: oemNumber || staplesPartNumber,
      product_name: description,
      category,
      brand,
      model,
      unit_price: parsePrice(row['ASE Price'] || row['STAPLES PRICE']) || 0,
      bulk_price: null, // Can be added later
      bulk_minimum: null,
      list_price: parsePrice(row[' PARTNER LIST PRICE ']) || null,
      cost: parsePrice(row['Clover COGS'] || row[' PARTNER COST ']) || null,
      page_yield: parseInt(row['Clover Yield']) || null,
      color_type: detectColorType(description),
      size_category: detectSizeCategory(description),
      uom: row['UOM'] || 'EA',
      pack_quantity: parseInt(row['Pack per Quantity'] || row['Pack Qty']) || 1,
      co2_per_unit: calculateCO2(category),
      recyclable: true, // Default to recyclable
      manufacturer,
      description,
      long_description: longDescription,
      image_url: row['Image Link'] || null,
      replaces_products: [], // Can be populated from additional data
      related_skus: staplesPartNumber ? [staplesPartNumber] : [],
      active: true,
    };
    
    return product;
  } catch (error) {
    console.error('Error transforming row:', error, row);
    return null;
  }
}

/**
 * Batch insert products with embeddings
 */
async function insertProducts(products: Product[]) {
  const BATCH_SIZE = 50;
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    
    console.log(`📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(products.length / BATCH_SIZE)} (${batch.length} products)`);
    
    // Generate embeddings for batch
    const productsWithEmbeddings = await Promise.all(
      batch.map(async (product) => {
        try {
          // Create embedding text from key fields
          const embeddingText = `${product.brand} ${product.model} ${product.product_name} ${product.sku}`.trim();
          const embedding = await generateEmbedding(embeddingText);
          
          return {
            ...product,
            embedding,
          };
        } catch (error) {
          console.error(`Error generating embedding for ${product.sku}:`, error);
          return null;
        }
      })
    );
    
    // Filter out failed embeddings
    const validProducts = productsWithEmbeddings.filter(p => p !== null);
    
    // Insert batch with retry logic
    let insertSuccess = false;
    let insertAttempts = 0;
    const maxInsertAttempts = 3;
    
    while (!insertSuccess && insertAttempts < maxInsertAttempts) {
      insertAttempts++;
      
      try {
        const { data, error } = await supabase
          .from('master_products')
          .upsert(validProducts, { onConflict: 'sku' });
        
        if (error) {
          if (insertAttempts < maxInsertAttempts) {
            console.log(`⚠️  Insert retry ${insertAttempts}/${maxInsertAttempts}...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          } else {
            console.error(`❌ Error inserting batch:`, error.message);
            errorCount += batch.length;
          }
        } else {
          console.log(`✅ Inserted ${validProducts.length} products`);
          successCount += validProducts.length;
          insertSuccess = true;
        }
      } catch (err: any) {
        if (insertAttempts < maxInsertAttempts) {
          console.log(`⚠️  Network error, retry ${insertAttempts}/${maxInsertAttempts}...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          console.error(`❌ Network error:`, err.message);
          errorCount += batch.length;
        }
      }
    }
    
    // Rate limiting delay (OpenAI has rate limits)
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return { successCount, errorCount };
}

/**
 * Main import function
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('❌ Please provide path to CSV file');
    console.error('Usage: npx tsx scripts/import-master-catalog.ts path/to/catalog.csv');
    process.exit(1);
  }
  
  const csvPath = args[0];
  
  console.log('🚀 Starting master catalog import...');
  console.log(`📄 Reading file: ${csvPath}`);
  
  // Read and parse CSV
  const fileContent = readFileSync(csvPath, 'utf-8');
  const rows = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
  
  console.log(`📊 Found ${rows.length} rows in CSV`);
  
  // Transform rows to products
  console.log('🔄 Transforming data...');
  const allProducts = rows
    .map(transformRow)
    .filter((p): p is Product => p !== null);
  
  console.log(`✨ Transformed ${allProducts.length} valid products`);
  
  // Remove duplicates by SKU (keep first occurrence)
  const seenSkus = new Set<string>();
  const products: Product[] = [];
  let duplicateCount = 0;
  
  for (const product of allProducts) {
    if (!seenSkus.has(product.sku)) {
      seenSkus.add(product.sku);
      products.push(product);
    } else {
      duplicateCount++;
    }
  }
  
  if (duplicateCount > 0) {
    console.log(`⚠️  Removed ${duplicateCount} duplicate SKUs`);
    console.log(`📦 ${products.length} unique products remaining`);
  }
  
  if (products.length === 0) {
    console.error('❌ No valid products to import');
    process.exit(1);
  }
  
  // Show sample product
  console.log('\n📦 Sample product:');
  console.log(JSON.stringify(products[0], null, 2));
  console.log('');
  
  // Confirm import
  console.log(`⚠️  About to import ${products.length} products with OpenAI embeddings`);
  console.log(`💰 Estimated cost: $${(products.length * 0.0001).toFixed(2)} (embeddings)`);
  console.log('');
  
  // Insert products
  const { successCount, errorCount } = await insertProducts(products);
  
  console.log('\n🎉 Import complete!');
  console.log(`✅ Successfully imported: ${successCount} products`);
  console.log(`❌ Errors: ${errorCount} products`);
  console.log('\n📊 Database stats:');
  
  // Get counts by category
  const { data: categoryCounts } = await supabase
    .from('master_products')
    .select('category')
    .eq('active', true);
  
  if (categoryCounts) {
    const counts: Record<string, number> = {};
    categoryCounts.forEach(row => {
      counts[row.category] = (counts[row.category] || 0) + 1;
    });
    
    Object.entries(counts).forEach(([category, count]) => {
      console.log(`  ${category}: ${count} products`);
    });
  }
}

// Run import
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

