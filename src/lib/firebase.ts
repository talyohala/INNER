import * as admin from 'firebase-admin';

// אנחנו נשמור את מפתח ההצפנה של Firebase כמשתנה סביבה ב-Render
const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT;

if (serviceAccountKey) {
  try {
    const serviceAccount = JSON.parse(serviceAccountKey);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('🔥 Firebase Admin initialized successfully');
  } catch (error) {
    console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:', error);
  }
} else {
  console.warn('⚠️ Firebase Admin is not initialized. Missing FIREBASE_SERVICE_ACCOUNT in env variables.');
}

// פונקציית הקסם שיורה את הפוש לטלפון של המשתמש
export const sendPushNotification = async (token: string, title: string, body: string, data?: any) => {
  if (!serviceAccountKey) return;
  
  try {
    const response = await admin.messaging().send({
      token,
      notification: {
        title,
        body,
      },
      data: data || {},
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'inner_alerts' // לעתיד אם נרצה ערוץ התראות מיוחד באנדרואיד
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            contentAvailable: true,
          }
        }
      }
    });
    console.log('✅ Push sent successfully:', response);
  } catch (error) {
    console.error('❌ Error sending push notification:', error);
  }
};
