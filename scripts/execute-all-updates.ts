#!/usr/bin/env tsx
import { readFileSync } from 'fs';

// Read all UPDATE statements
const sqlContent = readFileSync('/tmp/vendor-sku-updates.sql', 'utf-8');
const allStatements = sqlContent.split('\n').filter(line => line.trim().startsWith('UPDATE'));

console.log(`Total statements: ${allStatements.length}`);
console.log(`Already executed: 60`);
console.log(`Remaining: ${allStatements.length - 60}`);

// Skip the first 60 we already did
const remaining = allStatements.slice(60);

// Split into batches of 50 for output
const BATCH_SIZE = 50;
const batches: string[][] = [];

for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
  batches.push(remaining.slice(i, i + BATCH_SIZE));
}

console.log(`\nCreated ${batches.length} batches to execute\n`);

// Output each batch as a separate file for manual execution
batches.forEach((batch, idx) => {
  console.log(`\n=== BATCH ${idx + 3} (${batch.length} statements) ===`);
  console.log(batch.join('\n'));
  console.log(`\n=== END BATCH ${idx + 3} ===\n`);
});

