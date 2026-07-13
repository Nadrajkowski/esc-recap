# Project rules (repo-specific)

<!-- Complements the global brief in ~/.config/opencode/AGENTS.md.
     Global rules still apply; this file adds the concrete facts for THIS repo. -->

## Stack
- Language: JavaScript (vanilla, no TypeScript, no build step)
- Package manager: None (no `package.json`)
- Notable frameworks/libraries: None — pure HTML/CSS/JS static site

## Verify loop — exact commands for this repo
No typecheck, lint, or test commands are configured (not configured).
Agents should skip these checks. The app runs as a static site served by:
```bash
python3 -m http.server 8000
```

## Project map
- `index.html` — Main HTML with embedded CSS (~1200 lines)
- `esc-app.js` — Core app logic: grid rendering, search, modal, state management
- `modal-extras.js` — Voting visualization + lyrics side panel (injected into modal)
- `extract_data.js` — Node.js script to generate `data.js` from EurovisionAPI dataset
- `run-server.sh` — Convenience script to start local HTTP server
- `data.js` — Auto-generated dataset (git-ignored)
- `.github/workflows/` — GitHub Actions workflow for data refresh

## Conventions
- No build step — edit files in place; serve with `python3 -m http.server`
- `data.js` is generated via `node extract_data.js > data.js` (requires `dataset/` dir)
- `data.js` and `dataset/` are git-ignored (see `.gitignore`)
- All JS is vanilla — no bundlers, no modules, no frameworks
- CSS uses CSS custom properties (`:root` variables) for theming

## Handoff
Plans live in `PLAN.md` at the repo root (git-ignored). The executor works items in
order and marks each `[x]` only after the verify loop passes.
