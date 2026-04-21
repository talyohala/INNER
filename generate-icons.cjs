const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');

// הנתיב המדויק לתמונה במכשיר שלך
const sourceImage = '/storage/emulated/0/Download/334455.png';

const sizes = {
  'mdpi': 48,
  'hdpi': 72,
  'xhdpi': 96,
  'xxhdpi': 144,
  'xxxhdpi': 192
};

async function generate() {
  if (!fs.existsSync(sourceImage)) {
    console.error('❌ שגיאה: התמונה לא נמצאה במכשיר שלך בנתיב:', sourceImage);
    return;
  }

  console.log('קורא את הלוגו ישירות מהמכשיר שלך...');
  
  try {
    const image = await Jimp.read(sourceImage);
    const resPath = path.join(__dirname, 'android', 'app', 'src', 'main', 'res');

    for (const [density, size] of Object.entries(sizes)) {
      const folder = path.join(resPath, `mipmap-${density}`);
      if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
      }

      const resized = image.clone().resize(size, size);
      
      await resized.writeAsync(path.join(folder, 'ic_launcher.png'));
      await resized.writeAsync(path.join(folder, 'ic_launcher_round.png'));
      
      console.log(`✅ נוצר בהצלחה בגודל ${size}x${size} עבור ${density}`);
    }
    console.log('🎉 הכל מוכן! האייקונים הוכנסו לקוד האנדרואיד.');
  } catch (err) {
    console.error('❌ שגיאה בחיתוך התמונה:', err);
  }
}

generate();
