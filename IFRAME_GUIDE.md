# iFrame Embedding Guide

## 🎯 Overview

This BAV Savings Challenge form is designed to work seamlessly as an embedded iframe on any website. The backend is fully configured with CORS support to handle cross-origin requests.

## 📋 Quick Embed Code

```html
<iframe 
  src="https://your-domain.com" 
  width="100%" 
  height="900" 
  frameborder="0"
  title="BAV Savings Challenge Submission Form"
  allow="clipboard-write"
  sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
></iframe>
```

## 🔧 Configuration Steps

### 1. Deploy Your Frontend

First, deploy your frontend to a hosting service:
- **Vercel**: Connect your repo and deploy
- **Netlify**: Connect your repo and deploy
- **Cloudflare Pages**: Connect your repo and deploy

### 2. Update reCAPTCHA Domains

Add all domains where the iframe will be embedded:

1. Go to: https://www.google.com/recaptcha/admin
2. Select your reCAPTCHA site
3. Under **Domains**, add:
   - `yourdomain.com` (your iframe host)
   - `parentsite1.com` (parent website 1)
   - `parentsite2.com` (parent website 2)
   - etc.

### 3. Set Supabase Edge Function Secrets

Make sure these are set in your Supabase project:

## 🌐 Responsive Embedding

### Basic Responsive

```html
<div style="position: relative; width: 100%; max-width: 800px; margin: 0 auto;">
  <iframe 
    src="https://your-domain.com" 
    style="width: 100%; height: 900px; border: none;"
    title="BAV Savings Challenge"
  ></iframe>
</div>
```

### Auto-Resize Height (Advanced)

For automatically adjusting iframe height based on content:

**Parent Page Code:**
```html
<iframe 
  id="bav-form"
  src="https://your-domain.com" 
  width="100%" 
  height="600"
  frameborder="0"
></iframe>

<script>
  window.addEventListener('message', function(e) {
    if (e.origin === 'https://your-domain.com') {
      if (e.data.type === 'resize') {
        document.getElementById('bav-form').style.height = e.data.height + 'px';
      }
    }
  });
</script>
```

**Your App (add to main.tsx or App.tsx):**
```typescript
// Send height updates to parent
useEffect(() => {
  const sendHeight = () => {
    const height = document.body.scrollHeight;
    window.parent.postMessage(
      { type: 'resize', height },
      '*' // In production, specify parent domain
    );
  };

  sendHeight();
  window.addEventListener('resize', sendHeight);
  
  // Send height on content changes
  const observer = new MutationObserver(sendHeight);
  observer.observe(document.body, { 
    childList: true, 
    subtree: true 
  });

  return () => {
    window.removeEventListener('resize', sendHeight);
    observer.disconnect();
  };
}, []);
```

## 🔒 Security Considerations

### Content Security Policy (CSP)

If the parent site has CSP, they need to allow:

```html
<meta http-equiv="Content-Security-Policy" 
      content="frame-src https://your-domain.com; 
               script-src 'self' https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/;
               frame-src https://www.google.com/recaptcha/">
```

### CORS Headers

Already configured in the Supabase Edge Function:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

**For Production:** Update to specific domains:
```typescript
const allowedOrigins = [
  'https://parentsite1.com',
  'https://parentsite2.com',
];

const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

## 📱 Mobile Optimization

The form is already responsive, but for mobile embedding:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<iframe 
  src="https://your-domain.com" 
  style="
    width: 100%; 
    height: 100vh; 
    border: none;
    min-height: 600px;
  "
  scrolling="auto"
></iframe>
```

## 🎨 Custom Styling

### With Transparent Background

Add to your App.css or index.css:
```css
body {
  background: transparent;
}
```

Then parent can set background:
```html
<div style="background: #f5f5f5; padding: 20px;">
  <iframe src="..." style="background: transparent;"></iframe>
</div>
```

### Custom Theme Colors

Update your Tailwind config to match parent site:
```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        primary: '#your-brand-color',
      }
    }
  }
}
```

## ✅ Testing Checklist

Before deploying in production:

- [ ] Test form submission works in iframe
- [ ] reCAPTCHA loads and verifies correctly
- [ ] Mobile responsive on all devices
- [ ] All parent domains added to reCAPTCHA
- [ ] Supabase Edge Function secrets are set
- [ ] CORS allows parent domain
- [ ] CSP policies allow necessary resources
- [ ] File uploads work (if implemented)
- [ ] Form validation works correctly
- [ ] Success/error messages display properly

## 🚀 Example Parent Page

Complete example of embedding:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BAV Savings Challenge</title>
  <style>
    .iframe-container {
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    
    #bav-form {
      width: 100%;
      border: none;
      min-height: 800px;
    }
  </style>
</head>
<body>
  <div class="iframe-container">
    <h2>Submit Your Purchase Order</h2>
    <p>Complete the form below to participate in the BAV Savings Challenge</p>
    
    <iframe 
      id="bav-form"
      src="https://your-deployed-app.vercel.app"
      title="BAV Savings Challenge Form"
    ></iframe>
  </div>

  <script>
    // Auto-resize iframe
    window.addEventListener('message', function(e) {
      if (e.data.type === 'resize') {
        document.getElementById('bav-form').style.height = e.data.height + 'px';
      }
    });
  </script>
</body>
</html>
```

## 📊 Monitoring

View submissions in Supabase:
1. Go to Supabase Dashboard
2. Navigate to **Table Editor**
3. Select `document_submissions`
4. Filter by date, email, or company

## 🔔 Notifications (Optional Enhancement)

To receive email notifications on new submissions, add to your Edge Function:

```typescript
// After successful insertion
await fetch('https://api.sendgrid.com/v3/mail/send', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${SENDGRID_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    personalizations: [{
      to: [{ email: 'admin@yourcompany.com' }],
      subject: 'New BAV Challenge Submission',
    }],
    from: { email: 'noreply@yourcompany.com' },
    content: [{
      type: 'text/html',
      value: `New submission from ${data.firstName} ${data.lastName} at ${data.company}`,
    }],
  }),
});
```

## 🛠️ Troubleshooting

### reCAPTCHA Not Loading
- Check parent domain is added to reCAPTCHA settings
- Verify CSP allows Google reCAPTCHA domains
- Check browser console for errors

### Form Not Submitting
- Verify Supabase Edge Function secrets are set
- Check network tab for CORS errors
- Ensure reCAPTCHA secret key matches

### Iframe Not Displaying
- Check X-Frame-Options on your host
- Verify iframe src URL is correct
- Check parent site CSP allows iframe

## 📞 Support

For issues or questions:
1. Check browser console for errors
2. Review Supabase Edge Function logs
3. Verify all configuration steps completed

