# Enable VITALIS hydration push reminders

This adds scheduled browser push notifications to the hydration schedule, including when the VITALIS tab is closed. Users must allow notifications in their browser. Delivery still depends on the browser/device being able to receive web push.

## One-time setup

### 1. Generate your keys

On a computer with Node.js installed, open PowerShell in the project folder and run:

```powershell
node tools/generate-vapid-keys.mjs
```

The script prints three values. Keep the output private. **Never add `VAPID_KEYS_JWK` or `VITALIS_PUSH_CRON_SECRET` to GitHub.**

### 2. Set the public key in the website

In `js/app.js`, replace `PASTE_PUBLIC_VAPID_KEY_HERE` in `VITALIS_PUSH_PUBLIC_KEY` with the generated `VITALIS_PUSH_PUBLIC_KEY`. The public key is safe in the website code. Commit and push this change; Netlify will redeploy.

### 3. Add the private secrets to Supabase

In Supabase, open **Project Settings → Edge Functions → Secrets** (or **Edge Functions → Secrets**) and add:

- `VAPID_KEYS_JWK` = the generated `VAPID_KEYS_JWK` JSON value
- `VITALIS_PUSH_CRON_SECRET` = the generated `VITALIS_PUSH_CRON_SECRET`

Do not put either value in `js/app.js`, HTML, or GitHub.

### 4. Deploy the scheduled function

Install/use the Supabase CLI and open PowerShell in the project folder:

```powershell
npx supabase login
npx supabase link --project-ref eqsqbjqemjxsaixmffqf
npx supabase functions deploy send-hydration-reminders
```

The project reference above is read from the Supabase URL already configured in `js/app.js`. If your Supabase project is different, use the reference from your own Project URL instead.

### 5. Save scheduler values in Supabase Vault

In **Database → Vault**, create these secrets:

| Name | Value |
| --- | --- |
| `vitalis_project_url` | Your Supabase Project URL, such as `https://YOUR_PROJECT_REF.supabase.co` |
| `vitalis_publishable_key` | The publishable key already present in `js/app.js` |
| `vitalis_push_cron_secret` | The exact same value as `VITALIS_PUSH_CRON_SECRET` in Edge Function Secrets |

### 6. Create the table and one-minute schedule

Open **SQL Editor** in Supabase, copy the complete contents of `supabase/push-reminders-setup.sql`, and run it. It creates a private per-account push-subscription table and invokes the Edge Function once a minute. The function sends reminders at the eight local times shown in the hydration plan.

## Using reminders

Sign in to VITALIS, open **Hydration**, and turn on **Reminders**. Allow the browser notification prompt. If the switch is already checked from the old demo setting, turn it off and back on after setup. The app saves this device's push subscription to the signed-in account. Turning reminders off disables sending for the account and unregisters the current browser.

If the browser had previously blocked notifications, allow them in the browser's site settings, then turn the VITALIS switch off and on again.

## Troubleshooting

- **“Push reminders need one-time setup”**: set the public VAPID key in `js/app.js`, push it to GitHub, and wait for the Netlify deploy.
- **The switch turns off again**: check that the SQL table exists and the `push_subscriptions` policies were created. Look at the browser console for the Supabase error.
- **No notification arrives**: check that the account's reminders switch is on, browser notifications are allowed for the exact current site address, and the Edge Function logs show successful invocations.
- **Changed domain**: register the service worker on the current HTTPS domain and allow notifications for that domain. Each browser/device must subscribe separately.

Reminders are gentle wellness prompts, not medical advice.
