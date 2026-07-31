---
name: verify
description: Use when verifying a change to this CRM end-to-end in the running app, not just with a typecheck. Boots a dev server against a throwaway database, provisions a login, and drives the UI in a browser.
---

# Verifying a change in the running app

`pnpm typecheck` proves the code compiles. It does not prove the page renders, the action
runs, or the query returns what you think. For anything user-facing, click it.

## Never mutate production data while testing

The dev server reads whatever `DATABASE_URL` points at. If that is a live database, do not
run seeds, throwaway inserts or destructive click-throughs against it.

Point a second server at a scratch database instead:

```bash
export TEST_DATABASE_URL=postgresql://crm:crm@localhost:5432/crm_test
DATABASE_URL="$TEST_DATABASE_URL" pnpm db:migrate
DATABASE_URL="$TEST_DATABASE_URL" pnpm dev
```

Kill any dev server already holding port 4325 first: the better-auth base URL is pinned to
that port in `src/lib/config.ts`, so a server on another port cannot log in.

WARNING: if you `source .env` in a shell, the LIVE `DATABASE_URL` is now exported. Every
subsequent `pnpm db:*` or script invocation must carry an explicit
`DATABASE_URL="$TEST_DATABASE_URL"` prefix on the same command line.

## Provision a login

A fresh database has no workspace and no user. One command does both:

```bash
DATABASE_URL="$TEST_DATABASE_URL" pnpm bootstrap:admin \
  --email verify@example.com --name Verifier --password Verify12345 --org test
```

This creates the org, seeds its enum defaults from `src/core/enum-defaults.ts` and makes
the user its owner. New enum kinds get exercised on the way.

## Drive it

Prefer a browser tool that attaches to an already-running browser over one that launches
its own. Launching a fresh browser per run fights over the profile lock and drops
artifacts into the repo.

Flow: navigate to `http://localhost:4325/login`, sign in, then go to
`/<orgSlug>/<page>` and screenshot.

Gotcha: the login form is React-controlled, so programmatic value-setting does not
register. Click each field and type into it:

1. Click the E-mail field, type the address
2. Click the Heslo field, type the password
3. Click "Přihlásit se", wait for the redirect, then navigate to the page under test

## Gotchas

- The house `Select` renders two comboboxes (the custom one and a hidden native one).
  Click the custom one and pick from its option list.
- Radix opens popovers as extra `role=dialog` nodes, so a bare `[role=dialog]` selector
  goes ambiguous. Scope by accessible name.
- Validation errors surface as `alert` toasts. Snapshot the whole page to see them.
- Check both light and dark theme before calling a UI change done.

## Clean up

Delete any screenshots or scratch files the tooling dropped into the working tree, then
confirm with `git status` before ending the turn.

## What "verified" means

Not "it compiles". Verified is: the page rendered, the action ran, the row changed, the
undo toast worked, and you saw it. If you only ran a typecheck, say so, do not call it
verified.
