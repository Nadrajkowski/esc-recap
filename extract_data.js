#!/usr/bin/env node
// Run: node extract_data.js > data.js
// Extracts ESC senior contest data from the dataset folder into the data.js format.
// Fields: year, country, artist, title, place, round, videos, votes, lyrics

const fs = require("fs");
const path = require("path");

const DATASET_DIR = path.join(__dirname, "dataset/data/senior");
const COUNTRIES_FILE = path.join(__dirname, "dataset/data/countries.json");

function extractYoutubeId(url) {
  if (!url) return "";
  const match = url.match(/embed\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : "";
}

function extractLyrics(lyricsDir) {
  // Read all lyric files from the directory
  // Format: o_LANGUAGE.txt for original, t_LANGUAGE.txt for translations
  const files = fs.readdirSync(lyricsDir).filter(f => f.endsWith(".txt"));
  if (!files.length) return null;

  let original = null;
  const translations = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(lyricsDir, file), "utf8");
    const isOriginal = file.startsWith("o_");
    const langMatch = file.replace(/^[ot]_/, "").replace(".txt", "");

    // Determine language label
    const langMap = {
      english: "English",
      albanian: "Albanian",
      arabic: "Arabic",
      armenian: "Armenian",
      azerbaijani: "Azerbaijani",
      catalan: "Catalan",
      croatian: "Croatian",
      czech: "Czech",
      danish: "Danish",
      dutch: "Dutch",
      finnish: "Finnish",
      french: "Français",
      german: "Deutsch",
      greek: "Greek",
      hebrew: "Hebrew",
      indonesian: "Indonesian",
      irish: "Irish",
      italian: "Italiano",
      latin: "Latin",
      latvian: "Latvian",
      lithuanian: "Lithuanian",
      maltese: "Maltese",
      norwegian: "Norwegian",
      polish: "Polski",
      portuguese: "Português",
      romanian: "Romanian",
      romansh: "Romansh",
      russian: "Russian",
      serbian: "Serbian",
      spanish: "Español",
      swedish: "Svenska",
      "swiss german": "Schweizerdeutsch",
      turkish: "Turkish",
      ukrainian: "Ukrainian",
      welsh: "Welsh"
    };

    const label = langMap[langMatch.toLowerCase()] || langMatch;
    const lyricObj = { lang: langMatch, label, text: content };

    if (isOriginal) {
      original = { ...lyricObj, label: `${label} (original)` };
    } else {
      translations.push(lyricObj);
    }
  }

  if (!original && translations.length === 0) return null;

  return {
    original: original || (translations.length > 0 ? translations[0] : null),
    translations: original ? translations : translations.slice(1)
  };
}

const years = fs
  .readdirSync(DATASET_DIR)
  .filter((d) => /^\d{4}$/.test(d))
  .map(Number)
  .sort();

const entries = [];

for (const year of years) {
  const yearDir = path.join(DATASET_DIR, String(year));
  const contestantsDir = path.join(yearDir, "contestants");
  const finalPath = path.join(yearDir, "rounds", "final.json");

  if (!fs.existsSync(contestantsDir) || !fs.existsSync(finalPath)) continue;

  const final = JSON.parse(fs.readFileSync(finalPath, "utf8"));

  // Build place lookup and final scores
  const placeLookup = {};
  const scoresLookup = {};
  for (const perf of final.performances || []) {
    placeLookup[perf.contestantId] = perf.place ?? null;
    if (perf.scores) {
      scoresLookup[perf.contestantId] = perf.scores;
    }
  }

  // Build round lookup
  const roundLookup = {};
  const roundsDir = path.join(yearDir, "rounds");
  const sf1Path = path.join(roundsDir, "semifinal1.json");
  const sf2Path = path.join(roundsDir, "semifinal2.json");
  const sfPath = path.join(roundsDir, "semifinal.json");

  if (fs.existsSync(sf1Path)) {
    for (const perf of (JSON.parse(fs.readFileSync(sf1Path, "utf8")).performances || [])) {
      roundLookup[perf.contestantId] = "sf1";
      // Only store SF scores if not in final (don't overwrite final scores)
      if (perf.scores && !(perf.contestantId in placeLookup)) {
        scoresLookup[perf.contestantId] = perf.scores;
      }
    }
  }
  if (fs.existsSync(sf2Path)) {
    for (const perf of (JSON.parse(fs.readFileSync(sf2Path, "utf8")).performances || [])) {
      roundLookup[perf.contestantId] = "sf2";
      // Only store SF scores if not in final (don't overwrite final scores)
      if (perf.scores && !(perf.contestantId in placeLookup)) {
        scoresLookup[perf.contestantId] = perf.scores;
      }
    }
  }
  if (fs.existsSync(sfPath)) {
    for (const perf of (JSON.parse(fs.readFileSync(sfPath, "utf8")).performances || [])) {
      roundLookup[perf.contestantId] = "sf";
      // Only store SF scores if not in final (don't overwrite final scores)
      if (perf.scores && !(perf.contestantId in placeLookup)) {
        scoresLookup[perf.contestantId] = perf.scores;
      }
    }
  }

  // Read each contestant folder
  const contestantFolders = fs
    .readdirSync(contestantsDir)
    .filter((d) => /^\d+_/.test(d))
    .sort((a, b) => parseInt(a) - parseInt(b));

  for (const folder of contestantFolders) {
    const contestantPath = path.join(contestantsDir, folder, "contestant.json");
    if (!fs.existsSync(contestantPath)) continue;

    const c = JSON.parse(fs.readFileSync(contestantPath, "utf8"));
    const videos = (c.videoUrls || []).map(extractYoutubeId).filter(Boolean);
    const place = placeLookup[c.id] ?? null;
    // round: "final" if they appeared in final, else their semi round, else null (pre-semi era)
    const inFinal = c.id in placeLookup;
    const round = inFinal ? "final" : (roundLookup[c.id] ?? null);

    // Scoring data: store all three breakdowns (total, jury, public)
    const scores = scoresLookup[c.id] || null;

    // Lyrics: read from lyrics directory if available
    const lyricsDir = path.join(contestantsDir, folder, "lyrics");
    let lyricsData = null;
    if (fs.existsSync(lyricsDir)) {
      lyricsData = extractLyrics(lyricsDir);
    }

    entries.push({ year, country: c.country, artist: c.artist, title: c.song, place, round, videos, scores, lyrics: lyricsData });
  }
}

// Output as data.js format
const lines = [];
let currentYear = null;
for (const e of entries) {
  if (e.year !== currentYear) {
    if (currentYear !== null) lines.push("");
    lines.push(`  // ${e.year}`);
    currentYear = e.year;
  }
  const place = e.place === null ? "null" : e.place;
  const round = e.round === null ? "null" : `"${e.round}"`;
  const videos = JSON.stringify(e.videos);
  const scores = e.scores ? JSON.stringify(e.scores) : "null";
  const lyricsStr = e.lyrics ? JSON.stringify(e.lyrics) : "null";
  lines.push(
    `  { year: ${e.year}, country: "${e.country}", artist: ${JSON.stringify(e.artist)}, title: ${JSON.stringify(e.title)}, place: ${place}, round: ${round}, videos: ${videos}, scores: ${scores}, lyrics: ${lyricsStr} },`
  );
}

// Build ESC_COUNTRIES from countries.json + flag emoji derived from ISO code
const countriesRaw = JSON.parse(fs.readFileSync(COUNTRIES_FILE, "utf8"));

function isoToFlag(code) {
  // Regional indicator symbols: A=0x1F1E6, offset from 'A'=65
  return [...code.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

// Only emit countries that actually appear in our data
const usedCountries = new Set(entries.map((e) => e.country));
const countryLines = [];
for (const code of [...usedCountries].sort()) {
  const name = countriesRaw[code] || code;
  const flag = isoToFlag(code);
  countryLines.push(`  ${code}: { name: ${JSON.stringify(name)}, flag: "${flag}" },`);
}

console.log(`// Auto-generated by extract_data.js — do not edit manually.`);
console.log(`// Fields: year, country, artist, title, place, round, videos, scores, lyrics`);
console.log(``);
console.log(`window.ESC_COUNTRIES = {`);
console.log(countryLines.join("\n"));
console.log(`};`);
console.log(``);
console.log(`window.ESC_DATA = [`);
console.log(lines.join("\n"));
console.log(`];`);
