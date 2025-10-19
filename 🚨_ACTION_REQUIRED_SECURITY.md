# 🚨 CRITICAL: IMMEDIATE ACTION REQUIRED - SECURITY INCIDENT

**Date:** October 19, 2025  
**Priority:** 🔴 CRITICAL  
**Status:** ⚠️ AWAITING YOUR ACTION  

---

## ⚡ EXECUTIVE SUMMARY

**Multiple API keys and tokens were exposed in your git repository and are currently visible on GitHub.**

You must take immediate action to:
1. ✅ Rotate all exposed API keys (30 minutes)
2. ✅ Clean git history to remove secrets (30 minutes)
3. ✅ Verify security of your systems (15 minutes)

**Total Time Required:** ~1-2 hours  
**Risk Level if Not Fixed:** HIGH - Unauthorized access to your systems

---

## 🔥 WHAT WAS EXPOSED

### Critical Secrets (MUST Rotate Immediately)

1. **Resend API Key**
   - Value: `re_dfAq3DA5_562WRM5RR7U4H36dd1HcSpQU`
   - Risk: Anyone can send emails from your account
   - Cost Impact: Could incur email sending costs
   - **Action:** DELETE this key in Resend dashboard NOW

2. **Supabase Access Token**
   - Value: `sbp_b70af96ee4bffd2455a32ec9f0b1f695f129d04f`
   - Risk: Full admin access to your Supabase project
   - Impact: Can read/modify/delete all data
   - **Action:** REVOKE this token in Supabase NOW

### Medium Risk

3. **Supabase Project Info**
   - Project Ref: `qpiijzpslfjwikigrbol`
   - Anon Key: (in src/lib/supabase.ts)
   - Risk: Database access IF RLS policies are weak
   - **Action:** Verify RLS policies are secure

---

## ✅ WHAT I'VE ALREADY FIXED

I've already completed the following preventive measures:

### 1. ✅ Updated `.gitignore`
- Added rules to block secret files
- Added patterns to ignore sensitive docs
- Prevents future accidental commits

### 2. ✅ Removed Hardcoded Secrets
- Updated `src/lib/supabase.ts` to require environment variables
- No more fallback to hardcoded values
- Added error if secrets are missing

### 3. ✅ Created Template Files
- `EMAIL_DEPLOYMENT_COMPLETE.template.md` - Safe deployment guide
- `deploy-email-notification.sh.template` - Safe deployment script
- `env.example` - Environment variable template

### 4. ✅ Created Security Documentation
- `SECURITY_SETUP_GUIDE.md` - Complete security guide
- `SECRETS_CLEANUP_SUMMARY.md` - Incident summary and remediation
- `REDACT_SECRETS_GUIDE.md` - Guide for handling documentation

### 5. ✅ Gitignored Sensitive Files
- Sensitive documentation files are now blocked from git
- Won't be accidentally committed again

---

## 🎯 WHAT YOU MUST DO NOW

### STEP 1: Rotate Resend API Key (5 minutes) 🔴

```
1. Open: https://resend.com/api-keys
2. Find key: re_dfAq3DA5_562WRM5RR7U4H36dd1HcSpQU
3. Click "Delete" or "Revoke"
4. Click "Create API Key"
5. Copy the new key
6. Save it in your password manager
```

**Then update your Supabase Edge Function:**
```bash
export SUPABASE_ACCESS_TOKEN="your_OLD_token_for_now"
npx supabase secrets set RESEND_API_KEY="your_NEW_resend_key" --project-ref qpiijzpslfjwikigrbol
```

### STEP 2: Rotate Supabase Access Token (5 minutes) 🔴

```
1. Open: https://supabase.com/dashboard/account/tokens
2. Find token: sbp_b70af96ee4bffd2455a32ec9f0b1f695f129d04f
3. Click "Revoke"
4. Click "Generate new token"
5. Name it: "CLI Access Token"
6. Copy the new token
7. Save it in your password manager
```

**Then update your environment:**
```bash
# Update your .env file
echo "SUPABASE_ACCESS_TOKEN=your_NEW_token" >> .env

# Or export for current session
export SUPABASE_ACCESS_TOKEN="your_NEW_token"
```

### STEP 3: Verify RLS Policies (10 minutes) 🟡

```
1. Open: https://supabase.com/dashboard/project/qpiijzpslfjwikigrbol/auth/policies
2. Check each table has RLS enabled (toggle should be ON)
3. Verify policies are restrictive:
   - document_submissions: Only authenticated users can read their own
   - processing_jobs: Only authenticated users can read their own
   - savings_reports: Only authenticated users can read their own
4. Test with anon key to ensure protection
```

**If RLS is properly configured, your data is safe even with exposed anon key.**

### STEP 4: Create `.env` File (5 minutes) 🟢

```bash
# In your project root
cp env.example .env

# Edit .env and add your NEW secrets:
# - VITE_SUPABASE_URL
# - VITE_SUPABASE_ANON_KEY
# - RESEND_API_KEY (new one)
# - SUPABASE_ACCESS_TOKEN (new one)

# Verify .env is gitignored
git status
# Should NOT show .env as untracked
```

### STEP 5: Clean Git History (30-45 minutes) 🔴

**Choose ONE of these methods:**

#### Method A: BFG Repo-Cleaner (Easiest)

```bash
# Install BFG
brew install bfg

# Backup your repo first!
cd ~/Desktop
cp -r Development/brave-submit-engine brave-submit-engine-backup

# Clone a mirror
cd ~/Desktop
git clone --mirror https://github.com/YOUR_USERNAME/brave-submit-engine.git

# Enter the mirror
cd brave-submit-engine.git

# Remove sensitive files from ALL commits
bfg --delete-files EMAIL_DEPLOYMENT_COMPLETE.md
bfg --delete-files EMAIL_DEBUG_GUIDE.md
bfg --delete-files EMAIL_NOTIFICATION_IMPLEMENTATION.md
bfg --delete-files deploy-email-notification.sh

# Clean up the repository
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Push the cleaned history (⚠️ DESTRUCTIVE - coordinate with team!)
git push --force

# Go back to your working directory
cd ~/Desktop/Development/brave-submit-engine
git fetch origin
git reset --hard origin/main
```

#### Method B: Start Fresh (Most Secure, if repo is private/solo)

```bash
# Create a new GitHub repo
# Then:

cd ~/Desktop/Development/brave-submit-engine

# Remove git history
rm -rf .git

# Initialize new repo
git init
git add .
git commit -m "Initial commit (cleaned)"

# Push to new repo
git remote add origin https://github.com/YOUR_USERNAME/new-repo.git
git push -u origin main

# Archive old repo on GitHub
```

### STEP 6: Test Everything (10 minutes) 🟢

```bash
# Test app starts
npm run dev
# Should load without errors

# Test Supabase CLI with new token
npx supabase projects list
# Should show your projects

# Test a document submission
# Upload a test file through the UI
# Verify email notification works with new Resend key
```

---

## 🔍 VERIFICATION CHECKLIST

After completing all steps, verify:

### Security Checklist
- [ ] Old Resend API key deleted in Resend dashboard
- [ ] Old Supabase access token revoked in Supabase dashboard
- [ ] New Resend key set in Edge Function secrets
- [ ] New access token saved in `.env` file
- [ ] `.env` file is gitignored (not showing in `git status`)
- [ ] RLS policies reviewed and secure
- [ ] Git history cleaned (secrets removed from all commits)
- [ ] Forced pushed cleaned history to GitHub

### Functional Checklist
- [ ] Application starts successfully
- [ ] Can submit test document
- [ ] Email notifications work
- [ ] Supabase CLI commands work
- [ ] No errors in browser console

### Verification Commands

```bash
# Verify .env is gitignored
git status
# Should NOT show .env

# Verify secrets are gone from history
git log --all -p | grep -i "re_dfAq3DA5"
# Should return nothing

# Verify Supabase CLI works
npx supabase projects list
# Should show projects

# Verify secrets are set
npx supabase secrets list --project-ref qpiijzpslfjwikigrbol
# Should show RESEND_API_KEY
```

---

## ⏰ TIMELINE

| Action | Time Required | Priority |
|--------|--------------|----------|
| Rotate Resend API Key | 5 min | 🔴 CRITICAL |
| Rotate Supabase Token | 5 min | 🔴 CRITICAL |
| Verify RLS Policies | 10 min | 🟡 HIGH |
| Create .env File | 5 min | 🟢 MEDIUM |
| Clean Git History | 30-45 min | 🔴 CRITICAL |
| Test Everything | 10 min | 🟢 MEDIUM |
| **TOTAL** | **65-80 min** | |

---

## 🆘 NEED HELP?

### Quick Links
- 🔒 [SECURITY_SETUP_GUIDE.md](./SECURITY_SETUP_GUIDE.md) - Detailed security guide
- 📋 [SECRETS_CLEANUP_SUMMARY.md](./SECRETS_CLEANUP_SUMMARY.md) - Complete incident summary
- 📝 [REDACT_SECRETS_GUIDE.md](./REDACT_SECRETS_GUIDE.md) - Documentation redaction guide

### Support Resources
- Supabase Dashboard: https://supabase.com/dashboard
- Resend Dashboard: https://resend.com/dashboard
- GitHub Docs (Remove Sensitive Data): https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository

### Common Issues

**"BFG not working?"**
- Try method B (start fresh) or use git-filter-repo instead

**"Can't revoke token?"**
- If token is already invalid, just create a new one and move on

**"RLS policies missing?"**
- Follow Supabase RLS guide: https://supabase.com/docs/guides/auth/row-level-security

**"App not starting after changes?"**
- Ensure `.env` file has all required variables
- Check `.env` is in the project root
- Restart your dev server

---

## ✅ COMPLETION SIGN-OFF

Once you've completed ALL required actions, mark these as done:

- [ ] Resend API key rotated and tested
- [ ] Supabase access token rotated and tested
- [ ] RLS policies verified as secure
- [ ] `.env` file created and gitignored
- [ ] Git history cleaned and pushed
- [ ] Application tested end-to-end
- [ ] Team notified (if applicable)

**Sign off with date:** _______________

---

## 📊 MONITORING (After Cleanup)

### Daily (First Week)
- Check Resend dashboard for suspicious email activity
- Check Supabase auth logs for unauthorized access
- Monitor your costs for unexpected charges

### Weekly
- Review access logs
- Check for any anomalies
- Verify RLS policies still secure

### If You Detect Unauthorized Access
1. Immediately rotate all secrets again
2. Review and lock down RLS policies
3. Check for data breaches
4. Consider incident response plan

---

## 🎯 NEXT STEPS AFTER CLEANUP

Once you've completed the critical actions:

1. **Review All Documentation**
   - Use `REDACT_SECRETS_GUIDE.md` to audit all markdown files
   - Create template versions of remaining guides
   - Consider which docs should be public vs private

2. **Set Up Secret Detection**
   - Install gitleaks pre-commit hook
   - Add secret scanning to CI/CD
   - Train team on secret management

3. **Establish Processes**
   - Code review checklist includes secret check
   - Regular key rotation schedule
   - Incident response plan

4. **Update README**
   - Remove any project-specific details
   - Link to template files
   - Add security section

---

## 🔐 REMEMBER

- **Secrets in git history remain until actively removed**
- **Rotating keys is not enough - must clean history too**
- **Prevention is easier than cleanup**
- **When in doubt, don't commit**

---

## 🚀 START NOW

1. Open Resend dashboard → Delete old API key
2. Open Supabase dashboard → Revoke old token
3. Follow steps 3-6 above
4. Mark this document as completed

**The sooner you act, the less risk you face.**

**Status:** 🔴 PENDING - Awaiting your action

Good luck! You've got this. 💪🔒

