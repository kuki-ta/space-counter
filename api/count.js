/**
 * space-counter — /api/count.js
 *
 * The core of the whole project. This is a Vercel serverless function that:
 *   1. Receives a request with a ?username= query param
 *   2. Atomically increments that user's counter in Upstash Redis
 *   3. Returns a freshly-rendered SVG image with the new count
 *
 * Because we return Cache-Control: no-store, GitHub's image proxy fetches
 * a fresh copy every time someone loads the profile — which is exactly what
 * we want so the count is always current.
 *
 * Usage (in a GitHub README):
 *   ![Profile views](https://your-deployment.vercel.app/api/count?username=yourusername)
 */

import { Redis } from '@upstash/redis';

// ---------------------------------------------------------------------------
// Redis client
// ---------------------------------------------------------------------------
// Upstash Redis is a serverless-friendly Redis that works over HTTP, which
// makes it perfect for Vercel functions (no persistent TCP connections needed).
// Credentials come from environment variables — never hardcode these.
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// ---------------------------------------------------------------------------
// Star field generator
// ---------------------------------------------------------------------------
// Generates a deterministic set of SVG <circle> elements that form the star
// field background. "Deterministic" means: given the same username, you always
// get the same star layout. This makes each user's counter subtly unique while
// keeping the SVG output consistent across renders (important for caching).
//
// We use a simple LCG (Linear Congruential Generator) — a classic fast PRNG —
// seeded from the sum of the username's char codes. No external dependencies,
// no randomness that would cause the SVG to diff on every request.
function generateStars(count, seed) {
  const stars = [];
  let s = seed;

  // Six animation classes with different twinkle speeds and rhythms.
  // Assigning them pseudo-randomly means stars don't all pulse in sync.
  const animClasses = ['s1', 's2', 's3', 's4', 's5', 's6'];

  // Weighted toward white so most stars look "normal", with occasional
  // purple, teal, and blue tints for a subtle nebula feel.
  const colors = ['#fff', '#fff', '#fff', '#AFA9EC', '#9FE1CB', '#B5D4F4'];

  for (let i = 0; i < count; i++) {
    // LCG step — produces a new pseudo-random 32-bit integer each iteration
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const x = Math.abs(s % 680); // x position within the 680px-wide viewBox

    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const y = Math.abs(s % 150); // y position within the 150px-tall viewBox

    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const r = 0.5 + (Math.abs(s % 10) / 10) * 1.2; // radius between 0.5 and 1.7px

    const color = colors[Math.abs(s % colors.length)];
    const delay = (Math.abs(s % 50) / 10).toFixed(1); // animation delay 0–5s
    const anim = animClasses[Math.abs(s % animClasses.length)];

    stars.push(
      `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" class="${anim}" style="animation-delay:-${delay}s"/>`
    );
  }

  return stars.join('\n    ');
}

// ---------------------------------------------------------------------------
// Count formatter
// ---------------------------------------------------------------------------
// Keeps the number readable at any scale. A raw number like 1234567 would
// overflow the SVG text box, so we abbreviate above 1K and 1M.
function formatCount(n) {
  if (n >= 1_000_000) {
    return (n / 1_000_000).toFixed(1) + 'M';
  }
  if (n >= 1_000) {
    const k = (n / 1000).toFixed(1);
    // Avoid "4.0K" — just show "4K"
    return k.endsWith('.0') ? Math.floor(n / 1000) + 'K' : k + 'K';
  }
  return n.toLocaleString();
}

// ---------------------------------------------------------------------------
// SVG builder
// ---------------------------------------------------------------------------
// Assembles the full SVG string. Everything is inline — no external assets,
// no web fonts, no network requests — so it renders correctly wherever
// GitHub's image proxy decides to display it.
//
// Vertical layout (canvas height: 150px):
//   y=52  — top label ("KUKITA'S CORNER")
//   y=108 — count (58px font, baseline here, cap-height starts around y=60)
//   y=134 — subtitle text
//   y=118 — decorative lines (between count and subtitle)
//
// Top padding above label:  ~40px
// Bottom padding below text: ~16px
// Close enough given SVG y is baseline, not top-of-glyph.
function buildSvg(count, username) {
  const displayCount = formatCount(count);

  // Seed the star generator from the username so each person gets a unique
  // but reproducible star layout. Starting seed of 42 is arbitrary.
  const starSeed = username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 42);
  const stars = generateStars(28, starSeed);

  // Top label — sets the scene before the number lands.
  const label = "KUKITA'S CORNER";

  return `<svg width="100%" viewBox="0 0 680 150" xmlns="http://www.w3.org/2000/svg" role="img">
  <title>${username || 'Profile'} view counter: ${count.toLocaleString()} visitors</title>
  <desc>An animated space-themed counter showing ${count.toLocaleString()} profile views for ${username}</desc>

  <defs>
    <!--
      Six twinkle animations with different timing so stars don't pulse in sync.
      Negative animation-delays (set per-star) make them start mid-cycle so the
      field looks alive immediately instead of all fading in together.
    -->
    <style>
      @keyframes twinkle1 { 0%,100%{opacity:.2} 50%{opacity:1} }
      @keyframes twinkle2 { 0%,100%{opacity:.8} 50%{opacity:.15} }
      @keyframes twinkle3 { 0%,100%{opacity:.5} 60%{opacity:1} }

      /* Scanline sweeps from top to bottom and fades at the edges */
      @keyframes scan {
        0%   { transform:translateY(-10px); opacity:0 }
        10%  { opacity:.15 }
        90%  { opacity:.15 }
        100% { transform:translateY(130px); opacity:0 }
      }

      /* Nebula layers breathe slowly at different offsets */
      @keyframes pulse { 0%,100%{opacity:.55} 50%{opacity:1} }

      .s1 { animation: twinkle1 3.1s ease-in-out infinite }
      .s2 { animation: twinkle2 2.4s ease-in-out infinite }
      .s3 { animation: twinkle3 4.2s ease-in-out infinite }
      .s4 { animation: twinkle1 5.1s ease-in-out infinite }
      .s5 { animation: twinkle2 3.7s ease-in-out infinite }
      .s6 { animation: twinkle3 2.9s ease-in-out infinite }
      .scanline { animation: scan 4s linear infinite }
      .nb { animation: pulse 5s ease-in-out infinite }
    </style>

    <!-- Three nebula gradients: purple (left), teal (right), blue (center-bottom) -->
    <radialGradient id="nb1" cx="30%" cy="50%" r="40%">
      <stop offset="0%" stop-color="#534AB7" stop-opacity=".25"/>
      <stop offset="100%" stop-color="#534AB7" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="nb2" cx="75%" cy="40%" r="35%">
      <stop offset="0%" stop-color="#0F6E56" stop-opacity=".18"/>
      <stop offset="100%" stop-color="#0F6E56" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="nb3" cx="55%" cy="70%" r="30%">
      <stop offset="0%" stop-color="#185FA5" stop-opacity=".15"/>
      <stop offset="100%" stop-color="#185FA5" stop-opacity="0"/>
    </radialGradient>

    <!-- Clip everything to the card's rounded corners -->
    <clipPath id="cc">
      <rect x="0" y="0" width="680" height="150" rx="12"/>
    </clipPath>
  </defs>

  <!-- Card background -->
  <rect x="0" y="0" width="680" height="150" rx="12" fill="#07060f"/>

  <g clip-path="url(#cc)">

    <!-- Nebula layers (stacked, each pulsing at a different phase) -->
    <rect x="0" y="0" width="680" height="150" class="nb" fill="url(#nb1)"/>
    <rect x="0" y="0" width="680" height="150" class="nb" fill="url(#nb2)" style="animation-delay:-2.3s"/>
    <rect x="0" y="0" width="680" height="150" class="nb" fill="url(#nb3)" style="animation-delay:-1.1s"/>

    <!-- Stars (deterministically placed based on username) -->
    ${stars}

    <!-- Scanline effect -->
    <rect x="0" y="0" width="680" height="3" fill="#534AB7" opacity=".6" class="scanline"/>

    <!-- Top and bottom border lines -->
    <line x1="0" y1="0"   x2="680" y2="0"   stroke="#534AB7" stroke-width="1" stroke-opacity=".4"/>
    <line x1="0" y1="149" x2="680" y2="149" stroke="#534AB7" stroke-width="1" stroke-opacity=".4"/>

    <!-- Label — sits above the number, sets the scene -->
    <text x="340" y="52"
      font-family="monospace" font-size="11" font-weight="400"
      fill="#9FE1CB" opacity=".65"
      text-anchor="middle" letter-spacing="5">✦ ${label} ✦</text>

    <!-- The count — this is the main event -->
    <text x="340" y="108"
      font-family="monospace" font-size="58" font-weight="700"
      fill="#EEEDFE"
      text-anchor="middle" letter-spacing="8">${displayCount}</text>

    <!-- Subtitle — completes the scene -->
    <text x="340" y="134"
      font-family="monospace" font-size="10"
      fill="#7F77DD" opacity=".8"
      text-anchor="middle" letter-spacing="3">EXPLORERS REACHED THIS CORNER OF THE UNIVERSE</text>

    <!-- Decorative side lines flanking the subtitle -->
    <line x1="100" y1="118" x2="240" y2="118" stroke="#534AB7" stroke-width=".5" stroke-opacity=".45"/>
    <line x1="440" y1="118" x2="580" y2="118" stroke="#534AB7" stroke-width=".5" stroke-opacity=".45"/>
    <circle cx="100" cy="118" r="1.5" fill="#7F77DD" opacity=".6"/>
    <circle cx="580" cy="118" r="1.5" fill="#7F77DD" opacity=".6"/>

  </g>
</svg>`;
}

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------
export default async function handler(req, res) {
  const { username } = req.query;

  // Require a username — the counter is per-user, so this is non-negotiable
  if (!username) {
    return res.status(400).send('Missing ?username= parameter');
  }

  // Sanitize the username: lowercase, strip anything that isn't a valid
  // GitHub username character. This prevents Redis key injection and ensures
  // the label text in the SVG is clean.
  const cleanUsername = username.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (!cleanUsername) {
    return res.status(400).send('Invalid username');
  }

  // INCR is atomic in Redis — even if two requests arrive simultaneously,
  // each one gets a unique, correctly-incremented count. No race conditions.
  const key = `counter:${cleanUsername}`;
  const count = await redis.incr(key);

  // Tell every cache layer (GitHub's proxy, CDNs, browsers) not to store this.
  // If GitHub caches the SVG, the count never updates — so this is critical.
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Access-Control-Allow-Origin', '*');

  res.status(200).send(buildSvg(count, cleanUsername));
}
