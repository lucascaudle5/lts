# 0009. Password-based sign-in

Status: Accepted  
Date: 2026-10-07

## Context

Production sign-in depended on Supabase sending a new email link for each login. The configured
email delivery limit blocked sign-in when the same user accessed the app on a phone and computer.
This prevents ordinary access to LTS.

## Decision

Use Supabase Auth email/password for routine sign-in. Keep email links only for an explicit password
recovery request; the sign-in form itself never sends an email. Existing users set a password once
through the recovery flow.

## Consequences

- Routine sign-in works without email delivery and uses the same Supabase session cookies.
- Users must remember a password and use recovery when they forget it.
- Password recovery still depends on Supabase email delivery, but only when the user requests a
  reset.
