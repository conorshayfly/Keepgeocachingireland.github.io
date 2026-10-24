# Keep Geocaching Ireland

Plain HTML / CSS / JS site (no build step, no framework).

## Pages
- `index.html`: landing page + latest forum threads
- `forums.html`: forums (categories, threads, replies, auth)
- `tools.html`: coordinate converter, Irish Grid & ITM, distance/bearing, projection, ciphers, letter values
- `events.html`: events calendar (meet & greets, CITOs, megas), filters, .ics download
- `map.html`: Leaflet map (street + topo), click for coordinates, jump to lat/lon, ITM or Irish Grid refs, saved waypoints (localStorage); supports `map.html?ll=53.35,-6.26&label=Name`

## Run locally
Any static server works:

    npx serve .
    # or
    python3 -m http.server 8000

## Turn on real forums (Supabase)
1. Create a Supabase project.
2. Run `schema.sql`, then `moderation.sql`, then `events.sql`, in the SQL editor.
3. Put your Project URL and anon key in `config.js`.
4. (Optional) Auth settings: enable email sign-ups; set your site URL for confirmation emails.

Without keys, the forums run in demo mode (data stays in your browser).

## Geocaching API (later)
`map.js` exposes `window.KGIMap.cacheLayer`, a Leaflet layer group ready for cache markers.
Geocaching API access is granted by Groundspeak on application, and its credentials/secret must never ship in
browser code. Plan: call it from a Supabase Edge Function that your site fetches, then draw the results on that layer.
Check Groundspeak's current terms for what data you're allowed to display and cache.

## Ideas for next steps
- Event RSVPs and per-county email alerts
- User profiles and avatars

## Moderation
- Anyone logged in can report a post; reports land in the mod queue at `forums.html#/mod`.
- Moderators can delete any thread or reply, pin/lock threads, and review reports.
- Make someone a moderator in the SQL editor (all role changes happen here, never from the site):

      update public.profiles set role = 'moderator'
        where id = (select id from auth.users where email = 'person@example.com');

  Use `'admin'` for the same powers (reserved for future admin-only tools).
- In demo mode, tick "Demo: moderator" after logging in to try the tools.
