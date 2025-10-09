/**
 * Generate SQL to Update Extended Descriptions
 * 
 * Reads the master catalog CSV and generates SQL UPDATE statements
 * to update the description and long_description fields.
 */

import * as fs from 'fs';
import * as path from 'path';

interface CatalogRow {
  aseCloverNumber: string;
  description: string;
  longDescription: string;
  extendedDescription: string;
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
 * Clean and normalize text, escape SQL strings
 */
function cleanText(text: string): string {
  if (!text) return '';
  return text
    .replace(/^["']|["']$/g, '') // Remove surrounding quotes
    .replace(/""/g, '"') // Unescape quotes
    .replace(/'/g, "''") // Escape single quotes for SQL
    .trim();
}

/**
 * Main function to generate SQL
 */
async function generateSQL() {
  console.log('📝 Generating Extended Description Update SQL...\n');
  
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
  
  const sqlStatements: string[] = [];
  let processed = 0;
  let skipped = 0;
  
  for (const line of dataLines) {
    try {
      const fields = parseCSVLine(line);
      
      if (fields.length < 22) {
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
      
      // Generate UPDATE statement
      // Update based on matching sku, oem_number, or wholesaler_sku
      const sql = `
-- Update ${aseCloverNumber}
UPDATE master_products
SET 
  description = '${finalDescription}',
  long_description = '${finalLongDescription}',
  updated_at = NOW()
WHERE sku = '${aseCloverNumber}' 
   OR oem_number = '${aseCloverNumber}' 
   OR wholesaler_sku = '${aseCloverNumber}';
`;
      
      sqlStatements.push(sql);
      processed++;
      
    } catch (error) {
      console.error(`  ❌ Error processing line:`, error);
      skipped++;
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('📊 Processing Summary:');
  console.log('='.repeat(70));
  console.log(`✅ SQL statements generated: ${processed}`);
  console.log(`⊘ Skipped (no SKU/data): ${skipped}`);
  console.log('='.repeat(70));
  
  // Write SQL to file
  const outputPath = path.join(process.cwd(), 'scripts', 'update-descriptions.sql');
  const sqlContent = `-- Extended Description Update
-- Generated: ${new Date().toISOString()}
-- Total statements: ${processed}

BEGIN;

${sqlStatements.join('\n')}

COMMIT;
`;
  
  fs.writeFileSync(outputPath, sqlContent, 'utf-8');
  console.log(`\n📄 SQL file written to: ${outputPath}`);
  console.log(`\n💡 Run this migration using Supabase CLI:`);
  console.log(`   supabase db execute -f scripts/update-descriptions.sql`);
  console.log(`\n   Or apply via migration:`);
  console.log(`   Create a new migration and paste the SQL content`);
}

// Run the generator
generateSQL().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

