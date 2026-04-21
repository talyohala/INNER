const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');

// קורא בדיוק את התמונה שלך!
const sourceImage = path.join(__dirname, '334455.png');
const resPath = path.join(__dirname, 'android', 'app', 'src', 'main', 'res');

const sizes = {
  'mdpi': 48,
  'hdpi': 72,
  'xhdpi': 96,
  'xxhdpi': 144,
  'xxxhdpi': 192
};

async function forceGenerate() {
  if (!fs.existsSync(sourceImage)) {
    console.error('❌ שגיאה: לא מצאתי את 334455.png בתיקייה. ודא שהקובץ נמצא כאן.');
    return;
  }

  const folders = fs.readdirSync(resPath);
  folders.forEach(folder => {
    if (folder.startsWith('mipmap') || folder.startsWith('drawable')) {
      const fullFolderPath = path.join(resPath, folder);
      const files = fs.readdirSync(fullFolderPath);
      files.forEach(file => {
        if (file.includes('ic_launcher')) {
          fs.unlinkSync(path.join(fullFolderPath, file));
        }
      });
    }
  });

  console.log('🧹 ניקוי הסתיים. מייצר אייקונים חדשים מ-334455.png...');

  const image = await Jimp.read(sourceImage);
  
  for (const [density, size] of Object.entries(sizes)) {
    const folder = path.join(resPath, `mipmap-${density}`);
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });

    const resized = image.clone().resize(size, size);
    await resized.writeAsync(path.join(folder, 'ic_launcher.png'));
    await resized.writeAsync(path.join(folder, 'ic_launcher_round.png'));
    console.log(`✅ נוצר ${density}`);
  }

  console.log('🚀 סיימתי! האייקונים מוכנים.');
}

forceGenerate();
