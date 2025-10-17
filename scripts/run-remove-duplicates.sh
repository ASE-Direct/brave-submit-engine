#!/bin/bash

# Load environment variables
set -a
source .env
set +a

# Run the duplicate removal script
npx tsx scripts/remove-duplicate-products.ts
