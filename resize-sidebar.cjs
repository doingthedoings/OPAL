const sharp = require('sharp');
const path = require('path');

const inputPath = path.join(__dirname, 'public', 'installerSidebar.png');
const outputPath = path.join(__dirname, 'build', 'installerSidebar.bmp'); // NSIS prefers BMP, but Builder supports PNG. Let's try PNG first or BMP if needed. 
// Actually electron-builder docs say: "The path to the installer sidebar image, e.g. build/installerSidebar.bmp or build/installerSidebar.png"
// But standard NSIS often behaves better with BMP. Sharp doesn't support BMP output natively without libvips compiled with *magick or similar? 
// Let's stick to PNG.

const outputPathPng = path.join(__dirname, 'public', 'installerSidebar.png');

console.log(`Resizing ${inputPath}...`);

sharp(inputPath)
  .resize(164, 314, {
    fit: 'cover',
    position: 'center'
  })
  .toBuffer()
  .then(data => {
    require('fs').writeFileSync(outputPathPng, data);
    console.log('Sidebar image resized successfully.');
  })
  .catch(err => {
    console.error('Error resizing image:', err);
    process.exit(1);
  });
