# reCAPTCHA Setup Guide

This application uses Google reCAPTCHA v2 to prevent spam and bot submissions.

## Getting Your Own reCAPTCHA Keys

### Step 1: Visit Google reCAPTCHA Admin Console
Go to: https://www.google.com/recaptcha/admin/create

### Step 2: Register Your Site
1. **Label**: Enter a name for your site (e.g., "BAV Savings Challenge")
2. **reCAPTCHA type**: Select **reCAPTCHA v2** → **"I'm not a robot" Checkbox**
3. **Domains**: Add your domains:
   - For development: `localhost`
   - For production: `yourdomain.com` (without http:// or https://)
4. Click **Submit**

### Step 3: Copy Your Keys
After registration, you'll receive two keys:
- **Site Key** (Public key - safe to expose in frontend)
- **Secret Key** (Private key - must be kept secret on backend)

### Step 4: Configure Your Application

#### Option A: Using Environment Variables (Recommended)
1. Create a `.env.local` file in the project root:
```env
VITE_RECAPTCHA_SITE_KEY=your_site_key_here
```

2. Restart your development server

#### Option B: Direct Configuration
Edit `src/config/recaptcha.ts` and replace the default key with your site key:
```typescript
export const RECAPTCHA_SITE_KEY = 'your_site_key_here';
```

## Backend Verification (Important!)

**⚠️ Critical**: The frontend reCAPTCHA widget can be bypassed. You **must** verify the token on your backend.

### Verification Steps:

1. When the form is submitted, send the `captchaToken` to your backend
2. On your backend, make a POST request to Google's verification API:

```javascript
// Node.js/Express example
app.post('/api/submit', async (req, res) => {
  const { captchaToken } = req.body;
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  
  try {
    const verifyResponse = await fetch(
      'https://www.google.com/recaptcha/api/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${secretKey}&response=${captchaToken}`
      }
    );
    
    const verifyData = await verifyResponse.json();
    
    if (!verifyData.success) {
      return res.status(400).json({ error: 'Invalid reCAPTCHA' });
    }
    
    // reCAPTCHA verified successfully, process the form
    // ... your form processing logic here
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});
```

### Python/Flask Example:
```python
import requests
from flask import request, jsonify

@app.route('/api/submit', methods=['POST'])
def submit_form():
    captcha_token = request.json.get('captchaToken')
    secret_key = os.environ.get('RECAPTCHA_SECRET_KEY')
    
    verify_response = requests.post(
        'https://www.google.com/recaptcha/api/siteverify',
        data={
            'secret': secret_key,
            'response': captcha_token
        }
    )
    
    result = verify_response.json()
    
    if not result.get('success'):
        return jsonify({'error': 'Invalid reCAPTCHA'}), 400
    
    # Process the form
    return jsonify({'success': True})
```

## Testing

### Test Keys (Already Configured for Development)
Google provides test keys that always pass or fail:

**Always Pass:**
- Site Key: `6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI`
- Secret Key: `6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe`

These are currently set in the code and will work for testing without backend verification.

### Production
Replace with your own keys before deploying to production!

## Features Implemented

✅ Frontend reCAPTCHA widget integration
✅ Error handling for expired/failed verification
✅ Automatic reset on submission error
✅ User-friendly toast notifications
✅ TypeScript support
✅ Configurable site key via environment variables

## Troubleshooting

### reCAPTCHA not loading
- Check your internet connection
- Verify the site key is correct
- Ensure your domain is registered in Google reCAPTCHA admin
- Check browser console for errors

### "Invalid domain for site key" error
- Make sure you've added your domain (or `localhost`) in the reCAPTCHA admin console
- For local development, add `localhost` without port number

### Token expired
- reCAPTCHA tokens expire after 2 minutes
- The app automatically handles this and asks users to verify again

## Additional Resources

- [Google reCAPTCHA Documentation](https://developers.google.com/recaptcha/docs/display)
- [reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin)
- [react-google-recaptcha Documentation](https://github.com/dozoisch/react-google-recaptcha)

