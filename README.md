# VITALIS — SDG 3 Wellbeing Companion

VITALIS is a responsive wellbeing web app prototype for hydration, balanced meals, movement, and healthy routines. It has visual styles for Kids, Teens, Adults, and Seniors.

## Features

- Personalized dashboard with BMI and water estimates, daily focus, activity streaks, and workout summaries.
- Hydration tracker with custom intake amounts, adjustable goals, schedule check-offs, and history.
- Seven-day meal planner with recipe details, adjustable servings, cooking timer, and shopping list.
- Workout suggestions, activity logging, estimated calorie burn, and music controls.
- Account registration and sign-in with email and password, email verification, password reset, and cloud-saved user state.
- Profile setup, age-specific styles, settings, SDG 3 information, and VITA in-app guide.

## Project files

- `index.html` contains the page structure.
- `css/styles.css` contains the app styles, including the age-specific visual themes.
- `js/tailwind-config.js` contains the Tailwind theme setup.
- `js/app.js` contains the app behavior and features.
- `supabase/schema.sql` defines the account-scoped data table and security policies.

## Run and configure

The app is a static HTML page. Open `index.html` in a browser after configuring the Supabase project as described in [Supabase setup](docs/SUPABASE_SETUP.md). The project URL and public/publishable key must be added in the app source. Never put a Supabase service-role key in browser code.

The page loads Tailwind CSS, Lucide icons, Chart.js, Google Fonts, and Supabase JS from CDNs, so an internet connection is needed.

## Documentation

- [Supabase setup and account configuration](docs/SUPABASE_SETUP.md)
- [Feature guide](docs/FEATURES.md)
- [User guide](docs/USER_GUIDE.md)
- [Technical overview](docs/TECHNICAL_OVERVIEW.md)
- [Database schema](supabase/schema.sql)

## Prototype and privacy notes

Passwords are managed by Supabase Auth. Profile, preferences, hydration logs, workout logs, and streak history are saved to a per-user database row protected by row-level security. This project does not include a custom backend server.

Health and wellbeing values are estimates, not medical advice. Before collecting real health or children’s data or launching publicly, review privacy, consent, data retention, and applicable legal requirements.
