# Customer review access

Status: implementation prepared; NOT yet activated or verified in production.

The review account uses the same customer UI and Firestore access rules as customers. It is a separate synthetic customer conversation, not an admin or mocked demo. Messages, feedback and booking requests reach the real salon. No real customer profile is copied. Rules are unchanged.

## Activation by an authorized Firebase operator

1. Enable Email/Password in Firebase Authentication for `salon-space-chat`. Keep anonymous authentication enabled.
2. In an authorized environment with Application Default Credentials and `firebase-admin` installed, supply `SALON_REVIEW_EMAIL` (a dedicated review address) and `SALON_REVIEW_PASSWORD` (a unique password of 20+ characters) without saving them in source or shell history. For example use `read -r SALON_REVIEW_EMAIL` and `read -rs SALON_REVIEW_PASSWORD`, then export both variables.
3. Run `node release-preparation/review-access/provision.mjs --create-approved-review-account`. It creates only a new `play-review-*` Auth user and that UID's users/chats documents. It refuses an existing email and does not enable sign-in until both documents exist. Unset both environment variables afterwards. Partial failures require operator inspection; do not repeatedly create accounts.
4. Publish the reviewed branch. On a clean test device, open the app's Review sign-in link, enter the credentials, and confirm customer profile, chat send/read, photo/file upload, feedback and account deletion entry. Verify the admin sees the clearly marked test conversation. Test wrong password, pending/blocked profile rejection, refresh/session restore, and preservation of an existing real customer session. If account deletion is exercised, recreate/retest a new account and update Play credentials before submitting.
5. Enter the working credentials in Play Console. Keep access active during review; no manual approval or OTP should be needed. Do not mark access complete until the actual shipped Android build can reach the login link and access the full customer functionality.

The browser login validates credentials using an isolated in-memory Firebase Auth instance before switching the default session. Existing customer profiles (including anonymous customers) and nonanonymous sessions cannot be replaced by this page. No automatic registration/approval or privilege bypass is added.

## Play Console (only after end-to-end verification)

Name: Customer review access
Username and password: the provisioned credentials (never put them here).
Other instructions (English, under 500 characters):

Open the app on a clean installation. On the first-use screen, tap "Review sign-in" and enter the supplied email and password. The account is already approved; no registration, OTP, or salon approval is required. You can access the customer profile, salon information, chat, attachments, and feedback. Messages reach the salon in a dedicated test conversation. Please use test data only.

## Local validation

`node tests/review-access.test.mjs`
`node --input-type=module --check < customer-review-login.js`
`npm test`

Firebase reference: https://firebase.google.com/docs/auth/web/password-auth
