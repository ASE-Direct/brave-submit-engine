# 🔒 Security Setup Guide

**CRITICAL:** This guide explains how to properly configure secrets and secure your application.

---

## ⚠️ IMMEDIATE ACTION REQUIRED

**Your secrets were previously exposed in git history. Follow these steps immediately:**

### 1. Rotate All API Keys (DO THIS FIRST!)

#### A. Rotate Resend API Key
1. Go to https://resend.com/api-keys
2. **Delete** the old key: `re_dfAq3DA5_562WRM5RR7U4H36dd1HcSpQU`
3. Create a new API key
4. Copy the new key and store it securely (see step 3 below)

#### B. Rotate Supabase Access Token
1. Go to https://supabase.com/dashboard/account/tokens
2. **Revoke** the old token: `sbp_b70af96ee4bffd2455a32ec9f0b1f695f129d04f`
3. Create a new access token
4. Copy the new token and store it securely

#### C. Consider Rotating Supabase Project Keys
Your Supabase anon key and project URL were also exposed:
- **Project Ref:** `qpiijzpslfjwikigrbol`
- **Anon Key:** Was exposed in `src/lib/supabase.ts`

While the anon key is considered "public" in Supabase's security model (it's safe to expose in frontend code with proper RLS policies), consider:
1. Verifying your Row Level Security (RLS) policies are properly configured
2. If you have any concerns, you can create a new Supabase project and migrate

---

## 🔐 Proper Secret Management

### Step 1: Create Local `.env` File

Create a `.env` file in your project root (this file is gitignored and will NOT be committed):

```bash
# Copy the example file
cp env.example .env
```

### Step 2: Add Your Real Secrets to `.env`

Edit `.env` and add your actual values:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your_actual_supabase_anon_key_here

# Resend API Configuration (Edge Function Secret)
RESEND_API_KEY=your_new_resend_api_key_here

# Supabase Access Token (for CLI operations)
SUPABASE_ACCESS_TOKEN=your_new_supabase_access_token_here

# Notification Settings
NOTIFICATION_EMAIL=areyes@gowaffl.com
```

### Step 3: Configure Supabase Edge Function Secrets

Supabase Edge Functions need secrets configured separately:

```bash
# Set the Resend API key as an Edge Function secret
export SUPABASE_ACCESS_TOKEN="your_new_access_token"
npx supabase secrets set RESEND_API_KEY="your_new_resend_api_key" --project-ref YOUR_PROJECT_REF
```

Verify it was set:
```bash
npx supabase secrets list --project-ref YOUR_PROJECT_REF
```

### Step 4: Configure Production Deployment

#### For Vercel:
1. Go to your project settings: https://vercel.com/YOUR_PROJECT/settings/environment-variables
2. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Redeploy your application

#### For other platforms:
Consult your hosting provider's documentation for setting environment variables.

---

## 🧹 Clean Up Git History

**WARNING:** These operations rewrite git history and should be coordinated with your team.

### Option 1: Remove Sensitive Files from Git History (Recommended)

Use BFG Repo-Cleaner to remove sensitive files from git history:

```bash
# Install BFG (macOS with Homebrew)
brew install bfg

# Clone a fresh mirror of your repo
git clone --mirror https://github.com/YOUR_USERNAME/YOUR_REPO.git

# Remove sensitive files from ALL history
cd YOUR_REPO.git
bfg --delete-files EMAIL_DEPLOYMENT_COMPLETE.md
bfg --delete-files EMAIL_DEBUG_GUIDE.md
bfg --delete-files EMAIL_NOTIFICATION_IMPLEMENTATION.md
bfg --delete-files deploy-email-notification.sh

# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push (⚠️ DESTRUCTIVE - coordinate with team)
git push --force
```

### Option 2: Use git-filter-repo (Alternative)

```bash
# Install git-filter-repo
brew install git-filter-repo

# Remove sensitive files
git filter-repo --invert-paths --path EMAIL_DEPLOYMENT_COMPLETE.md \
  --path EMAIL_DEBUG_GUIDE.md \
  --path EMAIL_NOTIFICATION_IMPLEMENTATION.md \
  --path deploy-email-notification.sh

# Force push (⚠️ DESTRUCTIVE)
git push --force --all
```

### Option 3: Start Fresh (Most Secure)

If the repository is not widely shared:

1. Create a new GitHub repository
2. Copy your code (excluding sensitive files)
3. Initialize new git history
4. Push to new repository
5. Update all references to point to new repo
6. Archive or delete old repository

---

## ✅ Security Checklist

### Immediate Actions (Do Now)
- [ ] Rotate Resend API key
- [ ] Rotate Supabase access token
- [ ] Review RLS policies in Supabase
- [ ] Create `.env` file with real secrets (never commit this!)
- [ ] Configure Edge Function secrets in Supabase
- [ ] Remove sensitive documentation files from git history
- [ ] Force push cleaned history (coordinate with team)

### Ongoing Security Practices
- [ ] Never commit `.env` files
- [ ] Never commit files with real API keys or tokens
- [ ] Use environment variables for all secrets
- [ ] Use `.gitignore` to prevent accidental commits
- [ ] Review code before committing for any hardcoded secrets
- [ ] Use Supabase RLS policies to protect data
- [ ] Regularly rotate API keys
- [ ] Monitor for unauthorized access

### Verification Steps
- [ ] Verify `.env` is in `.gitignore`
- [ ] Verify sensitive files are in `.gitignore`
- [ ] Check `src/lib/supabase.ts` has no hardcoded keys
- [ ] Run `git status` and ensure no secrets are staged
- [ ] Test application with environment variables
- [ ] Verify Edge Functions work with new secrets

---

## 🚨 What Was Exposed?

The following secrets were committed to git history:

1. **Resend API Key:** `re_dfAq3DA5_562WRM5RR7U4H36dd1HcSpQU` ⚠️ REVOKE
2. **Supabase Access Token:** `sbp_b70af96ee4bffd2455a32ec9f0b1f695f129d04f` ⚠️ REVOKE
3. **Supabase Project Ref:** `qpiijzpslfjwikigrbol` ⚠️ REVIEW RLS
4. **Supabase Anon Key:** (in src/lib/supabase.ts) ⚠️ ACCEPTABLE IF RLS IS CONFIGURED
5. **Notification Email:** `areyes@gowaffl.com` ℹ️ Not sensitive

### Risk Assessment

**High Risk:**
- Resend API Key → Can send emails from your account, incurring costs
- Supabase Access Token → Full admin access to your project

**Medium Risk:**
- Project Ref + Anon Key → Can access database IF RLS policies are misconfigured

**Low Risk:**
- Email address → Public information, not a security concern

---

## 📚 Best Practices

### Do's ✅
- ✅ Use environment variables for ALL secrets
- ✅ Add `.env` to `.gitignore`
- ✅ Use `.env.example` (or `env.example`) with placeholders
- ✅ Store secrets in deployment platform's secret manager
- ✅ Configure Edge Function secrets via CLI or dashboard
- ✅ Use separate keys for development and production
- ✅ Rotate keys regularly
- ✅ Monitor for unauthorized usage

### Don'ts ❌
- ❌ Never commit `.env` files
- ❌ Never hardcode API keys in source code
- ❌ Never commit files with real secrets
- ❌ Never share secrets in documentation
- ❌ Never push secrets to GitHub/GitLab
- ❌ Never store secrets in comments
- ❌ Never email or Slack secrets (use secure sharing tools)

---

## 🔍 Detecting Secrets in Code

### Pre-commit Hook (Recommended)

Install a pre-commit hook to detect secrets:

```bash
# Install gitleaks (secret detection tool)
brew install gitleaks

# Create pre-commit hook
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
gitleaks protect --staged --verbose
EOF

# Make executable
chmod +x .git/hooks/pre-commit
```

### Manual Scanning

Scan your repository for secrets:

```bash
# Install truffleHog
pip install truffleHog

# Scan repo
trufflehog filesystem . --only-verified
```

---

## 📞 Support

If you discover any security issues:

1. **DO NOT** open a public GitHub issue
2. **DO** rotate the affected credentials immediately
3. **DO** document what was exposed and when
4. **DO** review access logs for unauthorized usage
5. Contact your security team or administrator

---

## 🎓 Additional Resources

- [Supabase Security Best Practices](https://supabase.com/docs/guides/platform/security)
- [12-Factor App: Config](https://12factor.net/config)
- [OWASP: Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [GitHub: Removing Sensitive Data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)

---

**Remember:** Security is an ongoing process. Regular audits and key rotation are essential.

