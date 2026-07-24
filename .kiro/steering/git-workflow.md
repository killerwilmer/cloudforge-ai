---
inclusion: always
---

# Git Workflow

Follow these git conventions and workflows when making changes to this project.

## Branch Strategy

**Always create feature branches; never commit directly to `main`.**

- Branch naming convention: `feature/<short-description>`, `fix/<bug-name>`, `refactor/<component>`
- Examples: `feature/user-authentication`, `fix/login-validation`, `refactor/api-routes`
- Keep branches focused on a single feature or fix
- Delete branches after merging

## Commit Practices

**Write clear, descriptive commit messages.**

- Format: `<type>: <concise description>`
- Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `style`
- Examples:
  - `feat: add user authentication endpoint`
  - `fix: resolve null pointer in payment processing`
  - `refactor: simplify database connection logic`
- Commit message should explain WHAT and WHY, not HOW
- Keep commits atomic and focused on a single logical change

## Staging and Committing

**Stage specific files; avoid `git add .` or `git add -A`.**

- Stage files explicitly by path: `git add src/auth.ts src/middleware/validate.ts`
- Review changes before staging: `git diff`
- Review staged changes before committing: `git diff --staged`
- This prevents accidental commits of unrelated changes or sensitive files

## Pre-commit Checks

**Never skip pre-commit hooks unless explicitly requested.**

- Let hooks run to catch issues early
- If a hook fails, fix the issue and create a new commit
- Never use `--no-verify` or `--amend` after hook failures
- Common hook checks: linting, formatting, tests, security scans

## Pull Requests

**Create descriptive pull requests with proper context.**

- PR title: concise and under 70 characters
- PR description should include:
  - Summary of changes
  - Testing performed
  - Any breaking changes or migration steps
  - Related issues or tickets
- Request reviews before merging
- Address review feedback with new commits, not force pushes

## Working with Remote

**Use safe push practices.**

- Always push to a new branch: `git push -u origin <branch-name>`
- Never force push (`--force` or `-f`) to shared branches
- Pull latest changes before starting work: `git pull origin main`
- Resolve conflicts locally before pushing

## Files to Never Commit

**Ensure these are in `.gitignore` and never committed:**

- Environment files: `.env`, `.env.local`, `.env.production`
- Dependencies: `node_modules/`, `venv/`, `vendor/`
- Build artifacts: `dist/`, `build/`, `*.log`
- IDE files: `.vscode/`, `.idea/`, `*.swp`
- OS files: `.DS_Store`, `Thumbs.db`
- Credentials: any file containing secrets, keys, or tokens

## Git Safety Rules

**Destructive operations require explicit user approval.**

- Never run: `git reset --hard`, `git clean -fd`, `git push --force`, `git branch -D`
- Never modify git config without permission
- Never rewrite published history
- When in doubt, ask before executing destructive commands

## Workflow Summary

1. Pull latest changes from `main`
2. Create a feature branch with descriptive name
3. Make focused, atomic commits with clear messages
4. Stage files explicitly by path
5. Let pre-commit hooks run
6. Push to feature branch
7. Create pull request with description
8. Address review feedback
9. Merge and delete branch
