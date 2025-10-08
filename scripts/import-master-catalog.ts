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
import * as XLSX from 'xlsx';
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
  
  // NEW: Canonical fields for deterministic matching
  family_series: string | null;
  yield_class: 'standard' | 'high' | 'extra_high' | 'super_high' | null;
  compatible_printers: string[] | null;
  oem_vs_compatible: 'OEM' | 'reman' | 'compatible';
  uom_std: string;
  pack_qty_std: number;
  ase_unit_price: number;
  inventory_status: 'in_stock' | 'low' | 'oos' | null;
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
 * Detect yield class (maps size_category to yield_class)
 */
function detectYieldClass(description: string, sizeCategory: string): 'standard' | 'high' | 'extra_high' | 'super_high' {
  const lower = description.toLowerCase();
  
  // Super high yield (XXXL)
  if (lower.includes('super high') || lower.includes('ultra high') || lower.includes('xxxl')) {
    return 'super_high';
  }
  
  // Extra high yield (XXL)
  if (lower.includes('extra high') || lower.includes('xxl') || sizeCategory === 'xxl') {
    return 'extra_high';
  }
  
  // High yield (XL)
  if (lower.includes('high yield') || lower.includes('hi-yield') || lower.includes('xl') || sizeCategory === 'xl') {
    return 'high';
  }
  
  // Standard
  return 'standard';
}

/**
 * Extract family/series from brand, model, and description
 * Examples: "Brother TN7xx", "HP 64", "Canon PG-245", "Epson 288"
 */
function extractFamilySeries(brand: string, model: string, sku: string, description: string): string | null {
  if (!brand) return null;
  
  // Clean up brand name
  const cleanBrand = brand.trim().toUpperCase();
  
  // Try to extract series from model number
  if (model && model.length > 1) {
    // Remove size suffixes (XL, XXL, etc.) to get base series
    const baseModel = model
      .replace(/[-_\s]/g, '')
      .replace(/X+L$/i, '')
      .replace(/(HIGH|HI|EXTRA|SUPER).*YIELD/i, '')
      .trim();
    
    if (baseModel.length > 0) {
      // For numeric series, generalize (e.g., "TN760" → "TN7xx")
      if (/\d{3,}/.test(baseModel)) {
        const generalized = baseModel.replace(/\d+$/, (match) => {
          // Keep first digit(s), replace rest with 'x'
          if (match.length >= 3) {
            return match[0] + 'x'.repeat(match.length - 1);
          }
          return match;
        });
        return `${cleanBrand} ${generalized}`;
      }
      
      // For alphanumeric series, use as-is (e.g., "PG-245")
      return `${cleanBrand} ${baseModel}`;
    }
  }
  
  // Try to extract from SKU
  if (sku && sku.length > 2) {
    const cleanSku = sku.replace(/[-_\s]/g, '').toUpperCase();
    // Extract letters + first few digits
    const match = cleanSku.match(/^([A-Z]+\d{1,2})/);
    if (match) {
      return `${cleanBrand} ${match[1]}xx`;
    }
  }
  
  // Fallback: use brand + first word of model
  if (model) {
    const firstWord = model.split(/[\s\-_]/)[0];
    return `${cleanBrand} ${firstWord}`;
  }
  
  return cleanBrand;
}

/**
 * Detect OEM vs Compatible vs Remanufactured
 */
function detectOemType(manufacturer: string, brand: string, description: string): 'OEM' | 'reman' | 'compatible' {
  const combined = `${manufacturer} ${brand} ${description}`.toLowerCase();
  
  // Check for remanufactured keywords
  if (combined.includes('reman') || combined.includes('remanufactured') || combined.includes('refurb')) {
    return 'reman';
  }
  
  // Check for compatible/generic keywords
  if (combined.includes('compatible') || combined.includes('generic') || combined.includes('aftermarket')) {
    return 'compatible';
  }
  
  // Check if brand matches manufacturer (likely OEM)
  const cleanBrand = brand.toLowerCase().trim();
  const cleanMfr = manufacturer.toLowerCase().trim();
  
  if (cleanBrand && cleanMfr && (cleanMfr.includes(cleanBrand) || cleanBrand.includes(cleanMfr))) {
    return 'OEM';
  }
  
  // Known OEM brands
  const oemBrands = ['hp', 'canon', 'brother', 'epson', 'lexmark', 'dell', 'xerox', 'samsung', 'kyocera'];
  if (oemBrands.some(oem => combined.includes(oem))) {
    return 'OEM';
  }
  
  // Default to OEM (safer assumption)
  return 'OEM';
}

/**
 * Normalize UOM to standard values
 */
function normalizeUOM(uom: string | undefined): string {
  if (!uom) return 'EA';
  
  const lower = uom.toLowerCase().trim();
  if (lower === 'ea' || lower === 'each') return 'EA';
  if (lower === 'bx' || lower === 'box') return 'BX';
  if (lower === 'cs' || lower === 'case') return 'CS';
  if (lower === 'pk' || lower === 'pack' || lower === 'package') return 'PK';
  if (lower === 'ct' || lower === 'carton') return 'CT';
  
  return 'EA'; // Default to each
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
    const sizeCategory = detectSizeCategory(description);
    const yieldClass = detectYieldClass(description, sizeCategory);
    const packQty = parseInt(row['Pack per Quantity'] || row['Pack Qty']) || 1;
    const unitPrice = parsePrice(row['ASE Price'] || row['STAPLES PRICE']) || 0;
    const normalizedUom = normalizeUOM(row['UOM']);
    
    // Calculate normalized ASE price (per-each basis)
    const aseUnitPrice = unitPrice / Math.max(packQty, 1);
    
    const product: Product = {
      sku: oemNumber || staplesPartNumber,
      product_name: description,
      category,
      brand,
      model,
      unit_price: unitPrice,
      bulk_price: null, // Can be added later
      bulk_minimum: null,
      list_price: parsePrice(row['PARTNER LIST PRICE']) || null,
      cost: parsePrice(row['Clover COGS'] || row['PARTNER COST']) || null,
      page_yield: parseInt(row['Clover Yield']) || null,
      color_type: detectColorType(description),
      size_category: sizeCategory,
      uom: row['UOM'] || 'EA',
      pack_quantity: packQty,
      co2_per_unit: calculateCO2(category),
      recyclable: true, // Default to recyclable
      manufacturer,
      description,
      long_description: longDescription,
      image_url: row['Image Link'] || null,
      replaces_products: [], // Can be populated from additional data
      related_skus: staplesPartNumber ? [staplesPartNumber] : [],
      active: true,
      
      // NEW: Canonical fields
      family_series: extractFamilySeries(brand, model, oemNumber || staplesPartNumber, description),
      yield_class: yieldClass,
      compatible_printers: null, // Can be populated from additional data
      oem_vs_compatible: detectOemType(manufacturer, brand, description),
      uom_std: normalizedUom,
      pack_qty_std: packQty,
      ase_unit_price: aseUnitPrice,
      inventory_status: 'in_stock', // Default to in stock
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
    console.error('❌ Please provide path to CSV or Excel file');
    console.error('Usage: npx tsx scripts/import-master-catalog.ts path/to/catalog.csv');
    console.error('       npx tsx scripts/import-master-catalog.ts path/to/catalog.xlsx');
    process.exit(1);
  }
  
  const filePath = args[0];
  const isExcel = filePath.toLowerCase().endsWith('.xlsx') || filePath.toLowerCase().endsWith('.xls');
  
  console.log('🚀 Starting master catalog import...');
  console.log(`📄 Reading file: ${filePath}`);
  
  let rows: any[];
  
  if (isExcel) {
    // Read and parse Excel file
    console.log('📊 Parsing Excel file...');
    const fileBuffer = readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    console.log(`   Using sheet: ${sheetName}`);
    
    // Convert to JSON with headers
    const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { 
      header: undefined, // Use first row as headers
      raw: false, // Convert dates and numbers to strings
      defval: '' // Default value for empty cells
    });
    
    // Normalize column names by trimming whitespace
    rows = rawRows.map((row: any) => {
      const normalizedRow: any = {};
      for (const [key, value] of Object.entries(row)) {
        normalizedRow[key.trim()] = value;
      }
      return normalizedRow;
    });
  } else {
    // Read and parse CSV
    console.log('📊 Parsing CSV file...');
    const fileContent = readFileSync(filePath, 'utf-8');
    rows = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  }
  
  console.log(`📊 Found ${rows.length} rows`);
  
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

