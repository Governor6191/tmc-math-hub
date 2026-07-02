# Turning on student accounts (free, about 3 minutes)

Accounts let a student sign in with their Google account so their practice
progress, streaks and (later) exam history follow them across devices.
Signing in is optional for students; the anonymous, on-device experience
stays the default. Nothing on the site changes until you finish step 4.

## 1. Create the Firebase project

1. Go to https://console.firebase.google.com and sign in with your Google account.
2. Click **Create a project** (or **Add project**). Name it something like `tmc-math-hub`.
3. When asked about Google Analytics, turn it **off** (not needed). Create the project.
4. Do not add billing. On the free Spark plan the project cannot charge you.

## 2. Enable Google sign-in

1. In the left sidebar open **Build -> Authentication**, click **Get started**.
2. Under **Sign-in method**, choose **Google**, toggle it on, pick your email
   as the support address, and save.
3. Still in Authentication, open **Settings -> Authorized domains** and add:
   `governor6191.github.io`

## 3. Create the database and paste the rules

1. In the sidebar open **Build -> Firestore Database**, click **Create database**.
2. Choose **Production mode** and the default location. Create.
3. Open the **Rules** tab, replace everything with the rules below, and publish:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

These rules mean each signed-in student can only ever read and write their
own data. Nobody, signed in or not, can see anyone else's.

## 4. Connect the site

1. In **Project settings** (the gear icon) scroll to **Your apps**, click the
   web icon (`</>`), give it any nickname, and register. Skip hosting.
2. Firebase shows a `firebaseConfig` object. Copy it.
3. Open [`js/firebase-config.js`](../js/firebase-config.js) in the site repo and
   replace `export const FIREBASE_CONFIG = null;` with your object:
   ```js
   export const FIREBASE_CONFIG = {
     apiKey: '...',
     authDomain: '...',
     projectId: '...',
     storageBucket: '...',
     messagingSenderId: '...',
     appId: '...',
   };
   ```
4. Commit and push. A **Sign in** button appears in the site header, and
   signed-in students start syncing automatically.

## Notes

- Cost: free. Auth with the Google provider is free, and the Firestore free
  quotas (50k reads, 20k writes per day) comfortably cover a class because the
  site syncs in small, batched writes and pulls at most twice an hour per device.
- The web config you paste is a public identifier, safe to commit. The security
  boundary is the rules from step 3.
- Privacy: signed-in students' learning progress (question scores, streak days)
  is stored in your Firebase project, readable only by that student. Students
  who never sign in keep everything on their own device, as always.
- To remove a student's data: Firebase console -> Firestore -> `users` ->
  delete their document; and Authentication -> delete the user.
