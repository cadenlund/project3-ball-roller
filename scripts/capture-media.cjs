const { chromium } = require('playwright');
const sharp = require('sharp');
const { GIFEncoder, quantize, applyPalette } = require('gifenc');
const fs = require('fs');
const out = require('path').join(__dirname, '../docs/media');
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => { errors.push(e.message); console.log('PAGE ERROR', e.message); });
  page.on('console', m => { if(m.type() === 'error') console.log('CONSOLE ERROR', m.text()); });
  await page.addInitScript(() => {
    localStorage.setItem('ballroller.settings.v1', JSON.stringify({ sound: false, haptics: false, tutorialSeen: true, sensitivity: 1, neutralPitch: null }));
    localStorage.setItem('ballroller.progress.v1', JSON.stringify({ 1: {score: 1150, stars: 2, time: 12.5, coins: 0}, 2: {score: 1120, stars: 2, time: 16, coins: 1} }));
  });
  await page.goto('http://127.0.0.1:8088', { waitUntil: 'networkidle' });
  await page.getByTestId('level-1').waitFor();
  await page.screenshot({ path: out + '/menu.png' });
  await page.getByTestId('level-1').click();
  await page.waitForTimeout(3300);
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(1800);
  await page.screenshot({ path: out + '/level-1.png' });
  await page.keyboard.up('ArrowUp');
  await page.getByTestId('exit').click();
  await page.getByTestId('level-3').click();
  await page.waitForTimeout(2800);
  await page.keyboard.down('ArrowUp');
  const frames = [];
  for (let i = 0; i < 64; i++) {
    const start = Date.now();
    const shot = await page.screenshot();
    if (i === 22) fs.writeFileSync(out + '/level-3.png', shot);
    frames.push(shot);
    await page.waitForTimeout(Math.max(0, 100 - (Date.now() - start)));
  }
  console.log('Collected coins:', await page.getByTestId('coin-stat').innerText());
  await page.keyboard.up('ArrowUp');
  const gif = GIFEncoder();
  for (const shot of frames) {
    const { data, info } = await sharp(shot).resize(312).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const palette = quantize(data, 128);
    gif.writeFrame(applyPalette(data, palette), info.width, info.height, { palette, delay: 100 });
  }
  gif.finish(); fs.writeFileSync(out + '/gameplay.gif', gif.bytes());
  console.log(JSON.stringify({ errors, frames: frames.length }));
  await browser.close();
  if (errors.length) process.exitCode = 1;
})();
