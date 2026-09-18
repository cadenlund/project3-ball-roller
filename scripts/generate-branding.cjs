// Run with sharp installed: node scripts/generate-branding.cjs
const sharp = require('sharp');
const path = require('path');
const dir = path.join(__dirname, '../assets/branding');
(async () => {
  const mark = await sharp(path.join(dir, 'mark.svg')).png().toBuffer();
  await sharp(mark).flatten({ background: '#171025' }).toFile(path.join(dir, 'icon.png'));
  await sharp(mark).toFile(path.join(dir, 'adaptive-icon.png'));
  await sharp(mark).extract({ left: 240, top: 220, width: 540, height: 560 }).resize(512, 512, { fit: 'contain' }).toFile(path.join(dir, 'splash.png'));
})();
