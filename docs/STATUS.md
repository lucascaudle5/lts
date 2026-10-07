# Status

Last updated 2026-10-07.

## Where things are

| Milestone                                           | State                                                                                                        |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| M0: repo skeleton                                   | Merged (not tagged yet)                                                                                      |
| M1: contracts and database                          | Merged ([PR #2](https://github.com/lucascaudle5/lts/pull/2))                                                 |
| M2: sign-in, app shell, read-only Today             | In [PR #3](https://github.com/lucascaudle5/lts/pull/3) (branch `m2-auth-today`), waiting on the deploy check |
| M3: capture → parser → proposals → approval → Today | Next                                                                                                         |

**To finish M2:** do the "M2 deploy check" at the end of
[`planning/hosting-setup.md`](planning/hosting-setup.md#m2-deploy-check) (Supabase redirect URLs,
Vercel Production env vars, production migrations, sign-in and Today on phone and laptop). Then
mark PR #3 ready, merge it, and tag:

```bash
git switch main && git pull
git tag -a v0.2.0 -m "M2: sign-in, shell, read-only Today"
git push origin v0.2.0
```

**Next:** M3, exactly as defined in [`planning/build-sequence.md`](planning/build-sequence.md), with
the slice details in [`planning/v1-vertical-slice.md`](planning/v1-vertical-slice.md). Start it
from `main` after PR #3 is merged; M3 builds on M2's auth, repositories, and Today.

## Known issues

- **Windows `.env.local` encoding:** Notepad or PowerShell `>` can save `.env.local` as UTF-16 or
  with a BOM, which left `db:migrate` with an empty URL. Handled in PR #3: scripts decode those files
  and fail with a fix-it message if the URL is still missing.
- **CI visibility for Cursor workers:** the token Cursor workers used couldn't read GitHub Actions
  results. This doesn't matter for Codex or for Lucas in the GitHub UI.

## How to start a Codex session

Open the repo on your computer, make sure `main` is up to date, and start Codex in the repo root.
Codex reads `AGENTS.md` on its own. Then give it one milestone at a time. A good first prompt for M3:

> Read AGENTS.md, docs/STATUS.md, and the M3 section of docs/planning/build-sequence.md, plus the
> slice spec in docs/planning/v1-vertical-slice.md. Create branch `m3-approval-loop` from main and
> implement M3 exactly as defined there, respecting its "Do not build yet" list: no model calls.
> All domain writes go through `runMutations` in one transaction with `change_log` and provenance;
> `approveItems` must only call the mutation layer. Write the tests M3 lists, including authorization,
> rollback, and cross-user isolation. Use small commits as Lucas Caudle <lucascaudle5@gmail.com>.
> Make `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm build`, and `pnpm test:db` pass,
> then open a PR to main and summarize what was built against M3's definition of done.
