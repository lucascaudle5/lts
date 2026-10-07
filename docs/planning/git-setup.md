---
cursor:
  subagentId: "bc-ecf16999-a762-5e4d-83e3-ddf053109c87"
---

# Git Setup for LTS 1.0

**Current state:** the project lives in a Cursor-hosted Git repository (a new project without a
GitHub repo yet). `main` holds one empty commit ("Initialize project"). The skeleton and docs are on
branch `cursor/lts-successor-skeleton-9c87` (2 commits). Pull requests can't be opened on this
temporary remote, so the plan is: create the GitHub repo, push this history there, open the PR on
GitHub, and treat GitHub as canonical from then on (ADR 0007).

Nothing below assumes credentials. Wherever GitHub needs authentication, use whatever you already
have set up: HTTPS with Git Credential Manager or a personal access token, SSH keys, or the `gh` CLI
after `gh auth login`.

## 0. One-time machine setup

```bash
git --version                      # any recent git
git config --global user.name  "Lucas …"
git config --global user.email "you@example.com"
git config --global init.defaultBranch main
git config --global pull.ff only   # never create surprise merge commits on pull
corepack enable                    # provides pnpm
```

## 1. Get the code onto your machine

**Path A (recommended): you have this repository's history.** Use this path if you cloned the
Cursor repo, or opened it locally from Cursor.

```bash
cd lts
git fetch origin
git switch cursor/lts-successor-skeleton-9c87
git log --oneline                  # expect: docs commit, scaffold commit, "Initialize project"
```

**Path B: you only have the files** (e.g. a downloaded folder without `.git`). Start a fresh
history. This is the "first commit" path:

```bash
cd lts
git init
git add -A
git status                         # check: no .env.local, no legacy/, no *.zip
git commit -m "Scaffold LTS 1.0 skeleton with docs, ADRs, and CI"
```

Either way, confirm the skeleton works before pushing anywhere:

```bash
pnpm install
pnpm check && pnpm build
```

## 2. Create the GitHub repository

Pick one:

- **Web:** github.com → New repository → name `lts` (or `life-tracker-suite`) → Private →
  **do not** add a README, .gitignore, or license (the repo already has them) → Create.
- **CLI** (only if `gh` is installed and you've run `gh auth login`):
  `gh repo create lts --private --description "Life Tracker Suite 1.0"`

## 3. Connect the remote and push

```bash
# HTTPS
git remote add github https://github.com/<your-username>/lts.git
# …or SSH
git remote add github git@github.com:<your-username>/lts.git

git remote -v                      # Path A shows origin (Cursor) + github; Path B shows only github
```

Path A:

```bash
git push github main               # the empty "Initialize project" commit becomes GitHub main
git push -u github cursor/lts-successor-skeleton-9c87
```

Then on GitHub, open a PR from `cursor/lts-successor-skeleton-9c87` into `main`, let CI run, and
merge it (squash or merge commit, your choice). Afterwards:

```bash
git switch main
git pull github main
git branch -d cursor/lts-successor-skeleton-9c87
git push github --delete cursor/lts-successor-skeleton-9c87
```

Path B: `git push -u github main`.

Don't tag yet; tagging is the last step (step 8), after a clean local verification.

## 4. Make GitHub canonical

```bash
# Optional: keep the Cursor remote under a clear name, and make GitHub "origin"
git remote rename origin cursor    # Path A only
git remote rename github origin
git branch -u origin/main main
```

From here on, every command below uses `origin` = GitHub. On GitHub, consider:
Settings → Branches → add a rule for `main` → "Require status checks to pass" → select `CI / check`.
Also create the label `backlog`, then move each line of `docs/BACKLOG.md` into an Issue with that
label and delete the file in a `docs/` PR.

## 5. Daily feature-branch workflow

```bash
git switch main && git pull
git switch -c feat/m1-contracts-and-schema
# work in small commits
git add -p                         # stage deliberately
git commit -m "Add proposal contracts for schedule, task, observation"
pnpm check
git push -u origin HEAD
# open a PR on GitHub → CI green → merge → delete branch
git switch main && git pull && git branch -d feat/m1-contracts-and-schema
```

Prefixes: `feat/`, `fix/`, `docs/`, `chore/`, `spike/` (spikes are never merged). Keep `main`
releasable: if it isn't green, fixing it comes before anything else.

## 6. Rollback and revert

```bash
git revert <commit-sha>            # undo one commit with a new commit (safe on main)
git revert -m 1 <merge-sha>        # undo a merged PR
git push

git restore <file>                 # discard uncommitted changes to a file
git reset --soft HEAD~1            # un-commit your last LOCAL, unpushed commit (keeps changes)
```

Never force-push `main`. If a secret is ever committed, rotate the secret first, then clean history.

## 7. Releases and tags

One annotated tag per milestone (see the build sequence). The first one, `v0.0.0`, is step 8.

```bash
git switch main && git pull
pnpm check && pnpm build
git tag -a v0.3.0 -m "M3: capture → approval loop"
git push origin v0.3.0
```

Optionally create a GitHub Release from the tag with a three-line summary. `v1.0.0` is tagged at the
M8 freeze. After that, new ideas from the backlog become `v1.1` work.

## 8. Final step: verify locally, then tag `v0.0.0`

Once `main` on GitHub contains the merged skeleton (Path A) or the first commit (Path B), and GitHub
is `origin` (step 4):

```bash
git switch main
git pull
pnpm install && pnpm check && pnpm build   # all three must pass on your machine
git tag -a v0.0.0 -m "M0: repository skeleton"
git push origin v0.0.0
```

If you skipped step 4's renames, push the tag with `git push github v0.0.0` instead. Check that the
tag shows up under the repository's Tags on GitHub and that the CI run on `main` is green. M0 is
done; M1 starts on a new `feat/` branch.
