# ESC Recap


![Desktop version of the app](image-1.png)

![Mobile version of the app](image.png)

![Search feature](image-2.png)

![Watch videos modal](image-3.png)

An interactive grid explorer of Eurovision Song Contest performances from 1956 to 2024.

## What it does

Browse the complete history of Eurovision entries organized as an interactive grid. Switch between two views:
- **Placement view**: See songs ranked by their final placement for each year
- **Alphabetical view**: Browse countries alphabetically

Each entry shows full voting breakdowns, song lyrics with translations, and video performance links.

## Features

- **Search**: Find songs, artists, countries, or years instantly (press `/` to focus)
- **Watch videos**: Click any entry to watch the performance on YouTube
- **Navigation**: Jump between entries by country across years or by placement within a year
- **Voting data**: View jury and public voting breakdowns for each entry (2004+)
- **Lyrics with translations**: Read song lyrics in the original language and multiple translations
- **Viewing history**: Track which entries you've watched with visual markers
- **Statistics**: See entries shown, countries represented, and how many you've viewed
- **Responsive design**: Works seamlessly on desktop and mobile

## How to use

- **Click any cell** to open the entry modal
- **Search** for a song, artist, country, or year
- **Random button** (🎲) opens a random entry
- **Sort buttons** switch between placement and alphabetical views
- **Viewed indicator** shows entries you've already watched (blue border)
- **Navigation buttons** in the modal jump to related entries:
  - Previous/next placement in the same year
  - Previous/next year for the same country
- **Voting section**: Toggle between Received/Given views and Total/Jury/Public breakdowns
- **Lyrics panel**: Click "Read lyrics" to view full song text with translation options
- **Esc key** closes the modal

## Data

All performance data sourced from [EurovisionAPI/dataset](https://github.com/EurovisionAPI/dataset).

Includes:
- 1795+ entries from 1956–2024
- Full voting data (jury and public) for 2004–2025
- Original lyrics and translations (where available)
- Video links for each performance

## Local development

The app is a static site — no build step required.

**Run locally:**

```bash
python3 -m http.server 8888
# then open http://localhost:8888
```

**Regenerate data.js:**

```bash
git clone --depth 1 https://github.com/EurovisionAPI/dataset.git dataset
node extract_data.js > data.js
rm -rf dataset
```

**Test the GitHub Actions workflow locally** (requires [act](https://nektosact.com/)):

```bash
act -n -W .github/workflows/refresh-data.yml workflow_dispatch
```

## Changelog

### v1.0.1 (May 2026)

**Added**
- Voting statistics: Jury vs public voting breakdowns for each entry
- Lyrics display: Full song lyrics in original language and multiple translations
- Random entry button in modal view for serendipitous discovery
- "Given" voting view: See what votes a country gave to other entries

**Improved**
- Navigation redesigned with descriptive labels and wider buttons
- Modal layout optimized for both desktop and mobile

**Fixed**
- Navigation text centering and ellipsis handling

### v1.0.0 (May 2023)
**Initial release**
- Interactive grid explorer with 1795+ Eurovision entries
- Placement and alphabetical sorting views
- Search functionality with instant filtering
- Video playback via YouTube embeds
- Viewing history with localStorage persistence
- Mobile-responsive design
