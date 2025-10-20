# 🔍 Resend Email Issue - Troubleshooting Guide

## 🚨 Current Problem

**Symptom:** Only 1 recipient receiving emails instead of 3

**Evidence from logs:**
- ✅ Edge Function logs show: `to: ["areyes@gowaffl.com","zjones@gowaffl.com","rwright@gowaffl.com"]`
- ❌ Resend logs show: `"to": ["areyes@gowaffl.com"]` (only 1!)

**This means:** The edge function is sending the correct data, but Resend is filtering/modifying it.

---

## 🎯 Most Likely Cause: Resend Sandbox Mode

### What is Sandbox Mode?

Resend has two modes:
1. **Sandbox/Development Mode** - Only sends to verified email addresses
2. **Production Mode** - Sends to any email address

### How to Check

1. **Log into Resend Dashboard:** https://resend.com/
2. **Check Your API Key:**
   - Go to **Settings** > **API Keys**
   - Look at the key you're using: `RESEND_API_KEY`
   - Check if it says "Testing" or "Production"

3. **Check Domain Verification:**
   - Go to **Domains** section
   - If you're using `onboarding@resend.dev` (the default), you're in sandbox mode
   - Sandbox mode restricts recipients

### Solution Options

#### Option 1: Add Email Addresses to Verified Recipients (Quick Fix)
If you want to keep using sandbox mode for now:

1. Go to Resend Dashboard > **Settings**
2. Look for **Verified Recipients** or **Allowed Recipients**
3. Add these two email addresses:
   - `zjones@gowaffl.com`
   - `rwright@gowaffl.com`
4. Each recipient will get a verification email they need to click

#### Option 2: Upgrade to Production Mode (Proper Fix)

**Step 1: Verify Your Domain**
1. In Resend Dashboard, go to **Domains**
2. Click **Add Domain**
3. Add your domain: `gowaffl.com`
4. Follow instructions to add DNS records (TXT, CNAME)
5. Wait for verification (can take a few minutes to hours)

**Step 2: Update the "from" Address**
Once domain is verified, update the edge function:

```typescript
from: 'BAV Savings Challenge <noreply@gowaffl.com>',
```

**Step 3: Ensure API Key is Production**
- If needed, create a new Production API key in Resend
- Update the Supabase secret:
  ```bash
  export SUPABASE_ACCESS_TOKEN="sbp_b70af96ee4bffd2455a32ec9f0b1f695f129d04f"
  npx supabase secrets set RESEND_API_KEY=your_production_key --project-ref qpiijzpslfjwikigrbol
  ```

---

## 🔍 Alternative Causes to Check

### 1. Resend Account Limits
- Free tier might limit number of recipients
- Check your plan at: https://resend.com/pricing
- Solution: Upgrade if needed

### 2. Email Validation by Resend
Resend might be automatically filtering invalid email addresses:
- Verify the emails are correct:
  - ✅ `zjones@gowaffl.com`
  - ✅ `rwright@gowaffl.com`
- Ask the recipients to check their spam folders

### 3. Array Format Issue
Although unlikely (our logs show correct format), let's verify Resend API expects the format we're using.

**Current format:**
```json
{
  "to": ["email1@domain.com", "email2@domain.com", "email3@domain.com"]
}
```

This is the correct format according to Resend docs.

---

## 🧪 Quick Test

To confirm it's a Resend restriction and not our code, try this test:

### Test 1: Send to Just One Different Email
Temporarily change the recipients array to:
```typescript
const recipients = ['zjones@gowaffl.com'];
```

If this ALSO fails, it confirms Resend is filtering unverified recipients.

### Test 2: Check Resend Dashboard
1. Go to Resend Dashboard > **Logs**
2. Look at the email request
3. Check if Resend is logging any warnings or filters applied

---

## ✅ Recommended Action Plan

### Immediate Fix (10 minutes)
1. Log into Resend Dashboard
2. Check if you're in Sandbox mode
3. If yes, verify the two new email addresses as recipients

### Permanent Fix (1-2 hours)
1. Verify your `gowaffl.com` domain in Resend
2. Update "from" address to use your domain
3. Switch to production API key
4. Test with a submission

---

## 📞 Need Help?

If none of the above works:

1. **Check Resend Support:**
   - Email: support@resend.com
   - Docs: https://resend.com/docs

2. **Resend Status:**
   - Check: https://status.resend.com/
   - Might be a platform issue

3. **Check Resend Logs for Error Messages:**
   - Look for any rejection reasons
   - Might show "recipient not verified" or similar

---

## 🎯 Most Likely Solution

Based on the symptoms, **99% sure this is Resend sandbox mode limiting recipients**.

**Next step:** Log into Resend and verify your account status and add the two email addresses as verified recipients.

