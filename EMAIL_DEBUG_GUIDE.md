# Email Notification Debug Guide

**Date:** October 19, 2025  
**Status:** Enhanced debug logging deployed

---

## 🔧 Debug Logging Added

I've added comprehensive debug logging to the email notification process to help identify where the issue is occurring. The logs will now show:

### What to Look For in Logs

When a document completes processing, you should see these messages in the `process-document` function logs:

```
📧 ========================================
📧 STARTING EMAIL NOTIFICATION PROCESS
📧 ========================================
📧 Submission ID: [UUID]
📧 Step 1: Fetching submission data from database...
✅ Submission data fetched successfully
   Phone: [phone number]
   File name: [filename]
   File URL: [storage URL]
📧 Step 2: Generating signed URL for internal report...
   Path: [UUID]/report-internal.pdf
✅ Internal report signed URL generated
📧 Step 3: Generating signed URL for uploaded document...
   Using file_url path: [path] OR Using fallback path: [path]
✅ Uploaded document signed URL generated
📧 Both signed URLs generated successfully:
   Uploaded doc: [URL...]
   Internal report: [URL...]
📧 Step 4: Calling send-notification-email function...
   Endpoint: https://qpiijzpslfjwikigrbol.supabase.co/functions/v1/send-notification-email
   User: [Name] ([Company])
📧 Email payload prepared: [JSON object]
📧 Email function response status: 200 OK
🎉 EMAIL SUCCESS: Email notification sent successfully!
   Email ID: [Resend email ID]
📧 ========================================
```

### Possible Error Messages

If something fails, you'll see one of these:

**Database Fetch Failed:**
```
❌ EMAIL FAILED: Could not fetch submission for email
   Error: [error details]
   Submission ID: [UUID]
```

**Internal Report URL Failed:**
```
❌ EMAIL FAILED: Could not generate internal report signed URL
   Error: [error details]
   Path tried: [UUID]/report-internal.pdf
```

**Uploaded Document URL Failed:**
```
❌ EMAIL FAILED: Could not generate uploaded document signed URL
   Error: [error details]
   Path tried: [path]
   File URL from DB: [URL]
   File name from DB: [filename]
```

**Email API Failed:**
```
❌ EMAIL FAILED: Email notification API returned error
   Status: [HTTP status]
   Response: [error text]
```

**Exception Caught:**
```
❌ EMAIL EXCEPTION: Email notification error (non-fatal)
   Error: [error object]
   Stack: [stack trace]
```

---

## 🧪 Testing Steps

### Step 1: Submit a Test Document

1. Go to your application
2. Fill out the form completely
3. Upload a test document (CSV or Excel)
4. Submit and wait for processing to complete

### Step 2: Check Supabase Dashboard Logs

Since the CLI logs command isn't working with the access token format, use the Supabase Dashboard:

1. Go to: https://supabase.com/dashboard/project/qpiijzpslfjwikigrbol/logs/edge-functions
2. Select the `process-document` function from the dropdown
3. Look for the most recent execution
4. Search for "📧" to find email-related logs

### Step 3: Analyze the Logs

Look for where the process stops:

**Scenario A: No email logs at all**
- The email notification code isn't being reached
- Check if processing is completing successfully
- Look for errors before the email trigger

**Scenario B: Email logs start but stop at Step 1**
- Database query is failing
- Check if `document_submissions` table has the required data
- Verify submission ID exists

**Scenario C: Email logs stop at Step 2**
- Internal report PDF isn't accessible
- Check storage bucket for file existence
- Path: `[UUID]/report-internal.pdf`

**Scenario D: Email logs stop at Step 3**
- Uploaded document isn't accessible
- Check the `file_url` value in database
- Verify file exists in storage at that path

**Scenario E: Email logs stop at Step 4**
- Email function call is failing
- Check if `send-notification-email` function is deployed
- Verify `RESEND_API_KEY` is configured
- Check send-notification-email function logs

---

## 🔍 Manual Verification Steps

### Verify Files Exist in Storage

1. Go to: https://supabase.com/dashboard/project/qpiijzpslfjwikigrbol/storage/buckets/document-submissions
2. Find the most recent submission folder (UUID)
3. Check for these files:
   - `report-internal.pdf` ✅ Should exist
   - Original uploaded file (e.g., `sample.xlsx`) ✅ Should exist
   - `report.pdf` (customer report) ✅ Should exist

### Verify Database Record

Run this query in the SQL Editor:

```sql
SELECT 
  id,
  first_name,
  last_name,
  company,
  email,
  phone,
  file_name,
  file_url,
  created_at
FROM document_submissions
ORDER BY created_at DESC
LIMIT 1;
```

Check that:
- `phone` has a value
- `file_name` has the original filename
- `file_url` has a storage path

### Test Email Function Directly

You can test the email function independently:

```bash
curl -X POST https://qpiijzpslfjwikigrbol.supabase.co/functions/v1/send-notification-email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sbp_b70af96ee4bffd2455a32ec9f0b1f695f129d04f" \
  -d '{
    "userInfo": {
      "firstName": "Test",
      "lastName": "User",
      "company": "Test Company",
      "email": "test@example.com",
      "phone": "(555) 555-5555"
    },
    "uploadedDocumentUrl": "https://example.com/test-doc.pdf",
    "internalReportUrl": "https://example.com/test-report.pdf"
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "Email notification sent",
  "emailId": "re_..."
}
```

---

## 🐛 Common Issues & Solutions

### Issue 1: File Path Mismatch

**Problem:** Uploaded document signed URL generation fails

**Solution:** The enhanced code now:
1. First tries to use `file_url` from the database
2. Extracts the path portion after `/document-submissions/`
3. Falls back to `{submissionId}/{file_name}` if `file_url` is empty

Check the logs to see which path it's using and verify that path exists in storage.

### Issue 2: RESEND_API_KEY Not Found

**Problem:** Email function returns 500 error "RESEND_API_KEY not configured"

**Verify secret is set:**
```bash
export SUPABASE_ACCESS_TOKEN="sbp_b70af96ee4bffd2455a32ec9f0b1f695f129d04f"
npx supabase secrets list --project-ref qpiijzpslfjwikigrbol
```

Should show `RESEND_API_KEY` in the list.

**Re-set if needed:**
```bash
npx supabase secrets set RESEND_API_KEY=re_dfAq3DA5_562WRM5RR7U4H36dd1HcSpQU --project-ref qpiijzpslfjwikigrbol
```

### Issue 3: Email Function Not Deployed

**Problem:** 404 error when calling send-notification-email

**Verify deployment:**
```bash
export SUPABASE_ACCESS_TOKEN="sbp_b70af96ee4bffd2455a32ec9f0b1f695f129d04f"
npx supabase functions list --project-ref qpiijzpslfjwikigrbol
```

Should show `send-notification-email` in the list.

**Redeploy if needed:**
```bash
npx supabase functions deploy send-notification-email --project-ref qpiijzpslfjwikigrbol --no-verify-jwt
```

### Issue 4: Storage Permissions

**Problem:** "Access denied" when generating signed URLs

**Check:** Service role should have full access to storage. This is configured in Supabase dashboard under Storage → Policies.

---

## 📊 Next Steps

1. **Submit a test document** through your application
2. **Check the logs** in Supabase Dashboard
3. **Share the log output** - Copy the email-related logs (search for "📧")
4. **I'll analyze** where the process is failing and provide a fix

The enhanced logging will tell us exactly where the issue is occurring!

---

## 🎯 Expected Behavior After Fix

Once we identify and fix the issue:

1. User submits document → Processing completes
2. Email notification automatically triggers
3. Signed URLs are generated (72-hour expiry)
4. Email is sent to areyes@gowaffl.com
5. Email contains:
   - User details in formatted table
   - Download button for uploaded document
   - Download button for internal report
6. Processing completes successfully (email failure won't break it)

---

## 📞 Debug Support

When sharing logs, please include:

- ✅ The full "📧 STARTING EMAIL NOTIFICATION PROCESS" section
- ✅ Any error messages (❌ EMAIL FAILED)
- ✅ The submission ID
- ✅ Whether files exist in storage (check dashboard)

This will help me quickly identify and fix the issue!

