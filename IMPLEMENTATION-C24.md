# C24 — portrait profiles and preview interaction
- Peer names explicitly positioned above incoming bubbles; removed chat greeting overlay covering messages.
- Personal cover field, high-resolution square avatars (up to 900px, bounded compression); round crop overlay and touch drag/pinch. Existing low-resolution uploads must be reselected for improved detail.
- Tap inbox/chat avatar for cover/portrait viewer, then tap portrait to enlarge.
- iOS callout/text selection suppressed only on list cards and preview dialog; normal message text remains selectable. Preview does not advance read receipts.
- Admin notification body repeats sender title so iOS app-title display does not hide identity. Physical iOS/watch behavior remains unverified.
- Rules: profileCover added only to existing self-editable profile fields. Firebase console published 2026-10-10 08:23 Asia/Taipei. No account status or role permissions broadened.
- Validation: npm test and Firestore emulator suite passed including profileCover round trip.
- Cloudflare: current live service reports 6-care with keyword and scheduled care support. Console is logged out; cron trigger deployment NOT verified. No real broadcasts or birthday messages sent during tests.
