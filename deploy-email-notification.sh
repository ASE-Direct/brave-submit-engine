#!/bin/bash

# Email Notification System Deployment Script
# This script deploys the email notification system to Supabase

set -e  # Exit on any error

echo "🚀 Deploying Email Notification System"
echo "======================================"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Error: Supabase CLI is not installed"
    echo "Install it with: npm install -g supabase"
    exit 1
fi

echo "✅ Supabase CLI found"
echo ""

# Step 1: Check/Set API Key
echo "📝 Step 1: Configuring Resend API Key"
echo "--------------------------------------"
echo "Setting RESEND_API_KEY secret..."
supabase secrets set RESEND_API_KEY=re_dfAq3DA5_562WRM5RR7U4H36dd1HcSpQU

if [ $? -eq 0 ]; then
    echo "✅ RESEND_API_KEY configured successfully"
else
    echo "⚠️  Warning: Could not set RESEND_API_KEY automatically"
    echo "Please set it manually in Supabase Dashboard:"
    echo "https://supabase.com/dashboard/project/qpiijzpslfjwikigrbol/settings/functions"
fi
echo ""

# Step 2: Deploy Email Function
echo "📧 Step 2: Deploying send-notification-email Function"
echo "------------------------------------------------------"
supabase functions deploy send-notification-email

if [ $? -eq 0 ]; then
    echo "✅ send-notification-email deployed successfully"
else
    echo "❌ Error: Failed to deploy send-notification-email"
    exit 1
fi
echo ""

# Step 3: Redeploy Process Document Function
echo "🔄 Step 3: Redeploying process-document Function"
echo "-------------------------------------------------"
supabase functions deploy process-document

if [ $? -eq 0 ]; then
    echo "✅ process-document redeployed successfully"
else
    echo "❌ Error: Failed to redeploy process-document"
    exit 1
fi
echo ""

# Summary
echo "🎉 Deployment Complete!"
echo "======================="
echo ""
echo "✅ Email notification system is now live"
echo "✅ Emails will be sent to: areyes@gowaffl.com"
echo "✅ Notifications trigger after successful document processing"
echo ""
echo "📋 Next Steps:"
echo "1. Test the system with a document submission"
echo "2. Check your email at areyes@gowaffl.com"
echo "3. Verify signed URLs work by clicking download buttons"
echo ""
echo "🔍 Monitor logs with:"
echo "   supabase functions logs send-notification-email --limit 20"
echo "   supabase functions logs process-document --limit 20"
echo ""
echo "📖 Full documentation: EMAIL_NOTIFICATION_IMPLEMENTATION.md"
echo ""

