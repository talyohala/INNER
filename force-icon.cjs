const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');

const sourceImage = path.join(__dirname, 'my-logo.png');
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
    console.error('❌ שגיאה: לא מצאתי את my-logo.png');
    return;
  }

  // 1. ניקוי יסודי - מוחק כל קובץ XML של אייקון שעלול להפריע
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

  console.log('🧹 ניקוי הסתיים. מייצר אייקונים חדשים...');

  // 2. יצירת ה-PNG החדשים
  const image = await Jimp.read(sourceImage);
  
  for (const [density, size] of Object.entries(sizes)) {
    const folder = path.join(resPath, `mipmap-${density}`);
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });

    const resized = image.clone().resize(size, size);
    await resized.writeAsync(path.join(folder, 'ic_launcher.png'));
    await resized.writeAsync(path.join(folder, 'ic_launcher_round.png'));
    console.log(`✅ נוצר ${density}`);
  }

  console.log('🚀 סיימתי! אין יותר קבצי XML ישנים שיפריעו.');
}

forceGenerate();
