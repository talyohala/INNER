import admin from 'firebase-admin';

let initialized = false;

function fixPrivateKey(key?: string) {
  return key?.replace(/\\n/g, '\n');
}

function initFirebase() {
  if (initialized || admin.apps.length > 0) {
    initialized = true;
    return;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = fixPrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Firebase Admin env vars are missing. Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY'
    );
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });

  initialized = true;
}

export async function sendPushNotification(
  token: string,
  title: string,
  body?: string,
  data?: Record<string, any>
) {
  initFirebase();

  const message: admin.messaging.Message = {
    token,
    notification: {
      title,
      body: body ?? '',
    },
    data: Object.fromEntries(
      Object.entries(data ?? {}).map(([key, value]) => [key, String(value)])
    ),
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
        channelId: 'default',
      },
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          badge: 1,
        },
      },
    },
  };

  return admin.messaging().send(message);
}

export default admin;
