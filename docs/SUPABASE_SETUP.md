# Supabase setup: accounts and saved activity

The app uses Supabase Auth for account passwords and a private Postgres row for each user's saved VITALIS state. Passwords are never written to the app table. Row-level security restricts each signed-in account to its own row.

## 1. Create a Supabase project

Create a project in Supabase and enable **Email** as an authentication provider. Keep email verification enabled for real accounts. Configure the minimum password length to at least 8 characters.

## 2. Create the user state table

Open the Supabase SQL Editor and run [`../supabase/schema.sql`](../supabase/schema.sql). This creates `public.user_app_state`, enables row-level security, and grants authenticated users access only to rows whose `user_id` matches their own account ID.

## 3. Configure email redirects

In Supabase Authentication URL settings:

- Set the Site URL to your deployed website URL.
- Add the exact deployed URL to the allowed redirect URLs.
- While developing locally, add the local server URL you use, such as `http://localhost:8000/**`.

Email verification and password-reset links must return to an allowed URL.

## 4. Add the browser-safe project values

In `js/app.js`, find `SUPABASE_URL` and `SUPABASE_ANON_KEY` near the top of the file. Replace the placeholders with your Supabase **Project URL** and **publishable (anon) key** from Project Settings → API.

The publishable/anon key is intended for browser use when row-level security is correctly enabled. **Never put the `service_role` key in GitHub or any public client file.**

## 5. Deploy the site

Keep `index.html`, `css/styles.css`, the `js/` files, and `supabase/schema.sql` in the repository with their folder structure intact. Deploy the repository with GitHub Pages or another static host, then add the final website URL to Supabase's allowed redirect URLs. The app reports a configuration message on the sign-in screen if the placeholders have not been replaced.

## How account data is saved

After sign-up or sign-in, the app loads the state row for the authenticated user ID. Profile setup creates the row. Changes to the profile, hydration, meals, settings, workout logs, and streak calendar are automatically saved; signing out flushes pending changes before the session ends. On the next sign-in, the app restores that account's saved state. Signing in as a different user loads only that user's row.

The browser keeps the Supabase Auth session so a user can remain signed in between visits; use **Sign out** to end the session on a shared device. Account activity remains in the database after sign-out.

## Verify before public launch

- Test sign-up, email verification, correct and incorrect passwords, password reset, sign-out, and sign-in again.
- Confirm a second account cannot read or change the first account's row.
- Review privacy notices, account deletion and data-retention practices, email delivery, backups, and applicable consent requirements.
- Do not describe BMI, water, nutrition, or calorie estimates as diagnosis or treatment.
