# TCG India Trust Dex — Project Guide for Claude

## Project Overview

A Pokédex-styled trust registry for the India Pokémon TCG community. Users can search for verified sellers, trusted individuals, and reported scammers. Built as a fully static site — no backend, no framework, no build step required.

---

## Folder Structure

```
tcg-trust-dex/
├── index.html           ← Single page app shell
├── data/
│   └── sellers.json     ← All seller and scammer data (source of truth)
├── css/
│   └── style.css        ← All styles (Pokédex shell, screen, tiles, detail panel)
├── js/
│   └── app.js           ← All logic (data loading, search, filtering, rendering)
├── assets/
│   └── favicon.ico      ← Optional: Pokéball favicon
└── CLAUDE.md            ← This file
```

---

## Data Format — `data/sellers.json`

This is the **single source of truth**. All UI is generated from this file. Never hardcode seller data in HTML or JS.

```json
{
  "meta": {
    "version": "1.0",
    "last_updated": "2025-03",
    "market": "India TCG Community",
    "total_genuine": 45,
    "total_scammers": 5
  },
  "entries": [
    {
      "id": "gen_002",
      "name": "Galaxy Vault",
      "status": "genuine",
      "seller_type": "Seller",
      "trust_level": "verified",
      "tcg_type": "Pokemon",
      "products": ["Singles"],
      "instagram": {
        "handle": "@galaxy__vault",
        "url": "https://www.instagram.com/galaxy__vault"
      },
      "id_verified": true,
      "tags": ["trusted", "id_verified"]
    },
    {
      "id": "scam_005",
      "name": "Dev Tiwari/Mew Tiwari",
      "status": "scammer",
      "seller_type": "Unknown",
      "trust_level": "blacklisted",
      "tcg_type": "Pokemon",
      "products": [],
      "instagram": {
        "handle": "Account Deactivated",
        "url": null
      },
      "id_verified": false,
      "severity": "critical",
      "reason": "Scammed ~30 people totalling ₹8–10 lakh. Not responding for refund or shipment.",
      "tags": ["scammer", "do_not_trade", "critical"]
    }
  ]
}
```

### Field Reference

| Field | Type | Description |
|---|---|---|
| `id` | string | Unique ID. Prefix `gen_` for genuine, `scam_` for scammers |
| `name` | string | Display name |
| `status` | `"genuine"` \| `"scammer"` \| `"reported"` \| `"resolved"` | Overall status |
| `seller_type` | `"Seller"` \| `"Individual"` \| `"Unknown"` | Type of seller |
| `trust_level` | `"verified"` \| `"trusted"` \| `"suspicious"` \| `"blacklisted"` \| `"resolved"` | Trust classification |
| `tcg_type` | string | e.g. `"Pokemon"` |
| `products` | string[] | e.g. `["Singles", "Booster Packs", "Mystery Boxes"]` |
| `instagram.handle` | string | Instagram handle including @ |
| `instagram.url` | string \| null | Full Instagram URL or null if deactivated |
| `id_verified` | boolean | Whether identity has been verified by community admins |
| `severity` | `"critical"` \| `"caution"` \| `"reported"` \| `"resolved"` | Only for scammers |
| `reason` | string | Only for scammers — description of reported behavior |
| `tags` | string[] | Arbitrary tags for filtering/display |

---

## How Data Is Loaded — `js/app.js`

Always load data from the JSON file using `fetch`. Never inline data in JS.

```js
async function loadData() {
  const res = await fetch('./data/sellers.json');
  const json = await res.json();
  return json.entries; // array of all entries
}
```

On page load, call `loadData()` and store the result in a module-level variable. All filtering and rendering reads from this variable.

```js
let ALL_ENTRIES = [];

document.addEventListener('DOMContentLoaded', async () => {
  ALL_ENTRIES = await loadData();
  updateStats();
});
```

---

## Filtering Logic

Entries are filtered by two independent axes:

1. **Category tab** — `all`, `sellers` (status=genuine, seller_type=Seller), `individuals` (status=genuine, seller_type=Individual), `rocket` (status=scammer/reported/resolved)
2. **Search query** — matches `name` or `instagram.handle` case-insensitively

```js
function getFiltered(entries, activeFilter, query) {
  const q = query.toLowerCase().replace('@', '');
  
  return entries.filter(e => {
    // category match
    const catMatch =
      activeFilter === 'all' ||
      (activeFilter === 'sellers'     && e.status === 'genuine' && e.seller_type === 'Seller') ||
      (activeFilter === 'individuals' && e.status === 'genuine' && e.seller_type === 'Individual') ||
      (activeFilter === 'rocket'      && ['scammer','reported','resolved'].includes(e.status));

    // search match
    const searchMatch = !q ||
      e.name.toLowerCase().includes(q) ||
      e.instagram.handle.toLowerCase().replace('@','').includes(q);

    return catMatch && searchMatch;
  });
}
```

---

## Rendering — Tile List

Tiles are rendered into `#tileGrid`. Group results by section before rendering:

```js
function renderTiles(filtered) {
  const sellers  = filtered.filter(e => e.status === 'genuine' && e.seller_type === 'Seller');
  const indivs   = filtered.filter(e => e.status === 'genuine' && e.seller_type === 'Individual');
  const scammers = filtered.filter(e => ['scammer','reported','resolved'].includes(e.status));

  let html = '';
  if (sellers.length)  html += sectionHTML('✓ GENUINE SELLERS',     'trusted', sellers,  false);
  if (indivs.length)   html += sectionHTML('◈ GENUINE INDIVIDUALS',  'indiv',   indivs,   false);
  if (scammers.length) html += sectionHTML('☠ TEAM ROCKET',          'rocket',  scammers, true);

  document.getElementById('tileGrid').innerHTML = html || emptyStateHTML();
}
```

Each tile is clickable and calls `showDetail(entry.id)` on click.

---

## Rendering — Detail Panel

The detail panel slides in over the screen when a tile is clicked. It reads the entry by ID from `ALL_ENTRIES`.

```js
function showDetail(id) {
  const entry = ALL_ENTRIES.find(e => e.id === id);
  const panel = document.getElementById('detailPanel');

  document.getElementById('detailContent').innerHTML = buildDetailHTML(entry);
  panel.className = `detail-panel ${getPanelClass(entry)}`;
  requestAnimationFrame(() => panel.classList.add('open'));
}

function closeDetail() {
  document.getElementById('detailPanel').classList.remove('open');
}
```

Back button always calls `closeDetail()`.

---

## Get Verified Button

Located in the bottom center of the Pokédex controller (replacing the stats text area). Clicking it opens a Google Form or mailto link — update the URL in `index.html`.

```html
<div class="mid-info">
  <button class="verify-btn" onclick="window.open('YOUR_FORM_URL_HERE', '_blank')">
    GET VERIFIED
  </button>
</div>
```

Style it to match the Pokédex hardware — dark red background, pixel font, subtle glow on hover. It should look like a physical button on the device, not a web CTA.

---

## Visual Design Rules

These must be preserved in any edits:

- **Shell color**: `linear-gradient(170deg, #ff3c3c, #cc0000, #990000)` with border `#660000 / #330000`
- **Screen bg**: `#0b0f0b` with `inset` shadow and green `#9bbc0f` as the primary screen accent
- **Fonts**: `Press Start 2P` for all labels/UI chrome, `Outfit` for readable body text in tiles/detail
- **Tile accents**:
  - Verified Sellers → `#00C853`
  - Individuals → `#40C4FF`
  - Critical scammer → `#FF1744`
  - Caution → `#FFD600`
  - Reported → `#FF6D00`
  - Resolved → `#448AFF`
- **Background**: Dark `#0a0a0f` with floating emoji symbols drifting upward + scanline overlay
- **Powered by**: `@magikart.in` shown below the device shell, subtle opacity, links to Instagram

---

## Adding / Editing Sellers

To add a new entry, edit `data/sellers.json` only. Add a new object to the `entries` array following the data format above. The UI will pick it up automatically on next page load.

To add a new scammer:
- Set `status` to `"scammer"`, `"reported"`, or `"resolved"`
- Always include a `reason` field
- Set `severity` to one of: `critical`, `caution`, `reported`, `resolved`
- Set `id_verified: false`

---

## Deployment

This is a fully static site. Deploy anywhere that serves static files:

- **GitHub Pages**: push repo, enable Pages on `main` branch
- **Netlify**: drag and drop the folder into netlify.com/drop
- **Vercel**: `vercel --prod` from the project root

No build step, no npm install, no config needed.

> Note: `fetch('./data/sellers.json')` requires an HTTP server — it won't work from `file://` directly. Use `npx serve .` or VS Code Live Server for local development.

---

## Local Development

```bash
# Option 1 — Node
npx serve .

# Option 2 — Python
python3 -m http.server 8080

# Then open: http://localhost:8080
```

---

## Future Features (ideas)

- **Submit a report** — Google Form link in the detail panel for scammer entries
- **Product filter** — filter by Singles / Booster Packs / Mystery Boxes
- **Last seen / date added** — add `date_added` field to JSON, show in detail view
- **Share entry** — copy a direct link like `index.html?id=gen_041` that auto-opens the detail panel
- **Admin JSON editor** — a separate `admin.html` that lets you edit `sellers.json` visually and download the updated file