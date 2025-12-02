import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(process.cwd());
const svgPath = path.join(root, 'assets', 'icon.svg');
const outPath = path.join(root, 'assets', 'icon.png');

async function run() {
  try {
    const svg = await fs.readFile(svgPath);
    const image = sharp(svg, { density: 384 }); // high density for crisp PNG
    await image
      .resize(64, 64, { fit: 'cover' })
      .png({ compressionLevel: 9 })
      .toFile(outPath);
    console.log('Icon generated at', outPath);
  } catch (err) {
    console.error('Failed to generate icon:', err);
    process.exit(1);
  }
}

run();
