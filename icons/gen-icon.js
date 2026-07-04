const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const fontData = fs.readFileSync(path.join(__dirname, 'arabic-font.woff2')).toString('base64');

const VARIANTS = [
  { name: 'icon', bg: '#0D3320', label: 'legacy' },
  { name: 'icon-teacher', bg: '#075E54', label: 'teacher' },
  { name: 'icon-student', bg: '#43A047', label: 'student' },
];

function svgFor(bg) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <style>
      @font-face {
        font-family: "ArefRuqaa";
        src: url("data:font/woff2;base64,${fontData}") format("woff2");
      }
    </style>
  </defs>
  <rect width="512" height="512" fill="${bg}"/>
  <text x="119" y="349" font-family="ArefRuqaa, serif" font-size="600" text-anchor="start" fill="#D4A843">&#x648;</text>
</svg>`;
}

async function writePngs(baseName, svg) {
  const dir = __dirname;
  fs.writeFileSync(path.join(dir, baseName + '.svg'), svg);
  await sharp(Buffer.from(svg)).resize(512, 512).png().toFile(path.join(dir, baseName + '-512.png'));
  await sharp(Buffer.from(svg)).resize(192, 192).png().toFile(path.join(dir, baseName + '-192.png'));
}

(async function main() {
  for (const v of VARIANTS) {
    await writePngs(v.name, svgFor(v.bg));
    console.log('Generated', v.label, 'icons →', v.name + '-{192,512}.png');
  }
  console.log('Done.');
})().catch(function (e) {
  console.error('Error:', e.message);
  process.exit(1);
});
