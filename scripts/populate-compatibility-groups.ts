#!/usr/bin/env tsx

/**
 * Populate Compatibility Groups Script
 * 
 * Purpose: Create intelligent compatibility groups and model patterns
 * 
 * Strategy:
 * 1. Analyze existing family_series to identify overly broad groupings
 * 2. Extract model patterns from product names/SKUs
 * 3. Create specific compatibility groups for products that work with same printers
 * 4. Validate family_series specificity
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config();

// Read env
const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables');
  console.error('💡 Make sure you have a .env file with these variables set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Known compatibility groups (manually curated for common products)
const knownGroups = [
  // Brother TN series
  {
    brand: 'BROTHER',
    modelPattern: 'TN7xx',
    compatibilityGroup: 'BROTHER_TN7XX_HLLSERIES',
    skus: ['TN730', 'TN760', 'TN750'],
    printers: ['HL-L2350DW', 'HL-L2370DW', 'HL-L2390DW', 'MFC-L2710DW', 'MFC-L2750DW']
  },
  {
    brand: 'BROTHER',
    modelPattern: 'TN6xx',
    compatibilityGroup: 'BROTHER_TN6XX_HLDCP',
    skus: ['TN630', 'TN660'],
    printers: ['HL-L2300D', 'HL-L2305W', 'DCP-L2520DW', 'DCP-L2540DW', 'MFC-L2700DW']
  },
  {
    brand: 'BROTHER',
    modelPattern: 'TN4xx',
    compatibilityGroup: 'BROTHER_TN4XX_HLMFC',
    skus: ['TN420', 'TN450', 'TN460'],
    printers: ['HL-2270DW', 'HL-2280DW', 'MFC-7360N', 'MFC-7860DW', 'DCP-7065DN']
  },
  {
    brand: 'BROTHER',
    modelPattern: 'TN3xx',
    compatibilityGroup: 'BROTHER_TN3XX_HLMFC',
    skus: ['TN330', 'TN360'],
    printers: ['HL-2140', 'HL-2170W', 'DCP-7030', 'DCP-7040', 'MFC-7340', 'MFC-7840W']
  },
  {
    brand: 'BROTHER',
    modelPattern: 'TN8xx',
    compatibilityGroup: 'BROTHER_TN8XX_HLMFC',
    skus: ['TN820', 'TN850', 'TN880'],
    printers: ['HL-L6200DW', 'MFC-L6700DW', 'MFC-L6800DW']
  },
  {
    brand: 'BROTHER',
    modelPattern: 'TN227',
    compatibilityGroup: 'BROTHER_TN227_HLMFC',
    skus: ['TN227BK', 'TN227C', 'TN227M', 'TN227Y', 'TN223BK', 'TN223C', 'TN223M', 'TN223Y'],
    printers: ['HL-L3210CW', 'HL-L3230CDW', 'HL-L3270CDW', 'MFC-L3710CW', 'MFC-L3750CDW']
  },
  {
    brand: 'BROTHER',
    modelPattern: 'TN221',
    compatibilityGroup: 'BROTHER_TN221_HL3140',
    skus: ['TN221BK', 'TN221C', 'TN221M', 'TN221Y', 'TN225BK', 'TN225C', 'TN225M', 'TN225Y'],
    printers: ['HL-3140CW', 'HL-3170CDW', 'HL-3180CDW', 'MFC-9130CW', 'MFC-9330CDW', 'MFC-9340CDW']
  },
  
  // HP 64 series (ink)
  {
    brand: 'HP',
    modelPattern: 'HP 64',
    compatibilityGroup: 'HP_64_ENVY',
    skus: ['N9J90AN', 'N9J91AN', 'N9J92AN'], // 64, 64XL
    printers: ['ENVY 6200', 'ENVY 7100', 'ENVY 7800', 'ENVY Photo 6200', 'ENVY Photo 7100']
  },
  
  // HP 902/902XL series (ink)
  {
    brand: 'HP',
    modelPattern: 'HP 902',
    compatibilityGroup: 'HP_902_OFFICEJET',
    skus: ['T6L98AN', 'T6M02AN', 'T6M06AN', 'T6M10AN', 'T6L94AN', 'T6L95AN', 'T6L96AN', 'T6L97AN'],
    printers: ['OfficeJet 6950', 'OfficeJet 6954', 'OfficeJet Pro 6960', 'OfficeJet Pro 6970']
  },
  
  // Canon PG-240/CL-241 series (ink)
  {
    brand: 'CANON',
    modelPattern: 'PG-24x',
    compatibilityGroup: 'CANON_PG240_PIXMA',
    skus: ['5207B001', '5206B001'], // PG-240, PG-240XL
    printers: ['PIXMA MG2120', 'PIXMA MG3120', 'PIXMA MG3220', 'PIXMA MX372', 'PIXMA MX432', 'PIXMA MX512']
  },
  {
    brand: 'CANON',
    modelPattern: 'PG-24x',
    compatibilityGroup: 'CANON_PG245_PIXMA',
    skus: ['8279B001', '8278B001'], // PG-245, PG-245XL
    printers: ['PIXMA MG2420', 'PIXMA MG2520', 'PIXMA MG2920', 'PIXMA MX492', 'PIXMA iP2820']
  },
  
  // Xerox Phaser/WorkCentre series
  {
    brand: 'XEROX',
    modelPattern: '106R03xxx',
    compatibilityGroup: 'XEROX_PHASER6510_WC6515',
    skus: ['106R03584', '106R03585', '106R03586', '106R03587', '106R03690', '106R03691', '106R03692'],
    printers: ['Phaser 6510', 'WorkCentre 6515']
  },
  {
    brand: 'XEROX',
    modelPattern: '106R02xxx',
    compatibilityGroup: 'XEROX_PHASER6500_WC6505',
    skus: ['106R02756', '106R02757', '106R02758', '106R02755', '106R02775', '106R02776', '106R02777', '106R02778'],
    printers: ['Phaser 6500', 'WorkCentre 6505']
  }
];

interface ModelPatternRule {
  pattern: RegExp;
  extract: (match: RegExpMatchArray) => string;
}

// Rules for extracting model patterns
const modelPatternRules: ModelPatternRule[] = [
  // Brother TN series: TN730 → TN7xx
  {
    pattern: /\bTN(\d)(\d{2})\b/,
    extract: (m) => `TN${m[1]}xx`
  },
  
  // HP series: HP 64 → HP 64
  {
    pattern: /\bHP\s+(\d{2,3})(XL)?\b/i,
    extract: (m) => `HP ${m[1]}`
  },
  
  // Canon PG/CL series: PG-240 → PG-24x
  {
    pattern: /\b(PG|CL)-?(\d)(\d{2})(XL)?\b/i,
    extract: (m) => `${m[1]}-${m[2]}x`
  },
  
  // Xerox 106R: 106R03584 → 106R03xxx
  {
    pattern: /\b106R(\d{2})\d{3}\b/,
    extract: (m) => `106R${m[1]}xxx`
  },
  
  // Generic cartridge number pattern: TN227BK → TN227
  {
    pattern: /\b(TN|LC|DR)(\d{3,4})(BK|C|M|Y|CL)?\b/i,
    extract: (m) => `${m[1]}${m[2]}`
  }
];

function extractModelPattern(productName: string, sku: string): string | null {
  const searchText = `${productName} ${sku}`;
  
  for (const rule of modelPatternRules) {
    const match = searchText.match(rule.pattern);
    if (match) {
      return rule.extract(match);
    }
  }
  
  return null;
}

async function main() {
  console.log('🔧 Starting compatibility group population...\n');
  
  // Step 1: Apply known compatibility groups
  console.log('📦 Applying known compatibility groups...');
  let appliedCount = 0;
  
  for (const group of knownGroups) {
    for (const sku of group.skus) {
      const { error } = await supabase
        .from('master_products')
        .update({
          compatibility_group: group.compatibilityGroup,
          model_pattern: group.modelPattern
        })
        .eq('sku', sku)
        .eq('brand', group.brand);
      
      if (error) {
        console.error(`   ❌ Error updating ${sku}:`, error.message);
      } else {
        appliedCount++;
      }
    }
  }
  
  console.log(`✅ Applied ${appliedCount} known compatibility groups\n`);
  
  // Step 2: Auto-detect model patterns for remaining products
  console.log('🔍 Auto-detecting model patterns...');
  
  const { data: products, error: fetchError } = await supabase
    .from('master_products')
    .select('id, sku, product_name, brand, model')
    .is('model_pattern', null)
    .eq('active', true);
  
  if (fetchError) {
    console.error('❌ Error fetching products:', fetchError);
    return;
  }
  
  if (!products || products.length === 0) {
    console.log('✅ All products have model patterns!\n');
  } else {
    console.log(`📊 Found ${products.length} products without model patterns\n`);
    
    let detectedCount = 0;
    const detected: Array<{ sku: string; pattern: string }> = [];
    
    for (const product of products) {
      const pattern = extractModelPattern(product.product_name, product.sku);
      
      if (pattern) {
        detected.push({ sku: product.sku, pattern });
        
        const { error } = await supabase
          .from('master_products')
          .update({ model_pattern: pattern })
          .eq('id', product.id);
        
        if (!error) {
          detectedCount++;
        }
      }
    }
    
    console.log(`✅ Auto-detected ${detectedCount} model patterns`);
    
    // Show sample
    if (detected.length > 0) {
      console.log('\n📝 Sample detected patterns:');
      detected.slice(0, 10).forEach(d => {
        console.log(`   ${d.sku} → ${d.pattern}`);
      });
    }
  }
  
  // Step 3: Analyze family_series for overly broad groupings
  console.log('\n🔍 Analyzing family_series specificity...');
  
  const { data: familyStats, error: statsError } = await supabase
    .from('master_products')
    .select('family_series')
    .eq('active', true);
  
  if (!statsError && familyStats) {
    const familyCounts = familyStats.reduce((acc, p) => {
      const family = p.family_series || 'NULL';
      acc[family] = (acc[family] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const largeFamilies = Object.entries(familyCounts)
      .filter(([_, count]) => count > 10)
      .sort((a, b) => b[1] - a[1]);
    
    if (largeFamilies.length > 0) {
      console.log('\n⚠️  Overly broad family_series (>10 products):');
      largeFamilies.slice(0, 10).forEach(([family, count]) => {
        console.log(`   ${family}: ${count} products`);
      });
      
      console.log('\n💡 Recommendation: Consider breaking these into smaller compatibility groups');
    }
  }
  
  // Step 4: Summary statistics
  console.log('\n📊 Final Statistics:');
  
  const { data: stats } = await supabase
    .from('master_products')
    .select('compatibility_group, model_pattern')
    .eq('active', true);
  
  if (stats) {
    const withCompatGroup = stats.filter(s => s.compatibility_group).length;
    const withModelPattern = stats.filter(s => s.model_pattern).length;
    const total = stats.length;
    
    console.log(`   Total active products: ${total}`);
    console.log(`   With compatibility_group: ${withCompatGroup} (${((withCompatGroup/total)*100).toFixed(1)}%)`);
    console.log(`   With model_pattern: ${withModelPattern} (${((withModelPattern/total)*100).toFixed(1)}%)`);
  }
  
  console.log('\n✨ Compatibility group population complete!');
  console.log('\n📝 Next steps:');
  console.log('   1. Review overly broad family_series groupings');
  console.log('   2. Add more known compatibility groups for common products');
  console.log('   3. Extract compatible printer models from product descriptions');
  console.log('   4. Run test processing jobs to verify improvements');
}

main().catch(console.error);

