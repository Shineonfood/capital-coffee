# Hosting Capital Coffee

This is the hosted version of Capital Coffee. It uses the same `public/` app screens, but swaps the local PowerShell server for `server.js` and stores data in Supabase.

## What You Need

- A Render account
- A Supabase project
- This project folder connected to a GitHub repo

## 1. Create The Supabase Database

1. Open Supabase.
2. Create a new project.
3. Open the SQL editor.
4. Run the SQL in `supabase/schema.sql`.

Then open the `app_settings` table and replace the starter `catalog` value with your current `data/catalog.json` contents, minus the `adminPassword` field. The hosted password is set separately with `ADMIN_PASSWORD`.

Your current catalog file is already in the right shape. Remove only this line before pasting it into Supabase:

```json
"adminPassword": "capitalcoffee"
```

## 2. Set Environment Variables

In Render, add these environment variables:

```text
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ADMIN_PASSWORD=your-owner-portal-password
```

Use a new password for `ADMIN_PASSWORD` before going live.

## 3. Deploy On Render

Render can use `render.yaml`, or you can configure the service manually:

```text
Runtime: Node
Build Command: leave blank
Start Command: npm start
```

The app listens on Render's `PORT` automatically.

## Run Hosted Mode Locally

If Node.js is installed, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\Start-HostedCapitalCoffee.ps1
```

This starts the Node version on port `4273` so it does not collide with the local PowerShell app on port `4173`.

Stop it with:

```powershell
powershell -ExecutionPolicy Bypass -File .\Stop-HostedCapitalCoffee.ps1
```

## 4. Hosted URLs

Once deployed:

```text
https://your-render-app.onrender.com/order
https://your-render-app.onrender.com/dashboard
https://your-render-app.onrender.com/portal
```

## Security Notes

- The customer order page can be public.
- The hosted dashboard and owner portal use the owner password.
- The hosted API requires the owner password before reading or updating orders.
- Keep `SUPABASE_SERVICE_ROLE_KEY` private. Do not put it in browser code.
- The local PowerShell app still works separately.
