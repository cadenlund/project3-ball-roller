import { LEVELS, DEFAULT_THEME, buildLevel } from '../src/game/levels';
const luminance = (hex) => {
  const values = hex.slice(1).match(/../g).map(v => parseInt(v, 16)/255).map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4);
  return values[0]*.2126 + values[1]*.7152 + values[2]*.0722;
};
test('every palette has a distinct background and strongly visible edge', () => {
  expect(new Set(LEVELS.map(l => l.theme.background)).size).toBe(LEVELS.length);
  for (const { theme } of LEVELS) {
    for (const key of Object.keys(DEFAULT_THEME)) expect(theme[key]).toMatch(/^#[0-9a-f]{6}$/i);
    for (const color of [theme.background, theme.track]) {
      expect((luminance(theme.edge)+.05)/(luminance(color)+.05)).toBeGreaterThan(3);
    }
  }
});
test('future levels get defaults and may override a single color', () => {
  const level = buildLevel({ id: 99, run: [{ length: 10, width: 5 }], theme: { accent: '#abcdef' } });
  expect(level.theme.background).toBe(DEFAULT_THEME.background);
  expect(level.theme.accent).toBe('#abcdef');
});
