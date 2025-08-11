# Paddle Stack Queue (Rewards) — GitHub Pages Ready

This is a static, local-first prototype. It runs on GitHub Pages with *no backend*.

## Quick Deploy (GitHub UI)

1. Create a new repo (e.g., `paddle-queue`).
2. Upload **all files** from this folder (`index.html`, `style.css`, `app.js`, `.nojekyll`, `README.md`).
3. Go to **Settings → Pages**:
   - **Source:** `Deploy from a branch`
   - **Branch:** `main` (or `master`) • **Folder:** `/ (root)` → **Save**.
4. Wait ~30–60 seconds. Your site will be live at:
   - `https://<your-username>.github.io/<repo-name>/`

> The `.nojekyll` file disables Jekyll processing so our JS/CSS ship unmodified.

## Local Dev (optional)
Serve the folder locally for testing:
```bash
python3 -m http.server 5500
# open http://localhost:5500
```

## Using the App
- Pick or add a venue.
- Submit stacks; see consensus, confidence, and rough wait.
- Press ⭐ for Rewards (points, streak, badges).

## Next Steps
- Connect Supabase for accounts & real-time sync.
- Add redeemable perks + leaderboards.
- Generate QR codes that deep-link to a specific venue (`?venue=<id>`).
