# Feature Guide

## Accounts and saved activity

Users create an account with an email and password and sign in to access the app. Supabase Auth validates credentials and handles password storage. The app includes email verification and password-reset actions. Guests and sample demo profiles are not available in the account flow.

Each signed-in account has a separate, row-level secured database record. The app saves the profile, preferences, hydration log, workout logs, and streak calendar. The saved state is loaded after sign-in and remains available after signing out. Sign out flushes pending changes before ending the session.

## Dashboard

Personalized overview with estimated BMI, water goal, energy estimates, hydration progress, streak calendar, macro overview, rewards, and workout preview.

## Hydration

Daily target and intake, glass tracking, custom amounts, target adjustment, schedule check-offs, and reset-today action. Historical streak information is stored with the user state.

## Meal plan and recipes

Seven-day meal plan with breakfast, lunch, dinner, and snack ideas. Meal details include ingredients, serving adjustment, preparation steps, timer, nutrition estimates, tips, printing, and shopping-list actions.

## Workout and music

Suggested exercises, time and calorie estimates, workout logging, history, weekly summaries, and music controls.

## Profile, age styles, and other pages

Four-step profile setup; Kids, Teens, Adults, and Seniors visual styles; settings for units, theme, language, and reminders; SDG 3 information; and the VITA in-app guide.

All health and wellbeing calculations are estimates and are not medical advice.
