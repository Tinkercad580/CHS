# Notifications: push and email

Everything the platform tells people goes through one service
(`backend/src/modules/notifications/notify.ts`):

- **In-app inbox**: always. Every notification is a row the apps list, with an unread badge.
- **Push**: to the **resident** and **gate** apps only, over Firebase Cloud Messaging.
  The admin console doesn't take push; admins get email.
- **Email**: over SMTP with nodemailer. This covers bills, receipts, notices, and
  reports with Excel/CSV attachments.

Each person picks push and email per category (bills, payments, notices,
approvals, reports…). Emergencies and account-security messages can't be
switched off. Push waits out the society's quiet hours (default 22:00–07:00) unless it's
an emergency. Every delivery is recorded per channel in
`notification_deliveries` (queued → sent / failed / skipped) and retried with
backoff when the failure is transient. A published notice keeps its recipient list and
per-person push, email, read and acknowledged states. That record is the
proof of service (`GET …/notices/:id/report`, or the NOTICE_DELIVERY report).

People without an email on file see a prompt in the apps to add one. Report
emails refuse with `EMAIL_REQUIRED` until they do.

## Firebase setup (push)

You need **one Firebase project** with **two apps registered in it**, one per
mobile app. **Don't register a web app.** Push isn't used on the web, and
Firebase Hosting isn't needed.

### 1. Create the project
Firebase console → *Add project* → name it (e.g. `sahaj-prod`). Analytics is optional.

### 2. Register the Android apps
*Project settings → Your apps → Add app → Android*, once for each:

| App | Android package name | Nickname |
|---|---|---|
| Resident | `in.sahaj.resident` | Sahaj Resident |
| Gate | `in.sahaj.gate` | Sahaj Gate |

Download each **`google-services.json`** and put it in the app's folder:
- `mobile-app/apps/resident-app/google-services.json`
- `mobile-app/apps/gate-app/google-services.json`

The SHA-1 fingerprint is optional for messaging. Skip the console's "Add Firebase SDK"
step: `@react-native-firebase` and the config plugin in each app's
`app.config.ts` already do it.

### 3. Register the Apple apps
*Add app → Apple*, once for each:

| App | Apple bundle ID |
|---|---|
| Resident | `in.sahaj.resident` |
| Gate | `in.sahaj.gate` |

Leave the App Store ID empty until the apps are listed. Download each **`GoogleService-Info.plist`** into the same app folders.
Skip the console's "Add Firebase SDK" and "initialization code" steps; they're
handled already.

Then upload an **APNs authentication key**: Apple Developer → Keys → create a key with
Apple Push Notifications service. In Firebase, go to *Project settings → Cloud Messaging →
Apple app configuration* and upload the `.p8` with its Key ID and Team ID. Without
it, iOS devices get tokens but no pushes.

The package and bundle IDs are set in each `app.config.ts`, and can be
overridden with `CHS_RESIDENT_ANDROID_PACKAGE`, `CHS_RESIDENT_IOS_BUNDLE_ID`,
`CHS_GATE_…`. Choose them before the first store release, because they can't
change afterwards.

### 4. Server credentials
*Project settings → Service accounts → Generate new private key*. Save it as
`secrets/firebase-service-account.json` at the repo root. `secrets/` is
gitignored, and the file holds a private key, so never commit it. Then in `backend/.env`:

```
PUSH_PROVIDER=fcm
FIREBASE_SERVICE_ACCOUNT_FILE=secrets/firebase-service-account.json
```

On a host that can't mount a file, set the three variables instead:
`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` (with `\n` for
newlines). On Google Cloud, application default credentials work too.
`GET /api/v1/health` reports `push: ok` once it's loaded.

### 5. Build the apps
Push needs a native build. Expo Go and the web preview can't receive FCM.

```
cd mobile-app/apps/resident-app
npx expo prebuild            # picks up google-services.json / GoogleService-Info.plist
npx expo run:android         # or: eas build -p android
```

The Firebase plugins switch on only when the config files are present, so
builds without them still work and simply report push as unavailable.

### 6. Check it end to end
Sign in on a phone, allow notifications, then use **Send a test notification** in
the app's notification settings (`POST /api/v1/me/notifications/test`). The
reply says whether push went to a registered phone and whether email went out.

## Email setup (SMTP)

Any SMTP server works. Free options:
- **Gmail / Google Workspace**: turn on 2-step verification, create an *App
  password*, then use `smtp.gmail.com`, port 465, `SMTP_SECURE=true`. Gmail limits sending to
  roughly 500 messages a day, which suits a society or two.
- **Brevo**, **Zoho Mail**, or the society's own domain mail, for larger volumes.

```
MAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=office@yoursociety.in
SMTP_PASS=<app password>
MAIL_FROM=Shanti Vihar CHS <office@yoursociety.in>
PUBLIC_WEB_URL=https://admin.yoursociety.in
```

With the default `MAIL_PROVIDER=log`, emails are rendered and logged, not sent, so
a development machine never mails real residents. `PUSH_PROVIDER=log` does the same for push.

## Scheduled reports

- **Daily, 20:00 IST**: the collection summary for the day, as Excel. It goes to everyone
  holding `payments.record` or `accounts.manage` who has an email and hasn't
  turned report emails off. It's skipped on days with no collections.
- **Monday, 08:00 IST**: a digest of defaulters plus the previous week's collections, sent to
  administrators with `society.configure`, `billing.publish` or `recovery.notice`.
- **On demand**: any report can be emailed to yourself from the admin console
  (`POST …/reports/:type/email`).

The report types are collections, defaulters, bill register, receipt register, member
ledger, occupancy, tenant register, and notice delivery (proof of service).
