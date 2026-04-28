# Capital Coffee

Capital Coffee is a lightweight coffee ordering website for an iPad order screen and a laptop owner/barista dashboard.

## Screens

- `/order` for customer ordering
- `/dashboard` for the coffee queue
- `/portal` for the password-protected owner portal

The owner portal can edit menu items, per-item sizes, milks, syrups, add-ons, and the global price display setting.

## Hosted Setup

This repo is ready for Render and Supabase.

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Deploy this repo to Render as a Node web service.
4. Set these Render environment variables:

```text
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ADMIN_PASSWORD=your-owner-portal-password
```

Render can use `render.yaml`, or you can configure it manually:

```text
Build Command: leave blank
Start Command: npm start
```

See `HOSTING.md` for the fuller walkthrough.

## Local Hosted Test

If Node.js is installed:

```powershell
$env:PORT="4273"; node server.js
```

Then open:

```text
http://localhost:4273/order
http://localhost:4273/dashboard
http://localhost:4273/portal
```

