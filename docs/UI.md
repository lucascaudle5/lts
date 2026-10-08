# UI and design system

How NOVA looks and why. The product rules in [PRODUCT_CONSTITUTION.md](PRODUCT_CONSTITUTION.md) win
over anything here. Design reasoning lives in the design plan (kept outside the repo); this file is
what the code does today.

## Voice

A warm desk instrument: paper, ink and a single gold lamp. Calm, specific, never cheerful-at-you.
Serif headings (`Georgia`, no font download), Geist for body and forms, Geist Mono for eyebrows,
times and anchors.

Never: streaks, scores, points, red "miss" badges, guilt copy, or a count paired with something
negative. Misses carry a path ("Do the small version", "Not today", the minimum is always visible).
Red is for destructive actions only. A heavy day gets quieter, not louder.

## Themes

Three, all defined in `src/app/globals.css` as blocks keyed by `data-theme` on `<html>`:

| Theme     | Feel                                          | Default            |
| --------- | --------------------------------------------- | ------------------ |
| Sandstone | warm paper, ruled grid, gold lamp             | yes, for new users |
| Blueprint | the light theme: cool blue paper, orange lamp | no                 |
| Dark      | low glare, softened whites                    | no                 |

A theme changes token values only, never layout, copy or structure. Values are the legacy v2.9.7
values except where WCAG AA forced a nudge (muted text, gold and green text, Blueprint gold, soft
purple tints). `src/lib/theme.test.ts` parses the CSS and asserts every text pair at 4.5:1 and
control borders and focus rings at 3:1 for all three themes, so an edit cannot silently regress.

shadcn variables (`--background`, `--primary`, ...) alias the palette, so every `ui/` component
follows. Extra tokens: `surface-2/3`, `rail`, `gold` (+ `-soft`, `-text`, `-ink`), `success`,
`warning`, `quiet`, hue fills and soft tints, `line-strong` (control borders), `shadow-paper`,
`shadow-raised`. Components use tokens, never raw palette colors (also enforced by a test).

### Where the choice lives

1. **Account:** `profiles.theme`, saved through the existing `profile.save` mutation (so it is
   validated, user-scoped and has a `change_log` row). `theme` is optional on the operation; omit it
   and the saved theme is untouched. The quick switch calls `saveThemeAction`.
2. **Browser cache:** `localStorage["nova-theme"]`, only so first paint is right.
3. **First paint:** a blocking inline script in the root layout `<head>` sets `data-theme` before
   anything is drawn. The server HTML is identical for everyone (`data-theme="sandstone"`), so the
   shell and `/demo` stay prerendered under Cache Components. Nothing reads cookies or headers.
4. **Sync:** after sign-in, `ThemeSync` (rendered in the shell's account region) writes the account
   theme to the cache and `<html>`. A save still in flight is not overwritten.

`/demo` and `/sign-in` show the quick switch too; there it only touches this browser.

## Rooms and hues

A container sets `data-room` and everything inside follows `--room`, `--room-soft`, `--room-ink`.

| Group    | Rooms                             | Hue    |
| -------- | --------------------------------- | ------ |
| nova     | Today, Inbox, Review, History     | gold   |
| plan     | Schedule, Tasks, Projects         | blue   |
| practice | Habits, Routines, Fitness         | green  |
| self     | Food, Sleep & state               | purple |
| quiet    | Money, Settings, Archive, Sandbox | ink    |

Block kinds map to hues in `components/today/labels.ts` (exams are gold, never red).

## Shell

A dark rail: gold dot wordmark, quick theme switch, account menu, then the rooms. The current room
has a gold underline and `aria-current="page"`. Phones use the same top nav and scroll it sideways;
there is no bottom taskbar. Targets are at least 40px (44px for primary actions).

## Today

One hierarchy: greeting (time-aware, in the user's timezone), the capture hero, **Up next** (the
current or next block), the floor as a checklist with a one-tap "Do the small version", then quiet
panels. Day states come from the schedule only, never from how the person says they feel:

- **empty**: "A clear day. Tell me what's on it, or leave it open."
- **open**: the normal day.
- **heavy** (5+ blocks, 4+ fixed blocks or 8+ hours): "Today looks full. Here's the floor if you
  want it." The quiet blue replaces gold and the secondary panels fold into "Show everything else".
- **done**: "That's the day." with tomorrow's first block.

## Motion

All under `prefers-reduced-motion: no-preference`: press scale, the progress fill, the settle to
`--room-soft`, a 200ms theme fade, a slow skeleton shimmer. Otherwise changes are instant.

## Shared pieces

`components/life/RoomCard` is the card for a room's things (eyebrow, serif title, body, actions,
settles when done). `RoutineRunner` is the exemplar; Habits are next. `components/proposals/ItemCard`
shows a capture's proposed changes as a kind-tinted diff.
