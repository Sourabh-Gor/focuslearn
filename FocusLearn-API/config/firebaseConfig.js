// firebaseConfig.js
import firebase from 'firebase-admin';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { resolve } from 'path';

dotenv.config();

// Load the service account JSON file
const serviceAccountPath = resolve(`./${process.env.FIREBASE_STORAGE_BUCKET_FILE_NAME}.json`);
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

// Initialize Firebase Admin SDK
firebase.initializeApp({
  credential: firebase.credential.cert(serviceAccount),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET
});

const bucket = firebase.storage().bucket();

export { bucket };