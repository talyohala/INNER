const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');

// מחפש את התמונה שלך בכל המקומות האפשריים
const possiblePaths = [
  '/storage/emulated/0/Download/334455.png',
  '/storage/emulated/0/Downloads/334455.png',
  path.join(__dirname, '334455.png')
];

let sourceImage = null;
for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    sourceImage = p;
    break;
  }
}

async function fixIcons() {
  if (!sourceImage) {
    console.error('❌ שגיאה: התמונה 334455.png לא נמצאה באף נתיב!');
    return;
  }
  console.log('✅ התמונה נמצאה בנתיב:', sourceImage);

  const resPath = path.join(__dirname, 'android', 'app', 'src', 'main', 'res');
  const image = await Jimp.read(sourceImage);

  // גדלים לאייקון רגיל
  const sizes = { 'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192 };
  // גדלים לאייקון מסתגל (חייב להיות גדול יותר כדי שהטלפון יחתוך אותו)
  const adaptiveSizes = { 'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432 };

  for (const density of Object.keys(sizes)) {
    const folder = path.join(resPath, `mipmap-${density}`);
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });

    // 1. דריסת אייקונים רגילים
    const regularImg = image.clone().resize(sizes[density], sizes[density]);
    await regularImg.writeAsync(path.join(folder, 'ic_launcher.png'));
    await regularImg.writeAsync(path.join(folder, 'ic_launcher_round.png'));

    // 2. דריסת אייקונים מסתגלים (השורש של הבעיה שלנו!)
    const adaptiveImg = image.clone().resize(adaptiveSizes[density], adaptiveSizes[density]);
    await adaptiveImg.writeAsync(path.join(folder, 'ic_launcher_foreground.png'));

    console.log(`✅ תוקנה תיקיית ${density}`);
  }
  
  console.log('🚀 הבעיה נפתרה מהשורש! כל האייקונים באנדרואיד הוחלפו.');
}

fixIcons();
