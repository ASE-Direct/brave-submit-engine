/**
 * Backend reCAPTCHA Verification Example
 * 
 * This is a sample Node.js/Express endpoint that shows how to verify
 * reCAPTCHA tokens on your backend.
 * 
 * ⚠️ IMPORTANT: Frontend validation alone is NOT secure!
 * Always verify reCAPTCHA tokens on your backend before processing submissions.
 */

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // or use native fetch in Node.js 18+

const app = express();

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:8080'
}));

// Your reCAPTCHA secret key (keep this secure!)
const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;

/**
 * Verify reCAPTCHA token with Google
 */
async function verifyRecaptcha(token) {
  const verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';
  
  const response = await fetch(verifyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `secret=${RECAPTCHA_SECRET_KEY}&response=${token}`,
  });

  const data = await response.json();
  return data;
}

/**
 * Form submission endpoint
 */
app.post('/api/submit', async (req, res) => {
  try {
    const { 
      firstName, 
      lastName, 
      company, 
      email, 
      phone, 
      captchaToken,
      fileName 
    } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !company || !email || !phone || !captchaToken) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Verify reCAPTCHA
    console.log('Verifying reCAPTCHA token...');
    const recaptchaResult = await verifyRecaptcha(captchaToken);

    if (!recaptchaResult.success) {
      console.error('reCAPTCHA verification failed:', recaptchaResult);
      return res.status(400).json({
        success: false,
        error: 'reCAPTCHA verification failed',
        details: recaptchaResult['error-codes']
      });
    }

    console.log('reCAPTCHA verified successfully');
    console.log('Score:', recaptchaResult.score); // Only available for v3
    console.log('Hostname:', recaptchaResult.hostname);

    // Process the form submission
    console.log('Processing submission:', {
      firstName,
      lastName,
      company,
      email,
      phone,
      fileName
    });

    // TODO: Add your business logic here:
    // - Save to database
    // - Send confirmation email
    // - Process the uploaded file
    // - etc.

    // Return success response
    res.json({
      success: true,
      message: 'Form submitted successfully',
      submissionId: Date.now() // Replace with actual ID from your database
    });

  } catch (error) {
    console.error('Error processing submission:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Make sure to set RECAPTCHA_SECRET_KEY in your environment variables`);
});

/**
 * Environment Variables Required:
 * 
 * RECAPTCHA_SECRET_KEY - Your reCAPTCHA secret key from Google
 * FRONTEND_URL - Your frontend URL (optional, defaults to localhost:8080)
 * PORT - Server port (optional, defaults to 3000)
 * 
 * Example .env file:
 * 
 * RECAPTCHA_SECRET_KEY=your_secret_key_here
 * FRONTEND_URL=http://localhost:8080
 * PORT=3000
 */

/**
 * To use this example:
 * 
 * 1. Install dependencies:
 *    npm install express cors node-fetch
 * 
 * 2. Create a .env file with your secret key
 * 
 * 3. Run the server:
 *    node backend-example.js
 * 
 * 4. Update your frontend to call this API:
 *    In DocumentSubmissionForm.tsx, update the onSubmit function:
 * 
 *    const response = await fetch('http://localhost:3000/api/submit', {
 *      method: 'POST',
 *      headers: { 'Content-Type': 'application/json' },
 *      body: JSON.stringify({ 
 *        ...data, 
 *        captchaToken, 
 *        fileName: file.name 
 *      })
 *    });
 * 
 *    const result = await response.json();
 *    
 *    if (!result.success) {
 *      throw new Error(result.error);
 *    }
 */

