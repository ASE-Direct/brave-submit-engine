#!/bin/bash

# Deploy Customer PDF Updates (W9 + Page 2 Redesign)
# Date: October 20, 2025

echo "🚀 Deploying Customer PDF Updates..."
echo ""
echo "Changes being deployed:"
echo "  ✓ W9 form insertion (page 3)"
echo "  ✓ Page 2 layout redesign (vertical metrics)"
echo "  ✓ Enhanced benefits section with checkmarks"
echo ""

# Set Supabase access token and project ref
export SUPABASE_ACCESS_TOKEN="sbp_b70af96ee4bffd2455a32ec9f0b1f695f129d04f"
PROJECT_REF="qpiijzpslfjwikigrbol"

# Deploy the process-document function (contains the updated PDF generator)
echo "📦 Deploying process-document function..."
npx supabase functions deploy process-document --project-ref $PROJECT_REF --no-verify-jwt

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment successful!"
    echo ""
    echo "📋 Next steps:"
    echo "  1. Test by uploading a CSV file"
    echo "  2. Verify the generated PDF has:"
    echo "     - Page 1: Executive Summary"
    echo "     - Page 2: Redesigned Environmental Impact (vertical layout)"
    echo "     - Page 3: W9 Form"
    echo "     - Page 4: Contact Info"
    echo ""
    echo "🔍 Monitor logs with:"
    echo "  npx supabase functions logs process-document --project-ref $PROJECT_REF"
else
    echo ""
    echo "❌ Deployment failed. Check errors above."
    exit 1
fi

