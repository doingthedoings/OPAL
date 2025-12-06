const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// Use the uploaded image source again to be sure
const inputPath = "C:/Users/Admin/.gemini/antigravity/brain/8e6abb7b-a3f2-4184-b971-684bd5685845/uploaded_image_1_1764008502724.png";
const outputPath = path.join(__dirname, 'build', 'installerSidebar.bmp');

console.log(`Converting ${inputPath} to BMP at ${outputPath}...`);

// Sharp doesn't always support BMP write natively depending on libvips.
// If BMP fails, we will try PNG in the 'build' folder which is the standard location.
// But let's try to force a simple format that NSIS likes.
// Actually, let's try PNG first in the correct 'build' folder, as 'public' might not be included in the builder resource path correctly.
const outputPathPng = path.join(__dirname, 'build', 'installerSidebar.png');

sharp(inputPath)
  .resize(164, 314, {
    fit: 'cover',
    position: 'center'
  })
  .png()
  .toFile(outputPathPng)
  .then(() => {
    console.log('Saved as PNG in build folder.');
    // Try to copy to BMP extension just in case builder uses extension to decide, 
    // even if content is PNG (some tools are lenient, but NSIS is strict).
    // Actually, let's just use the PNG in the build folder first.
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
