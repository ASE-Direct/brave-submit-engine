// reCAPTCHA Configuration
// To get your own keys, visit: https://www.google.com/recaptcha/admin/create
// 1. Choose reCAPTCHA v2 ("I'm not a robot" Checkbox)
// 2. Add your domain (use localhost for development)
// 3. Copy the site key here

export const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';

// Note: The secret key should NEVER be exposed in frontend code
// It should only be used in your backend API for verification
export const getRecaptchaSiteKey = () => RECAPTCHA_SITE_KEY;

