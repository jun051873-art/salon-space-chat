# N22: broadcast draft and queue storage acceptance

Scenario: 200–400 registered customers, 10–30 ordinary active visitors; 1–2 broadcasts/month, two photographs plus one text per recipient.

Offline mock tests pass for 100/200/300/400 recipients (300/600/900/1200 messages). Tests include a persisted legacy two-photo draft (650023 characters/photo), 5 MiB local storage budget, offline queue, reload, lost response and retry, no duplicate message writes, and all-or-nothing queue rollback when quota is exhausted. Peak test storage: 3.72 MiB, including temporary legacy migration. No real customer messages or push notifications were sent. Full npm test and npm run test:readiness pass.

Fix: draft images and outgoing messages now share durable local assets; migration preserves drafts and only collects assets unreferenced by both drafts and queues. Retry failed broadcast button now acts on its first click. Entry points use N22/C22 versioned imports.

Limits: mocked throughput is not real Firestore/Cloudflare latency or a guarantee of phone push delivery. Physical iPhone/Android background/lock-screen delivery and device-specific scrolling remain unverified in this environment. Existing responsive rails/gesture fixes were not replaced by this change.

Capacity issue: cloud files currently copy the photo into each recipient's file document. At 650023 characters/photo, two photos to 400 recipients add approximately 520 MB of photo string data per campaign, excluding indexes and metadata. Two campaigns add approximately 1.04 GB; inspect actual Firebase storage/plan before sustained usage. Cloud shared-media storage would require a separately verified data/rules migration. No existing files were deleted.

Cloudflare v8 deployment still requires separate verification; this frontend release does not deploy it.

Rollback: restore chat-delivery.js, salon-suite.js, admin.html and customer.html from eed3c9dd78a73485a39ac76f0fb8b389d706db15. Do not clear browser storage; new draft metadata must be hydrated back to inline data before rolling back the draft reader, or keep the N22 reader for existing drafts.
