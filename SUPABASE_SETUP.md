# Supabase Backend Setup

## ✅ Completed Setup

1. **Database Table Created**: `document_submissions` table with all necessary fields
2. **Storage Bucket Created**: `document-submissions` for file uploads (5MB limit)
3. **Edge Function Deployed**: `submit-document` for reCAPTCHA verification and form processing
4. **Row Level Security**: Enabled with policies for public inserts and authenticated reads

## 🔧 Required Configuration

### Set Edge Function Secrets

You need to set these secrets in your Supabase dashboard:

1. Go to: **Supabase Dashboard → Project Settings → Edge Functions → Manage secrets**

2. Add the following secrets:

## 📊 Database Schema

### `document_submissions` Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| first_name | TEXT | Submitter's first name |
| last_name | TEXT | Submitter's last name |
| company | TEXT | Company name |
| email | TEXT | Email address |
| phone | TEXT | Phone number |
| file_name | TEXT | Uploaded file name |
| file_size | INTEGER | File size in bytes |
| file_type | TEXT | MIME type |
| file_url | TEXT | Storage URL (optional) |
| recaptcha_verified | BOOLEAN | Whether reCAPTCHA passed |
| recaptcha_score | NUMERIC | reCAPTCHA score (if v3) |
| ip_address | INET | Submitter's IP |
| user_agent | TEXT | Browser user agent |
| created_at | TIMESTAMPTZ | Submission timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

### Storage Bucket

**Name**: `document-submissions`
- **Public**: No (requires authentication to view)
- **Max File Size**: 5MB
- **Allowed Types**: PDF, Excel (.xls, .xlsx), CSV

## 🔒 Security

- **Row Level Security (RLS)** is enabled
- Public users can **INSERT** submissions
- Only **authenticated users** can **READ** submissions (for admin access)
- Edge Function verifies reCAPTCHA before accepting submissions

## 🌐 Edge Function Endpoint

**URL**: `https://qpiijzpslfjwikigrbol.supabase.co/functions/v1/submit-document`

**Method**: POST

**Request Body**:
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "company": "Acme Inc",
  "email": "john@example.com",
  "phone": "1234567890",
  "fileName": "document.pdf",
  "fileSize": 1024000,
  "fileType": "application/pdf",
  "captchaToken": "recaptcha_token_here"
}
```

**Response** (Success):
```json
{
  "success": true,
  "message": "Document submitted successfully",
  "submissionId": "uuid-here"
}
```

**Response** (Error):
```json
{
  "error": "Error description",
  "details": "Additional details"
}
```

## 📋 Viewing Submissions

### Via Supabase Dashboard
1. Go to **Table Editor**
2. Select `document_submissions` table
3. View all submissions with filters and sorting

### Via SQL
```sql
SELECT 
  id,
  first_name,
  last_name,
  company,
  email,
  phone,
  file_name,
  created_at
FROM document_submissions
ORDER BY created_at DESC;
```

## 🔄 For iFrame Usage

The backend is configured to work in iframes with CORS enabled:
- CORS headers allow all origins (`*`)
- Handles preflight OPTIONS requests
- Works across different domains

### Important for Production:
Consider restricting CORS to specific domains in the Edge Function:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://yourparentsite.com',
  // or use environment variable
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

## 🚀 Next Steps

1. ✅ Set the Edge Function secrets (see above)
2. ✅ Test the form submission
3. ✅ Configure reCAPTCHA domains to include your iframe parent domain
4. ✅ Set up email notifications (optional)
5. ✅ Configure file upload to storage (optional enhancement)

