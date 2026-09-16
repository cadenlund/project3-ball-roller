/**
 * Shared color palette: a bright, saturated "retro sunset" mood - warm
 * terracotta base instead of near-black, brown-orange track, gold-yellow
 * pickups, red-orange hazards, cyan as the one cool accent - with neon glow
 * on the things worth noticing. One module so every screen and the 3D scene
 * read from the same values.
 */
export const COLORS = {
  // structure - warm and mid-bright rather than near-black, so the glow
  // colors below still have a dark enough backdrop to read as "neon."
  void: '#4a2011', // app/scene background - warm terracotta
  surface: '#7a3818', // card / panel backgrounds
  surfaceAlt: '#9a4a1f', // chip / switch-off backgrounds
  border: '#c76a2b',

  // text
  text: '#fffaf0',
  textDim: '#ffe0b8',
  textMuted: '#f4b980',
  textFaint: '#d99a5e',

  // gold - pickups, stars, primary highlights
  gold: '#ffcc00',
  goldBright: '#fff275',
  amber: '#ff9f1c',

  // cyan - the one cool accent: links, the finish line, active controls
  cyan: '#00e5ff',
  cyanBright: '#8ff5ff',
  cyanDeep: '#0093a8',

  // red-orange - hazards, falls, destructive actions
  ember: '#ff5a1f',
  emberDeep: '#d8420a',
  danger: '#ff3b30',

  // brown-orange - the track itself
  brown: '#b3541f',
  brownDeep: '#7a3818',
};
