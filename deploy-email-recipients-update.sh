#!/bin/bash

# Email Recipients Update Deployment Script
# Adds zjones@gowaffl.com and rwright@gowaffl.com to email notifications
# Date: October 19, 2025

echo "================================================"
echo "📧 EMAIL RECIPIENTS UPDATE - DEPLOYMENT"
echo "================================================"
echo ""
echo "This script will deploy the updated send-notification-email function"
echo "with three recipients instead of one."
echo ""
echo "Recipients:"
echo "  ✅ areyes@gowaffl.com"
echo "  ✅ zjones@gowaffl.com (NEW)"
echo "  ✅ rwright@gowaffl.com (NEW)"
echo ""
echo "================================================"
echo ""

# Set Supabase credentials
export SUPABASE_ACCESS_TOKEN="sbp_b70af96ee4bffd2455a32ec9f0b1f695f129d04f"
PROJECT_REF="qpiijzpslfjwikigrbol"

echo "🔐 Using Supabase access token authentication"
echo "📍 Project: $PROJECT_REF"
echo ""

# Deploy the updated function
echo "================================================"
echo "📤 DEPLOYING send-notification-email function..."
echo "================================================"
echo ""

npx supabase functions deploy send-notification-email --project-ref $PROJECT_REF --no-verify-jwt

if [ $? -eq 0 ]; then
    echo ""
    echo "================================================"
    echo "✅ DEPLOYMENT SUCCESSFUL"
    echo "================================================"
    echo ""
    echo "The email notification system now sends to:"
    echo "  • areyes@gowaffl.com"
    echo "  • zjones@gowaffl.com"
    echo "  • rwright@gowaffl.com"
    echo ""
    echo "All three recipients will receive:"
    echo "  • Customer information"
    echo "  • Link to uploaded document (72-hour expiry)"
    echo "  • Link to internal report (72-hour expiry)"
    echo ""
    echo "================================================"
    echo ""
else
    echo ""
    echo "================================================"
    echo "❌ DEPLOYMENT FAILED"
    echo "================================================"
    echo ""
    echo "Please check the error messages above and try again."
    echo ""
    echo "Common issues:"
    echo "  1. Not linked to a Supabase project"
    echo "     Fix: supabase link --project-ref YOUR_PROJECT_REF"
    echo ""
    echo "  2. RESEND_API_KEY not set"
    echo "     Fix: supabase secrets set RESEND_API_KEY=your_key_here"
    echo ""
    exit 1
fi

