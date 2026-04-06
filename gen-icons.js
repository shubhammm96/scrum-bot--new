// Quick icon generator — creates simple SVG-based PNG-like icons
// For production, replace with actual PNG icons

const fs = require('fs');
const path = require('path');

// SVG icon content
const svgIcon = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size*0.2}" fill="url(#g)"/>
  <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" style="stop-color:#38bdf8"/>
    <stop offset="100%" style="stop-color:#818cf8"/>
  </linearGradient></defs>
  <text x="50%" y="58%" font-size="${size*0.55}" text-anchor="middle" dominant-baseline="middle" fill="#080c14">⚡</text>
</svg>`;

// Write SVG files as placeholders (rename to .png for real deployment)
fs.writeFileSync(path.join(__dirname, 'public/icons/icon-192.png'), svgIcon(192));
fs.writeFileSync(path.join(__dirname, 'public/icons/icon-512.png'), svgIcon(512));
fs.writeFileSync(path.join(__dirname, 'public/icons/icon.svg'), svgIcon(512));

console.log('Icons generated (SVG format — replace with real PNGs for production)');
