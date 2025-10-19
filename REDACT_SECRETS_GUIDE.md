# 🔒 Secret Redaction Guide

**Purpose:** Guide to redact sensitive information from documentation files before committing to git.

---

## 🎯 What Needs to be Redacted

### High Priority (Must Redact)
1. **API Keys and Tokens**
   - Resend API Keys: `re_*`
   - Supabase Access Tokens: `sbp_*`
   - OpenAI API Keys: `sk-*`
   - Any other API keys

2. **Service Role Keys**
   - Supabase Service Role Keys (start with `eyJ...`)
   - Any JWT tokens

### Medium Priority (Consider Redacting)
3. **Project Identifiers**
   - Supabase Project Ref: `qpiijzpslfjwikigrbol`
   - While not secret, helps obscure your infrastructure

4. **Deployment URLs**
   - `https://qpiijzpslfjwikigrbol.supabase.co` → `https://[YOUR_PROJECT_REF].supabase.co`

### Low Priority (Context Dependent)
5. **Email Addresses**
   - Internal emails may be okay to keep
   - Customer emails should be redacted

---

## 📝 Files That Need Redaction

### Already Handled (Gitignored)
These files are now in `.gitignore` and won't be committed:
- ✅ `EMAIL_DEBUG_GUIDE.md`
- ✅ `EMAIL_DEPLOYMENT_COMPLETE.md`
- ✅ `EMAIL_NOTIFICATION_IMPLEMENTATION.md`
- ✅ `deploy-email-notification.sh`

### Needs Manual Review
These files contain the project reference and may need updates:

1. **DEPLOYMENT_GUIDE.md**
   - Contains project ref in CLI commands
   - Consider creating `.template` version

2. **FINAL_DEPLOYMENT_CHECKLIST.md**
   - May contain project-specific info

3. **IMPLEMENTATION_STATUS.md**
   - Review for any secrets

4. **PARSING_IMPROVEMENTS.md**
   - Review for project refs

5. **PDF_LAYOUT_FIXES.md**
   - Review for project refs

6. **PROGRESS_TRACKING_IMPROVEMENTS.md**
   - Review for project refs

7. **QUICK_DEPLOY.md**
   - May contain deployment commands with project ref

8. **README_DEPLOY_NOW.md**
   - Likely has deployment URLs

9. **SETUP_COMPLETE.md**
   - May have initial setup info with secrets

10. **SUPABASE_SETUP.md**
    - Definitely has Supabase project info

11. **TIMEOUT_FIX.md**
    - Review for project refs

---

## 🔧 How to Redact

### Option 1: Manual Find & Replace (Recommended)

Use your editor to find and replace:

```bash
# Find all instances
grep -r "qpiijzpslfjwikigrbol" *.md

# For each file, replace with:
qpiijzpslfjwikigrbol → [YOUR_PROJECT_REF]
https://qpiijzpslfjwikigrbol.supabase.co → https://[YOUR_PROJECT_REF].supabase.co
```

### Option 2: Automated Script

Create a script to redact automatically:

```bash
#!/bin/bash
# redact-secrets.sh

# List of files to redact (skip gitignored ones)
FILES=(
  "DEPLOYMENT_GUIDE.md"
  "FINAL_DEPLOYMENT_CHECKLIST.md"
  "IMPLEMENTATION_STATUS.md"
  "PARSING_IMPROVEMENTS.md"
  "PDF_LAYOUT_FIXES.md"
  "PROGRESS_TRACKING_IMPROVEMENTS.md"
  "QUICK_DEPLOY.md"
  "README_DEPLOY_NOW.md"
  "SETUP_COMPLETE.md"
  "SUPABASE_SETUP.md"
  "TIMEOUT_FIX.md"
)

# Redact project ref
for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "Redacting $file..."
    sed -i.bak 's/qpiijzpslfjwikigrbol/[YOUR_PROJECT_REF]/g' "$file"
    rm "$file.bak"
  fi
done

echo "✅ Redaction complete"
```

### Option 3: Keep Files Private

Alternative approach:
1. Add all sensitive documentation to `.gitignore`
2. Keep a private documentation repo
3. Only commit redacted/template versions to public repo

---

## 🚦 Decision Matrix: What to Redact?

| Item | Public Repo | Private Repo | Template Files |
|------|-------------|--------------|----------------|
| API Keys | ❌ NEVER | ✅ YES (encrypted) | 🔄 Placeholder |
| Access Tokens | ❌ NEVER | ✅ YES (encrypted) | 🔄 Placeholder |
| Project Refs | 🟡 Optional | ✅ YES | 🔄 Placeholder |
| Anon Keys | ✅ YES* | ✅ YES | ✅ YES |
| Email Addresses | 🟡 Optional | ✅ YES | 🔄 Placeholder |
| Function URLs | 🟡 Optional | ✅ YES | 🔄 Placeholder |

*Supabase anon keys are designed to be public IF RLS policies are properly configured

---

## ✅ Recommended Approach

### For This Repository

1. **Keep Documentation Private**
   - Add more doc files to `.gitignore` if they contain project-specific info
   - Create separate private wiki/docs repo for internal use

2. **Create Public Templates**
   - Create `.template` versions of guides
   - Use placeholders like `[YOUR_PROJECT_REF]`
   - Safe to share and commit

3. **Minimal Public Docs**
   - Keep public README generic
   - Link to setup guides with placeholders
   - Don't expose infrastructure details

### Recommended `.gitignore` Additions

Add these patterns to `.gitignore`:

```gitignore
# Documentation with project-specific info
DEPLOYMENT_GUIDE.md
FINAL_DEPLOYMENT_CHECKLIST.md
QUICK_DEPLOY.md
README_DEPLOY_NOW.md
SETUP_COMPLETE.md
SUPABASE_SETUP.md

# Keep template versions instead
!*.template.md
```

---

## 📋 Redaction Checklist

Before committing any documentation:

- [ ] Search file for API keys (re_, sk_, sbp_)
- [ ] Search for access tokens
- [ ] Search for project ref (qpiijzpslfjwikigrbol)
- [ ] Search for full URLs with project ref
- [ ] Check for hardcoded passwords
- [ ] Check for internal email addresses
- [ ] Verify RLS if anon key is exposed
- [ ] Consider if file should be public at all
- [ ] Create `.template` version if needed
- [ ] Add to `.gitignore` if too sensitive

---

## 🔍 Quick Search Commands

```bash
# Find all API keys
grep -r "re_[a-zA-Z0-9_]\+" *.md

# Find all access tokens
grep -r "sbp_[a-zA-Z0-9_]\+" *.md

# Find all project refs
grep -r "qpiijzpslfjwikigrbol" *.md

# Find all OpenAI keys
grep -r "sk-proj-" *.md
grep -r "sk-[a-zA-Z0-9]\+" *.md

# Find JWT tokens
grep -r "eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*" *.md
```

---

## 🎯 Action Items

### Immediate (Before Next Commit)
1. Review all markdown files for secrets
2. Redact or gitignore files with project refs
3. Create template versions of guides
4. Update `.gitignore` with additional patterns

### Short Term
1. Create private documentation repo
2. Move sensitive docs to private repo
3. Keep only generic/template docs in public repo

### Long Term
1. Establish documentation review process
2. Train team on what can/cannot be public
3. Set up pre-commit hooks for secret detection
4. Regular audits of committed documentation

---

## 📚 Tools for Secret Detection

### 1. Gitleaks
```bash
brew install gitleaks
gitleaks detect --source . --verbose
```

### 2. TruffleHog
```bash
pip install truffleHog
trufflehog filesystem .
```

### 3. Git-secrets
```bash
brew install git-secrets
git secrets --install
git secrets --register-aws  # Add custom patterns
```

---

## 🆘 If You Accidentally Commit Secrets

1. **DO NOT** just delete the file and commit again (still in history!)
2. **DO** follow the git history cleanup guide in `SECURITY_SETUP_GUIDE.md`
3. **DO** rotate the exposed secrets immediately
4. **DO** review access logs for unauthorized usage

---

## 📞 Questions?

- **Is this secret?** → When in doubt, treat it as secret
- **Should I redact?** → If it's project-specific, yes
- **Can I commit this?** → Check it against the decision matrix
- **Is anon key okay to expose?** → Only if RLS is properly configured

**Remember:** It's easier to add information later than to remove it from git history!

---

## ✅ Summary

1. **API Keys/Tokens:** NEVER commit
2. **Project Refs:** Consider redacting for public repos
3. **Documentation:** Create private + public template versions
4. **When Unsure:** Don't commit, ask first
5. **Already Committed:** Follow cleanup guide immediately

**Stay secure! 🔒**

