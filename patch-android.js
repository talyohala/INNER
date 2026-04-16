const fs = require('fs');

try {
  // 1. הוספת הרשאת פושים ל-Manifest
  const manifestPath = 'android/app/src/main/AndroidManifest.xml';
  if (fs.existsSync(manifestPath)) {
    let manifest = fs.readFileSync(manifestPath, 'utf8');
    if (!manifest.includes('POST_NOTIFICATIONS')) {
      manifest = manifest.replace('</manifest>', '    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />\n</manifest>');
      fs.writeFileSync(manifestPath, manifest);
      console.log('✅ Added POST_NOTIFICATIONS to Manifest');
    } else {
      console.log('⚡ POST_NOTIFICATIONS already exists');
    }
  }

  // 2. הוספת פיירבייס ל-build.gradle הראשי
  const rootGradlePath = 'android/build.gradle';
  if (fs.existsSync(rootGradlePath)) {
    let rootGradle = fs.readFileSync(rootGradlePath, 'utf8');
    if (!rootGradle.includes('com.google.gms:google-services')) {
      rootGradle = rootGradle.replace(/dependencies\s*\{/, "dependencies {\n        classpath 'com.google.gms:google-services:4.4.0'");
      fs.writeFileSync(rootGradlePath, rootGradle);
      console.log('✅ Added google-services classpath to root build.gradle');
    } else {
      console.log('⚡ google-services classpath already exists');
    }
  }

  // 3. החלת הפלאגין של פיירבייס ב-app/build.gradle
  const appGradlePath = 'android/app/build.gradle';
  if (fs.existsSync(appGradlePath)) {
    let appGradle = fs.readFileSync(appGradlePath, 'utf8');
    if (!appGradle.includes('com.google.gms.google-services')) {
      appGradle += "\napply plugin: 'com.google.gms.google-services'\n";
      fs.writeFileSync(appGradlePath, appGradle);
      console.log('✅ Applied google-services plugin to app build.gradle');
    } else {
      console.log('⚡ google-services plugin already applied');
    }
  }
  
  console.log('🚀 All Android native files patched successfully!');
} catch (e) {
  console.error('❌ Error patching files:', e);
}
