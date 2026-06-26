import admin from 'firebase-admin';
import { prisma } from '../../lib/prisma';

// Initialize Firebase Admin lazily — only once per process
let firebaseApp: admin.app.App | null = null;

function getFirebase(): admin.app.App | null {
  if (!firebaseApp && process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(
        // JSON.parse returns any; firebase-admin cert() accepts object
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON),
      ),
    });
  }
  return firebaseApp;
}

export async function sendPush(
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  const app = getFirebase();
  if (!app || !token) return; // graceful no-op if not configured

  await admin.messaging(app).send({
    token,
    notification: { title, body },
    data,
  });
}

export async function sendWhatsApp(phone: string, message: string): Promise<void> {
  const apiUrl = process.env.WHATSAPP_API_URL;
  const apiKey = process.env.WHATSAPP_API_KEY;
  if (!apiUrl || !apiKey) return; // graceful no-op

  await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ phone, message }),
  });
}

export async function logNotification(
  tenantId: string,
  data: {
    userId: string;
    channel: 'PUSH' | 'WHATSAPP';
    title: string;
    body: string;
    relatedId?: string;
  },
): Promise<void> {
  // relatedId is not a column in NotificationLog — strip it before insert
  const { relatedId: _relatedId, ...rest } = data;
  await prisma.notificationLog.create({
    data: { tenantId, ...rest },
  });
}
