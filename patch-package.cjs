const fs = require('fs');
const path = require('path');

console.log('🔄 Changing package name to com.inner.app...');

// 1. capacitor.config.ts
if (fs.existsSync('capacitor.config.ts')) {
    let content = fs.readFileSync('capacitor.config.ts', 'utf8');
    content = content.replace(/app\.inner\.mobile/g, 'com.inner.app');
    fs.writeFileSync('capacitor.config.ts', content);
    console.log('✅ Updated capacitor.config.ts');
}

// 2. build.gradle
if (fs.existsSync('android/app/build.gradle')) {
    let content = fs.readFileSync('android/app/build.gradle', 'utf8');
    content = content.replace(/applicationId\s+["']app\.inner\.mobile["']/g, 'applicationId "com.inner.app"');
    fs.writeFileSync('android/app/build.gradle', content);
    console.log('✅ Updated build.gradle');
}

// 3. AndroidManifest.xml
if (fs.existsSync('android/app/src/main/AndroidManifest.xml')) {
    let content = fs.readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
    content = content.replace(/package=["']app\.inner\.mobile["']/g, 'package="com.inner.app"');
    fs.writeFileSync('android/app/src/main/AndroidManifest.xml', content);
    console.log('✅ Updated AndroidManifest.xml');
}

// 4. Move and update MainActivity
const oldDir = 'android/app/src/main/java/app/inner/mobile';
const newDir = 'android/app/src/main/java/com/inner/app';

if (fs.existsSync(oldDir)) {
    fs.mkdirSync(newDir, { recursive: true });
    const files = fs.readdirSync(oldDir);
    for (const file of files) {
        const oldPath = path.join(oldDir, file);
        const newPath = path.join(newDir, file);
        let content = fs.readFileSync(oldPath, 'utf8');
        content = content.replace(/package\s+app\.inner\.mobile/g, 'package com.inner.app');
        fs.writeFileSync(newPath, content);
        fs.unlinkSync(oldPath);
    }
    console.log('✅ Moved and updated MainActivity');
}

console.log('🚀 Package name update complete!');
