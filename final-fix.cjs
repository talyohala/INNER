const fs = require('fs');

try {
  // 1. תיקון ה-AndroidManifest.xml - לוודא שה-activity name תואם
  const manifestPath = 'android/app/src/main/AndroidManifest.xml';
  if (fs.existsSync(manifestPath)) {
    let content = fs.readFileSync(manifestPath, 'utf8');
    
    // מוודא שהפעילות הראשית רשומה כ-.MainActivity ושהחבילה היא com.inner.app
    content = content.replace(/android:name="\.MainActivity"/g, 'android:name="com.inner.app.MainActivity"');
    
    fs.writeFileSync(manifestPath, content);
    console.log('✅ Updated AndroidManifest activity reference');
  }

  // 2. בדיקה סופית של MainActivity.java
  const javaPath = 'android/app/src/main/java/com/inner/app/MainActivity.java';
  if (fs.existsSync(javaPath)) {
    let content = fs.readFileSync(javaPath, 'utf8');
    if (!content.includes('package com.inner.app;')) {
        content = content.replace(/package\s+[\w.]+;/, 'package com.inner.app;');
        fs.writeFileSync(javaPath, content);
        console.log('✅ Fixed package declaration in MainActivity.java');
    }
  }

  console.log('🚀 Final cleanup complete!');
} catch (e) {
  console.error('❌ Error:', e);
}
