# ✦ Space Counter

A GitHub profile view counter with a deep space aesthetic. Animated nebula glow, twinkling stars, a scanline sweep, and a count that increments every time someone visits your profile.

![Space Counter Preview](https://space-counter-five.vercel.app/api/count?username=kuki-ta)

---

## Deploy your own

### What you need
- A [GitHub](https://github.com) account (you already have one)
- A free [Vercel](https://vercel.com) account
- A free [Upstash](https://console.upstash.com) account (for Redis)

### Step 1 — Fork this repo

Click **Fork** in the top right on GitHub. This gives you your own copy to deploy from.

### Step 2 — Get an Upstash Redis database

1. Sign up at [console.upstash.com](https://console.upstash.com)
2. Create a new database (any name, pick a region close to you)
3. On the database page, copy these two values — you'll need them in the next step:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

> **Already have an Upstash database?** You can reuse it. The counter only writes keys like `counter:yourusername` which won't conflict with anything else.

### Step 3 — Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/kuki-ta/space-counter)

1. Click the button above (or go to [vercel.com/new](https://vercel.com/new) and import your fork)
2. When prompted for **Environment Variables**, add:
   ```
   UPSTASH_REDIS_REST_URL     → paste from Upstash
   UPSTASH_REDIS_REST_TOKEN   → paste from Upstash
   ```
3. Click **Deploy** and wait ~30 seconds

### Step 4 — Add the counter to your profile README

Your counter is live at:
```
https://your-deployment.vercel.app/api/count?username=YOUR_GITHUB_USERNAME
```

Open your profile README (`github.com/YOUR_USERNAME/YOUR_USERNAME`) and paste this wherever you want the counter:

```markdown
[![Profile views](https://your-deployment.vercel.app/api/count?username=YOUR_GITHUB_USERNAME)](https://your-deployment.vercel.app)
```

Replace `your-deployment.vercel.app` with your actual Vercel URL, and `YOUR_GITHUB_USERNAME` with your username. Done.

---

## How it works

When GitHub renders your README, it fetches the counter image from your Vercel URL. That request hits the serverless function, which:

1. Sanitizes the username from the query string
2. Runs `INCR counter:username` in Redis (atomic — no double-counts even under simultaneous requests)
3. Builds a fresh SVG with the new count baked in
4. Returns it with `Cache-Control: no-store` so GitHub's proxy never serves a stale number

The star field is generated deterministically from your username using a simple LCG (pseudo-random number generator), so your layout is unique to you but renders identically every time.

---

## Project structure

```
space-counter/
├── api/
│   └── count.js        ← Serverless function: increments count, returns SVG
├── public/
│   └── index.html      ← Landing page with live counter generator
├── package.json
├── vercel.json         ← Vercel config (function timeout, CORS headers)
└── README.md
```

---

## Environment variables

| Variable | Where to find it |
|---|---|
| `UPSTASH_REDIS_REST_URL` | Upstash dashboard → your database → REST API section |
| `UPSTASH_REDIS_REST_TOKEN` | Same place, right below the URL |

---

## Want to contribute a theme?

Themes are welcome! A theme is just a different `buildSvg()` function in `api/count.js`. If you build something cool, open a PR and add it as a selectable option via a `?theme=` query param.

---

## License

MIT — do whatever you want with it.
