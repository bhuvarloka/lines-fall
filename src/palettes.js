// Curated pool of beautiful 3-color flat palettes. Each one is its own little
// print, referenced from posters, woodblock prints, and modern flat illustration.
//
// Palettes are NOT pinned to specific time-of-day / weather slots. Instead each
// palette is tagged with a few moods, and the time + weather conditions pick a
// mood query — then we draw a seeded-random palette from the matching pool.
// This keeps quality high (only good triads make the cut) and variety high
// (a sunny morning today and tomorrow can land on different palettes).

// ---- Vocabulary ---------------------------------------------------------
// Moods are descriptive, overlapping, and unordered. A palette can carry
// many. The picker scores palettes by how many of the query's moods they
// match, picks from the top tier, and seeds the choice by date so the same
// day always shows the same image.
//
//   warm / cool      — temperature bias
//   bright / dark    — overall luminance
//   muted / saturated — chroma bias
//   day / night      — time bias (separate from light/dark; night is its own thing)
//   rainy / stormy   — explicitly bad-weather tones
//   moon             — has a moon-disc instead of a sun
//   noSun            — disc is null (storm, void)
// ----------------------------------------------------------------------

export const POOL = [
  // ---- Bright & saturated day palettes ----
  { name: "posterlad",        moods: ["bright", "saturated", "cool", "day"],
    sky: "#2e52c8", floor: "#ede2ca", disc: "#f0b431" },

  { name: "yosemite",         moods: ["bright", "saturated", "warm", "day"],
    sky: "#ede2c8", floor: "#1f9c5c", disc: "#e84a1c" },

  { name: "ramen bowl",       moods: ["bright", "saturated", "warm", "day"],
    sky: "#2c4ab4", floor: "#ede2ca", disc: "#e84a1c" },

  { name: "field of hope",    moods: ["bright", "saturated", "warm", "day"],
    sky: "#f0d030", floor: "#2c6a3a", disc: "#e64528" },

  { name: "sardine",          moods: ["bright", "saturated", "warm", "day"],
    sky: "#e85a28", floor: "#1f3fa8", disc: "#ede2ca" },

  // ---- Soft & high-key day palettes ----
  { name: "hasui dawn",       moods: ["bright", "muted", "warm", "day"],
    sky: "#dac4d8", floor: "#c89060", disc: "#e07a4c" },

  { name: "alpine sage",      moods: ["bright", "muted", "cool", "day"],
    sky: "#a8c0b8", floor: "#e8d896", disc: "#cf9748" },

  { name: "terracotta print", moods: ["bright", "muted", "warm", "day"],
    sky: "#ede2ca", floor: "#2e52a8", disc: "#b8482c" },

  // ---- Rainy / overcast day palettes ----
  { name: "lily pads",        moods: ["muted", "cool", "day", "rainy"],
    sky: "#5e9c5a", floor: "#1f4a78", disc: "#d04830" },

  { name: "rust slate",       moods: ["dark", "muted", "warm", "rainy"],
    sky: "#a08474", floor: "#3a2c30", disc: "#823828" },

  // ---- Sunset / dusk palettes ----
  { name: "yosemite sunset",  moods: ["saturated", "warm", "day"],
    sky: "#ecd4b0", floor: "#3a2434", disc: "#e84a1c" },

  { name: "fjord blaze",      moods: ["dark", "saturated", "cool", "day"],
    sky: "#1f3fc8", floor: "#0a0e1c", disc: "#f0641c" },

  { name: "indigo coral",     moods: ["dark", "warm", "day"],
    sky: "#1a2c6e", floor: "#3a2434", disc: "#e07a5d" },

  // ---- Night palettes ----
  { name: "pine moon",        moods: ["dark", "muted", "cool", "night", "moon"],
    sky: "#1a2c5e", floor: "#070e1c", disc: "#f0e6c8" },

  { name: "deep cobalt",      moods: ["dark", "saturated", "cool", "night", "moon"],
    sky: "#0a1430", floor: "#1f3fa8", disc: "#ede2c4" },

  { name: "yellow nocturne",  moods: ["dark", "saturated", "warm", "night", "moon"],
    sky: "#1a1c28", floor: "#d0a830", disc: "#e6d8b0" },

  // ---- Storm / no-sun palettes ----
  { name: "graphite",         moods: ["dark", "muted", "cool", "stormy", "noSun"],
    sky: "#1a1c22", floor: "#06070a", disc: null },

  { name: "oxblood",          moods: ["dark", "muted", "warm", "stormy", "noSun"],
    sky: "#5a3838", floor: "#1c1018", disc: null },

  { name: "storm sage",       moods: ["dark", "muted", "cool", "rainy", "stormy", "noSun"],
    sky: "#5a7268", floor: "#2c3a36", disc: null },
];

// ---- Mood query per (time, weather) ----------------------------------
// Soft weights — every condition has fallbacks. The picker matches palettes
// against this query: more matched moods = higher score. "must" excludes;
// "avoid" penalizes.

export const TIMES    = ["sunrise", "morning", "midday", "sunset", "dusk", "night"];
export const WEATHERS = ["clear", "partlyCloudy", "overcast", "rain", "storm"];

const TIME_QUERY = {
  sunrise: { want: ["warm", "bright"],     avoid: ["night"] },
  morning: { want: ["bright", "saturated"],avoid: ["night", "stormy"] },
  midday:  { want: ["bright", "saturated"],avoid: ["night"] },
  sunset:  { want: ["warm", "saturated"],  avoid: ["night"] },
  dusk:    { want: ["dark", "warm"],       avoid: [] },
  night:   { want: ["night"],              avoid: [], must: ["night"] },
};

const WEATHER_QUERY = {
  clear:        { want: ["saturated"],   avoid: ["rainy", "stormy", "noSun"] },
  partlyCloudy: { want: [],              avoid: ["stormy", "noSun"] },
  overcast:     { want: ["muted"],       avoid: ["stormy"] },
  rain:         { want: ["rainy", "muted"], avoid: ["saturated", "stormy"] },
  storm:        { want: ["stormy"],      avoid: [], must: ["noSun"] },
};

// ---- Color utils -----------------------------------------------------

function hexToRgb(hex) {
  const c = hex.replace("#", "");
  return [
    parseInt(c.slice(0, 2), 16),
    parseInt(c.slice(2, 4), 16),
    parseInt(c.slice(4, 6), 16),
  ];
}

export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const lin = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function chroma(hex) {
  const [r, g, b] = hexToRgb(hex);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return (max - min) / 255;
}

export function pickTextColor(bgHex) {
  return luminance(bgHex) > 0.5 ? "#1a1612" : "#f0e6d2";
}

// ---- Role assignment -------------------------------------------------
// Background never imposes: pick the quietest of the three colors as the
// background, the loudest of the rest as the disc accent, the remainder
// as the floor.

export function resolvePalette(p) {
  const colors = [p.sky, p.floor, p.disc].filter(Boolean);

  let background = colors[0], bgScore = Infinity;
  for (const c of colors) {
    const lum = luminance(c);
    const ch = chroma(c);
    const polar = Math.min(lum, 1 - lum); // 0 at extremes, 0.5 at mid-gray
    const score = ch * 2 + polar;
    if (score < bgScore) { bgScore = score; background = c; }
  }

  const remaining = colors.filter((c) => c !== background);
  let disc = null;
  let floor = remaining[0] ?? background;

  if (p.disc != null && remaining.length === 2) {
    const [a, b] = remaining;
    if (chroma(a) >= chroma(b)) { disc = a; floor = b; }
    else                         { disc = b; floor = a; }
  } else if (p.disc == null && remaining.length >= 1) {
    floor = remaining.reduce((a, b) => (chroma(a) >= chroma(b) ? a : b));
  }

  const isMoon = p.moods?.includes("moon");

  return {
    background,
    floor,
    disc,                                  // null when palette has noSun
    text: pickTextColor(background),
    body: isMoon ? "moon" : "sun",
    name: p.name,
    moods: p.moods ?? [],
  };
}

// ---- Selection -------------------------------------------------------

export function timeOfDay(date = new Date()) {
  const h = date.getHours() + date.getMinutes() / 60;
  if (h < 7)  return "sunrise";
  if (h < 11) return "morning";
  if (h < 16) return "midday";
  if (h < 20) return "sunset";
  if (h < 22) return "dusk";
  return "night";
}

// WMO weather codes → our 5 buckets. Open-Meteo compatible.
export function weatherFromCode(code) {
  if (code == null) return "clear";
  if (code <= 1)  return "clear";
  if (code <= 2)  return "partlyCloudy";
  if (code <= 3)  return "overcast";
  if (code <= 67) return "rain";
  return "storm";
}

// Score a palette against a mood query. Higher is better. -Infinity if a
// `must` mood is missing.
function scorePalette(palette, query) {
  if (query.must) {
    for (const m of query.must) {
      if (!palette.moods.includes(m)) return -Infinity;
    }
  }
  let score = 0;
  for (const m of query.want)  if (palette.moods.includes(m)) score += 2;
  for (const m of query.avoid) if (palette.moods.includes(m)) score -= 3;
  return score;
}

// Combine the time-query and weather-query into one (must merges, want/avoid
// concatenate).
function mergeQueries(a, b) {
  return {
    want:  [...(a.want  ?? []), ...(b.want  ?? [])],
    avoid: [...(a.avoid ?? []), ...(b.avoid ?? [])],
    must:  [...(a.must  ?? []), ...(b.must  ?? [])],
  };
}

// Deterministic seeded RNG — same seed = same pick.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Default seed = today's date. Same conditions on the same day = same image.
function dailySeed(date = new Date()) {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

export function pickPalette({ time, weather, seed } = {}) {
  const t = time    ?? timeOfDay();
  const w = weather ?? "clear";
  const query = mergeQueries(TIME_QUERY[t], WEATHER_QUERY[w]);

  const scored = POOL
    .map((p) => ({ p, s: scorePalette(p, query) }))
    .filter((x) => x.s > -Infinity);

  if (scored.length === 0) {
    // No palette satisfies the `must` constraints. Fall back to the whole pool.
    scored.push(...POOL.map((p) => ({ p, s: 0 })));
  }

  // Keep the top tier (within 2 points of the max) so we still get variety.
  const max = Math.max(...scored.map((x) => x.s));
  const top = scored.filter((x) => x.s >= max - 2).map((x) => x.p);

  const rng = mulberry32((seed ?? dailySeed()) + t.charCodeAt(0) * 17 + w.charCodeAt(0) * 31);
  const chosen = top[Math.floor(rng() * top.length)];

  return { ...resolvePalette(chosen), time: t, weather: w };
}
