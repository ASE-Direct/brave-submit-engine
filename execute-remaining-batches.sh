#!/bin/bash

# This script will output all remaining SQL batches that need to be manually executed
# through the Supabase tool

TOTAL=1490
DONE=110
BATCH_SIZE=50

echo "Total statements: $TOTAL"
echo "Already executed: $DONE"
REMAINING=$((TOTAL - DONE))
echo "Remaining: $REMAINING"
echo ""

# Calculate number of batches
NUM_BATCHES=$(( (REMAINING + BATCH_SIZE - 1) / BATCH_SIZE ))
echo "Number of batches needed: $NUM_BATCHES"
echo ""

# Extract all UPDATE statements
grep "^UPDATE" /tmp/vendor-sku-updates.sql > /tmp/all-updates.sql

# Loop through batches and output each one
for ((i=0; i<$NUM_BATCHES; i++)); do
  START=$((DONE + i * BATCH_SIZE + 1))
  BATCH_NUM=$((i + 4))  # Start from batch 4 since we did 1-3
  
  echo "=== BATCH $BATCH_NUM ===" 
  echo "Statements $START-$((START + BATCH_SIZE - 1))"
  tail -n +$START /tmp/all-updates.sql | head -$BATCH_SIZE
  echo ""
done

