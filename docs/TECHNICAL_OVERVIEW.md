# Technical Overview

## Application shape

The supplied prototype is implemented as a single HTML page with embedded styling and JavaScript. The main app screens are switched within the page rather than served as separate routes. Styling uses Tailwind CSS loaded from its CDN, with custom CSS for age styles and components. Icons use Lucide, charts use Chart.js, and font families load from Google Fonts.

## State and persistence

The app keeps profile and interface state in a JavaScript state object and serializes it to browser `localStorage` using the key `vitalis_state`. The default state includes profile, age style, units, language, theme, hydration data, workout logs, and streak information. Storage is local to the browser profile and device; there is no server-side account database in this prototype.

## Main calculations

- **BMI:** weight in kilograms divided by height in metres squared.
- **Water target:** an estimate derived from body weight with adjustments for climate, activity, and age, bounded by minimum and maximum values.
- **Energy and workout values:** formula-based estimates intended for general wellbeing demonstration.

These calculations should be reviewed before production use. In particular, adult BMI categories are not appropriate for classifying children, and water needs vary by individual and circumstance.

## External resources

The prototype references these browser-loaded services:

- Tailwind CSS CDN
- Lucide icon package
- Chart.js CDN
- Google Fonts (Plus Jakarta Sans, Nunito, Lexend, Outfit, and Space Grotesk)

Availability and behavior depend on network access and the services' current versions. For a production deployment, consider pinning dependencies and reviewing accessibility, security, privacy, and licensing requirements.

## Prototype limitations

- Sign-in and account creation are demo interface flows, not real authentication.
- Data is stored in browser local storage and is not synchronized across devices.
- Health, nutrition, water, and exercise outputs are estimates and are not clinically validated.
- Verify each interactive feature and browser behavior before treating the prototype as production-ready.
