# GitHub Setup & Synchronization Guide

## 🔗 Remote Repository

**Repository:** https://github.com/Siddhu2708/SmartCloud.git

---

## 📋 Initial Setup (One-Time)

### 1. Configure Git Credentials

```bash
git config --global user.name "Siddhu"
git config --global user.email "siddhu@smartcloud.com"
```

### 2. Add Remote Origin

```bash
cd SmartCloud
git remote add origin https://github.com/Siddhu2708/SmartCloud.git
```

### 3. Verify Remote

```bash
git remote -v
# Output:
# origin  https://github.com/Siddhu2708/SmartCloud.git (fetch)
# origin  https://github.com/Siddhu2708/SmartCloud.git (push)
```

### 4. Initial Commit & Push

```bash
# Add all files
git add -A

# Create initial commit
git commit -m "Initial commit: SmartCloud project

- Backend: FastAPI with AI services
- Frontend: Next.js with components
- Database: PostgreSQL migrations
- Features: AI assistant, chunking, encryption"

# Push to GitHub
git push -u origin main
```

---

## 🔄 Daily Workflow

### After Making Changes

```bash
# Stage changes
git add .

# Or stage specific files
git add backend/app/services/new_service.py

# Commit with descriptive message
git commit -m "Add new feature: description"

# Push to GitHub
git push
```

### Commit Message Format

```
[Type]: Brief description

Detailed explanation of changes:
- What changed
- Why it changed
- Files affected

Closes #123 (if related to issue)
```

**Types:**
- `feat:` New feature
- `fix:` Bug fix
- `refactor:` Code refactoring
- `docs:` Documentation
- `test:` Tests
- `chore:` Maintenance

### Examples

```bash
# Feature
git commit -m "feat: add file encryption service

- Implement AES-256 encryption
- Add EncryptionService class
- Support PBKDF2 key derivation
- Add encryption toggle to UI"

# Bug fix
git commit -m "fix: resolve IDOR vulnerability in file access

- Add ownership validation in FileAccessService
- Validate user_id from JWT on all operations
- Add RLS policy enforcement"

# Documentation
git commit -m "docs: add API documentation

- Document all 30+ endpoints
- Add usage examples
- Add error handling guide"
```

---

## 📦 File Structure for Commits

### Backend Changes

```bash
# After modifying backend files
git add backend/app/services/new_service.py
git add backend/app/api/new_endpoint.py
git add requirements.txt  # if dependencies changed

git commit -m "feat: add new AI service

- Implement new functionality
- Update dependencies
- Add service integration tests"

git push
```

### Frontend Changes

```bash
# After modifying frontend files
git add frontend/src/components/NewComponent.tsx
git add frontend/src/hooks/useNewHook.ts

git commit -m "feat: add new UI component

- Create NewComponent with props
- Add custom hook for state
- Style with Tailwind CSS"

git push
```

### Database Changes

```bash
# After creating migration
git add database/migrations/010_new_table.sql

git commit -m "db: add new table migration

- Create table with indexes
- Add RLS policies
- Update schema documentation"

git push
```

### Documentation Changes

```bash
# After updating docs
git add docs/API.md
git add README.md

git commit -m "docs: update API documentation

- Add new endpoints
- Update examples
- Fix typos"

git push
```

---

## 🌿 Branch Strategy

### Main Branch (`main`)
- Production-ready code
- Only merge from develop or hotfix
- Always stable and deployable

### Develop Branch (`develop`)
- Integration branch
- Merge feature branches here
- Tested before merging to main

### Feature Branch (`feature/*`)
- One feature per branch
- Create from develop
- Name: `feature/feature-name`
- Example: `feature/ai-assistant`

### Bug Fix Branch (`fix/*`)
- One bug per branch
- Create from develop
- Name: `fix/bug-name`
- Example: `fix/idor-vulnerability`

### Creating Feature Branches

```bash
# Switch to develop
git checkout develop
git pull

# Create feature branch
git checkout -b feature/new-feature

# Make changes, commit
git add .
git commit -m "feat: implement new feature"

# Push feature branch
git push -u origin feature/new-feature

# Create Pull Request on GitHub
# Merge after review
```

---

## 🔄 Syncing with GitHub

### Check Status

```bash
# Show current status
git status

# Show unpushed commits
git log origin/main..main

# Show unpulled commits
git log main..origin/main
```

### Pull Latest Changes

```bash
# From main branch
git pull origin main

# From develop branch
git pull origin develop
```

### Fetch Without Merging

```bash
# Fetch all branches
git fetch

# See fetched changes
git log origin/main
```

### Push Changes

```bash
# Push current branch
git push

# Push all local branches
git push --all

# Push with tags
git push --tags
```

---

## ⚠️ Handling Conflicts

### When Pull Fails

```bash
git pull origin main
# Conflict! CONFLICT (content): Merge conflict in file.txt

# View conflict markers
cat file.txt

# Resolve conflicts manually
# Then:
git add file.txt
git commit -m "Resolve merge conflict in file.txt"
git push
```

### Abort Merge if Needed

```bash
git merge --abort
```

---

## 📊 Viewing History

```bash
# Show commit log
git log --oneline

# Show with graph
git log --oneline --graph --all

# Show changes in commit
git show abc1234

# Show file history
git log -- file.txt

# Show diff since last push
git diff origin/main..main
```

---

## 🔐 GitHub Authentication

### Using SSH (Recommended)

```bash
# Generate SSH key (if not exists)
ssh-keygen -t ed25519 -C "siddhu@smartcloud.com"

# Add to SSH agent
ssh-add ~/.ssh/id_ed25519

# Copy public key to GitHub
# Settings → SSH and GPG keys → New SSH key
cat ~/.ssh/id_ed25519.pub

# Update remote URL
git remote set-url origin git@github.com:Siddhu2708/SmartCloud.git
```

### Using HTTPS with Personal Access Token

```bash
# Generate PAT on GitHub
# Settings → Developer settings → Personal access tokens → Generate

# When prompted for password, use token
git push
# Username: siddhu2708
# Password: ghp_xxxxxxxxxxxxxxxxxxxx
```

---

## 📋 Useful Commands

```bash
# See all commits by author
git log --author="Siddhu"

# Count lines of code
git log --format="%H" | wc -l

# See what changed in a file
git diff HEAD~5 file.txt

# Unstage changes
git reset HEAD file.txt

# Discard local changes
git checkout -- file.txt

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Undo last commit (discard changes)
git reset --hard HEAD~1

# Tag version
git tag -a v1.0.0 -m "Version 1.0.0"
git push origin v1.0.0
```

---

## 📈 Repository Statistics

```bash
# Count commits
git rev-list --all --count

# Count contributors
git shortlog -sn

# Files per contributor
git shortlog -sn --summary

# Lines changed per commit
git log --shortstat

# Repository size
du -sh .git
```

---

## 🔍 GitHub Best Practices

1. **Commit Often** — Small, logical commits
2. **Descriptive Messages** — Clear what changed and why
3. **Branch Protection** — Require reviews before merge to main
4. **CI/CD** — Run tests on every push
5. **Code Review** — Always review before merging
6. **Documentation** — Keep README and docs updated
7. **Issues** — Track bugs and features in issues
8. **Pull Requests** — Use PRs for all changes

---

## 🚨 Disaster Recovery

### If You Accidentally Delete Commits

```bash
# Find in reflog (last 90 days)
git reflog

# Reset to specific commit
git reset --hard abc1234
```

### If You Push Wrong Code

```bash
# Revert commit (creates new commit)
git revert abc1234
git push

# Or reset (careful! only if not pushed)
git reset --hard HEAD~1
```

---

## 📞 Troubleshooting

### Push Rejected: Non-fast-forward

```bash
# Pull latest changes
git pull --rebase
git push
```

### Large Files

```bash
# Don't commit large files
# Use .gitignore for node_modules, venv, etc
# Use git-lfs for binary files if needed

git lfs install
git lfs track "*.bin"
git add .gitattributes
```

### Accidental Large File Committed

```bash
# Remove from git history
git filter-branch --tree-filter 'rm -rf large_file' HEAD
# Warning: rewrites history
```

---

## ✅ Daily Checklist

- [ ] Check git status before making changes
- [ ] Make small, focused commits
- [ ] Write clear commit messages
- [ ] Push changes regularly
- [ ] Review changes before committing
- [ ] Keep .gitignore updated
- [ ] Never commit secrets/tokens
- [ ] Update README if needed

---

**Last Updated:** October 2, 2026  
**Repository:** https://github.com/Siddhu2708/SmartCloud.git
