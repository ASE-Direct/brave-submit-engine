#!/bin/bash

# Load environment variables
set -a
source .env
set +a

# Run the import script
npx tsx scripts/import-master-products-from-staples.ts

