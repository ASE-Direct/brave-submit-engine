#!/usr/bin/env tsx

/**
 * Fix Missing Color Types Script
 * 
 * Purpose: Populate missing color_type values by analyzing product names
 * 
 * Strategy:
 * 1. Find products with NULL color_type
 * 2. Detect color from product_name using pattern matching
 * 3. Update database with detected colors
 * 4. Flag uncertain cases for manual review
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

// Color detection patterns (ordered by specificity)
const colorPatterns = [
  // Black variations
  { pattern: /\b(black|blk|bk)\b/i, color: 'black', confidence: 'high' },
  
  // Cyan variations
  { pattern: /\b(cyan|cyn)\b/i, color: 'cyan', confidence: 'high' },
  
  // Magenta variations
  { pattern: /\b(magenta|mag|mgt)\b/i, color: 'magenta', confidence: 'high' },
  
  // Yellow variations
  { pattern: /\b(yellow|ylw|yel)\b/i, color: 'yellow', confidence: 'high' },
  
  // Tri-color / Multi-color
  { pattern: /\b(tri-?color|tricolor|color|multi-?color|c\/m\/y)\b/i, color: 'color', confidence: 'high' },
  { pattern: /\b(CMY|Color Combination)\b/i, color: 'color', confidence: 'high' },
  
  // Light variants
  { pattern: /\blight cyan\b/i, color: 'cyan', confidence: 'high' },
  { pattern: /\blight magenta\b/i, color: 'magenta', confidence: 'high' },
  { pattern: /\blight light black\b/i, color: 'black', confidence: 'medium' },
  
  // Photo colors (specialized)
  { pattern: /\b(photo black|photo cyan|photo magenta)\b/i, color: 'black', confidence: 'medium' },
  
  // Gray variations
  { pattern: /\b(gray|grey)\b/i, color: 'black', confidence: 'medium' },
];

interface ColorDetectionResult {
  color: string | null;
  confidence: 'high' | 'medium' | 'low' | null;
  matchedPattern?: string;
}

function detectColorFromName(productName: string, description?: string): ColorDetectionResult {
  const searchText = `${productName} ${description || ''}`.toLowerCase();
  
  for (const { pattern, color, confidence } of colorPatterns) {
    if (pattern.test(searchText)) {
      return {
        color,
        confidence,
        matchedPattern: pattern.toString()
      };
    }
  }
  
  return {
    color: null,
    confidence: null
  };
}

async function main() {
  console.log('🎨 Starting color_type detection and update...\n');
  
  // Step 1: Get products with missing color_type
  const { data: products, error: fetchError } = await supabase
    .from('master_products')
    .select('id, sku, product_name, description, long_description, category')
    .is('color_type', null)
    .eq('active', true);
  
  if (fetchError) {
    console.error('❌ Error fetching products:', fetchError);
    process.exit(1);
  }
  
  if (!products || products.length === 0) {
    console.log('✅ No products missing color_type!');
    return;
  }
  
  console.log(`📊 Found ${products.length} products with missing color_type\n`);
  
  // Step 2: Detect colors
  const updates: Array<{ id: string; sku: string; color: string; confidence: string; pattern: string }> = [];
  const uncertain: Array<{ id: string; sku: string; product_name: string }> = [];
  
  for (const product of products) {
    const result = detectColorFromName(
      product.product_name,
      product.description || product.long_description
    );
    
    if (result.color && result.confidence === 'high') {
      updates.push({
        id: product.id,
        sku: product.sku,
        color: result.color,
        confidence: result.confidence,
        pattern: result.matchedPattern || 'unknown'
      });
    } else if (result.color && result.confidence === 'medium') {
      updates.push({
        id: product.id,
        sku: product.sku,
        color: result.color,
        confidence: result.confidence,
        pattern: result.matchedPattern || 'unknown'
      });
    } else {
      uncertain.push({
        id: product.id,
        sku: product.sku,
        product_name: product.product_name
      });
    }
  }
  
  // Step 3: Show summary
  console.log(`✅ Detected colors for ${updates.length} products`);
  console.log(`⚠️  Could not detect color for ${uncertain.length} products\n`);
  
  // Group by color
  const colorCounts = updates.reduce((acc, u) => {
    acc[u.color] = (acc[u.color] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log('📊 Color distribution:');
  Object.entries(colorCounts).forEach(([color, count]) => {
    console.log(`   ${color}: ${count} products`);
  });
  console.log('');
  
  // Step 4: Preview updates (first 10)
  console.log('📝 Preview of updates (first 10):');
  updates.slice(0, 10).forEach(u => {
    console.log(`   ${u.sku}: → ${u.color} (${u.confidence} confidence)`);
  });
  console.log('');
  
  // Step 5: Apply updates in batches
  console.log('💾 Applying updates to database...');
  let successCount = 0;
  let errorCount = 0;
  
  for (const update of updates) {
    const { error: updateError } = await supabase
      .from('master_products')
      .update({ color_type: update.color })
      .eq('id', update.id);
    
    if (updateError) {
      console.error(`   ❌ Failed to update ${update.sku}:`, updateError.message);
      errorCount++;
    } else {
      successCount++;
    }
  }
  
  console.log(`\n✅ Successfully updated ${successCount} products`);
  if (errorCount > 0) {
    console.log(`❌ Failed to update ${errorCount} products`);
  }
  
  // Step 6: Show uncertain products for manual review
  if (uncertain.length > 0) {
    console.log(`\n⚠️  Products needing manual review (${uncertain.length}):`);
    console.log('   These products have no clear color indicator in their name:\n');
    uncertain.slice(0, 20).forEach(p => {
      console.log(`   ${p.sku}: ${p.product_name}`);
    });
    
    if (uncertain.length > 20) {
      console.log(`   ... and ${uncertain.length - 20} more`);
    }
    
    // Generate SQL for manual updates
    console.log('\n📝 SQL for manual review (copy to Supabase SQL Editor):');
    console.log('-- Review these products and update color_type manually:');
    uncertain.slice(0, 10).forEach(p => {
      console.log(`SELECT id, sku, product_name, description FROM master_products WHERE sku = '${p.sku}';`);
      console.log(`-- UPDATE master_products SET color_type = 'black' WHERE sku = '${p.sku}'; -- Update color as needed`);
    });
  }
  
  console.log('\n✨ Color detection complete!');
}

main().catch(console.error);

