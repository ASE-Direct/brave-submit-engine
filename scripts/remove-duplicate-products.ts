/**
 * Remove Duplicate Products (Non-R versions where R version exists)
 * 
 * This script:
 * 1. Finds all products with -R suffix
 * 2. For each -R product, checks if a non-R version exists
 * 3. Deletes the non-R version (keeping the -R version)
 * 4. Keeps products without -R if no corresponding -R version exists
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables!');
  console.error('Required: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('🔄 Starting Duplicate Product Removal...\n');

  // Step 1: Get all products with -R suffix
  console.log('📋 Fetching all products with -R suffix...');
  const { data: productsWithR, error: fetchRError } = await supabase
    .from('master_products')
    .select('id, sku')
    .like('sku', '%-R');

  if (fetchRError) {
    console.error('❌ Error fetching -R products:', fetchRError);
    process.exit(1);
  }

  console.log(`✅ Found ${productsWithR?.length || 0} products with -R suffix\n`);

  // Step 2: For each -R product, find and delete the corresponding non-R version
  let deleteCount = 0;
  let notFoundCount = 0;
  const skusToDelete: string[] = [];

  console.log('🔍 Checking for duplicate non-R versions...\n');

  for (const rProduct of productsWithR || []) {
    // Remove -R suffix to get the base SKU
    const baseSku = rProduct.sku.replace(/-R$/, '');
    
    // Check if non-R version exists
    const { data: nonRProduct, error: checkError } = await supabase
      .from('master_products')
      .select('id, sku')
      .eq('sku', baseSku)
      .single();

    if (checkError) {
      if (checkError.code === 'PGRST116') {
        // No non-R version found (this is good)
        notFoundCount++;
      } else {
        console.error(`⚠️  Error checking for ${baseSku}:`, checkError);
      }
      continue;
    }

    if (nonRProduct) {
      console.log(`🗑️  Will delete: ${nonRProduct.sku} (keeping ${rProduct.sku})`);
      skusToDelete.push(nonRProduct.sku);
      deleteCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`📊 Analysis Complete:`);
  console.log(`   - Products with -R suffix: ${productsWithR?.length || 0}`);
  console.log(`   - Duplicates found (to delete): ${deleteCount}`);
  console.log(`   - No duplicate found: ${notFoundCount}`);
  console.log('='.repeat(60) + '\n');

  if (deleteCount === 0) {
    console.log('✨ No duplicates to remove!');
    return;
  }

  // Step 3: Build a mapping of non-R product IDs to their -R counterparts
  console.log(`🔄 Building product ID mapping...\n`);
  const productIdMap = new Map<string, string>(); // old ID -> new ID

  for (const rProduct of productsWithR || []) {
    const baseSku = rProduct.sku.replace(/-R$/, '');
    
    const { data: nonRProduct } = await supabase
      .from('master_products')
      .select('id, sku')
      .eq('sku', baseSku)
      .single();

    if (nonRProduct) {
      productIdMap.set(nonRProduct.id, rProduct.id);
    }
  }

  console.log(`✅ Mapped ${productIdMap.size} product IDs\n`);

  // Step 4: Update foreign key references in order_items_extracted
  console.log(`🔄 Updating foreign key references in order_items_extracted...\n`);
  
  let updatedCount = 0;
  for (const [oldId, newId] of productIdMap.entries()) {
    // Update matched_product_id
    const { error: updateMatchedError } = await supabase
      .from('order_items_extracted')
      .update({ matched_product_id: newId })
      .eq('matched_product_id', oldId);

    if (updateMatchedError) {
      console.error(`⚠️  Error updating matched_product_id:`, updateMatchedError);
    } else {
      updatedCount++;
    }

    // Update recommended_product_id
    const { error: updateRecommendedError } = await supabase
      .from('order_items_extracted')
      .update({ recommended_product_id: newId })
      .eq('recommended_product_id', oldId);

    if (updateRecommendedError) {
      console.error(`⚠️  Error updating recommended_product_id:`, updateRecommendedError);
    }
  }

  console.log(`✅ Updated references for ${updatedCount} products\n`);

  // Step 5: Delete the duplicates
  console.log(`🗑️  Deleting ${deleteCount} duplicate products...\n`);

  const { error: deleteError } = await supabase
    .from('master_products')
    .delete()
    .in('sku', skusToDelete);

  if (deleteError) {
    console.error('❌ Error deleting duplicates:', deleteError);
    process.exit(1);
  }

  console.log(`✅ Successfully deleted ${deleteCount} duplicate products!\n`);

  // Step 4: Verify final counts
  const { count: finalCount, error: countError } = await supabase
    .from('master_products')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('❌ Error getting final count:', countError);
  } else {
    console.log('📊 Final Statistics:');
    console.log(`   - Total products remaining: ${finalCount}`);
    
    const { count: rCount } = await supabase
      .from('master_products')
      .select('*', { count: 'exact', head: true })
      .like('sku', '%-R');
    
    console.log(`   - Products with -R suffix: ${rCount}`);
    console.log(`   - Products without -R suffix: ${(finalCount || 0) - (rCount || 0)}`);
  }

  console.log('\n✨ Duplicate removal complete!');
}

main().catch(console.error);

