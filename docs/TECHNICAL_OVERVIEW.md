# Technical Overview

## Application

The VITALIS frontend is a single-page static web app organized across `index.html`, `css/styles.css`, and JavaScript files under `js/`. Tailwind CSS, Lucide, Chart.js, Google Fonts, and Supabase JS load from CDNs. The Tailwind theme setup is in `js/tailwind-config.js`; app behavior and the Supabase URL plus publishable/anon key are in `js/app.js`. These are public browser values; a service-role key must never be included in frontend code.

## Authentication

Supabase Auth handles email/password account creation, password verification, persisted auth sessions, email verification, and password-reset email requests. The frontend uses `signUp`, `signInWithPassword`, `resetPasswordForEmail`, `getSession`, and `signOut`. Passwords are not stored in VITALIS app tables.

## Persistence and access control

The app stores the current application state as JSONB in `public.user_app_state`, keyed by the authenticated Supabase user UUID. The state includes profile/settings, hydration data, workout logs, and streak history. Changes are debounced to reduce writes; sign-out flushes pending state before ending the session. Authenticated users can read, insert, update, or delete only the row whose `user_id` equals `auth.uid()`; `supabase/schema.sql` enables row-level security and defines these policies.

## Setup and deployment

See [Supabase setup](SUPABASE_SETUP.md) for creating the project, applying the schema, configuring redirects and email auth, setting the public project values, and deploying the static site.

## Limitations

The repository contains a frontend integration and SQL setup, but it cannot connect to a real Supabase project until the project URL and publishable key are configured and the schema is applied. Account and database behavior must then be tested against that project. The current app is not a production health service; estimates are informational and not clinically validated.
