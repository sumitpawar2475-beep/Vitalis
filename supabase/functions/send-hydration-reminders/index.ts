import { createClient } from "npm:@supabase/supabase-js@2";
import { ApplicationServer, importVapidKeys, PushMessageError } from "jsr:@negrel/webpush@0.5.0";

const REMINDER_SLOTS = [
  { time: "07:00", title: "Good morning 💧", body: "Start gently: have a glass of water if it suits you." },
  { time: "09:00", title: "Hydration check-in 💧", body: "A gentle reminder to have some water." },
  { time: "11:30", title: "Take a water break 💧", body: "Pause for a sip and keep your day moving." },
  { time: "13:30", title: "Lunch-time hydration 💧", body: "If you haven't already, have some water with lunch." },
  { time: "16:00", title: "Afternoon water break 💧", body: "Take a moment for a refreshing sip." },
  { time: "18:30", title: "Evening check-in 💧", body: "A gentle reminder to check in with your water today." },
  { time: "20:00", title: "Hydration check-in 💧", body: "If you're thirsty, take a sip of water." },
  { time: "21:30", title: "Wind down gently 💧", body: "A light sip if you need one before bed." }
];

function json(body, status=200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
function secretMatches(left, right) {
  if (!left || !right || left.length !== right.length) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i++) mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return mismatch === 0;
}
function localClock(now, timeZone) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return { date: `${values.year}-${values.month}-${values.day}`, time: `${values.hour}:${values.minute}` };
}

Deno.serve(async req => {
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const expectedSecret = Deno.env.get("VITALIS_PUSH_CRON_SECRET") || "";
  if (!secretMatches(req.headers.get("x-vitalis-cron-secret") || "", expectedSecret)) return json({ error: "Unauthorized." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const privateJwkJson = Deno.env.get("VAPID_KEYS_JWK");
  if (!supabaseUrl || !serviceKey || !privateJwkJson) return json({ error: "Push service is not configured." }, 500);

  try {
    const exportedKeys = JSON.parse(privateJwkJson);
    const vapidKeys = await importVapidKeys(exportedKeys, { extractable: true });
    const pushServer = await ApplicationServer.new({
      contactInformation: Deno.env.get("VAPID_CONTACT") || "https://famous-naiad-0fb683.netlify.app/",
      vapidKeys
    });
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: subscriptions, error: subscriptionError } = await admin
      .from("push_subscriptions")
      .select("user_id, endpoint, subscription_json, time_zone, last_sent_key");
    if (subscriptionError) throw subscriptionError;
    if (!subscriptions?.length) return json({ sent: 0, removed: 0 });

    const userIds = [...new Set(subscriptions.map(row => row.user_id))];
    const { data: savedStates, error: stateError } = await admin
      .from("user_app_state")
      .select("user_id, state")
      .in("user_id", userIds);
    if (stateError) throw stateError;
    const stateByUser = new Map((savedStates || []).map(row => [row.user_id, row.state || {}]));
    const now = new Date();
    let sent = 0, skipped = 0, removed = 0;

    for (const row of subscriptions) {
      const state = stateByUser.get(row.user_id);
      if (!state?.reminders) { skipped++; continue; }

      let clock;
      try { clock = localClock(now, row.time_zone || "UTC"); }
      catch (_) { clock = localClock(now, "UTC"); }
      const slotIndex = REMINDER_SLOTS.findIndex(slot => slot.time === clock.time);
      if (slotIndex < 0) { skipped++; continue; }

      const slot = REMINDER_SLOTS[slotIndex];
      const sentKey = `${clock.date}|${slot.time}`;
      if (row.last_sent_key === sentKey) { skipped++; continue; }
      try {
        const subscription = row.subscription_json;
        await pushServer.subscribe(subscription).pushTextMessage(JSON.stringify({
          title: slot.title,
          body: slot.body,
          tag: `vitalis-hydration-${clock.date}-${slot.time.replace(':','')}`,
          data: { url: "/" }
        }), { ttl: 3600 });
        const { error: updateError } = await admin
          .from("push_subscriptions")
          .update({ last_sent_key: sentKey })
          .eq("user_id", row.user_id)
          .eq("endpoint", row.endpoint);
        if (updateError) throw updateError;
        sent++;
      } catch (error) {
        if (error instanceof PushMessageError && error.isGone()) {
          await admin.from("push_subscriptions").delete().eq("user_id", row.user_id).eq("endpoint", row.endpoint);
          removed++;
        } else {
          console.error("A hydration push could not be delivered:", error);
        }
      }
    }
    return json({ sent, skipped, removed });
  } catch (error) {
    console.error("Hydration push scheduler failed:", error);
    return json({ error: "Hydration push scheduler failed. Check the function logs." }, 500);
  }
});
