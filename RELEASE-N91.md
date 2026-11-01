# N91 — Customer chat layout and recovery

Previous production: N90, a23c6b43c3e10361ec0a0f7f1ef97826514a1bda.
Original pre-redesign rollback remains N88-R1 (see RELEASE-N89.md).

- Customer chat uses equal 90px side columns, bounded border-box booking button, ellipsis for long names and restored pointer interaction on the former placeholder.
- Customer profile prepares its return page behind the dialog before closing. Repeated close is guarded, failure allows retry, and preparation has a 12-second deadline. Customer section entrance animations are disabled to avoid return flashes. Store profile close behavior remains unchanged.
- Startup explains waiting/network checks and swiping the app away then reopening. Existing startup retry remains available even if module loading fails.
- Page loads exceeding 12 seconds show a dismissible recovery notice; no automatic reload, deletion, or resend. Manual reload warns about unsent input. Older navigation completions cannot reset scroll or dismiss the current cover/recovery notice.

Validation: npm test (45 commands including syntax), npm run test:readiness; Python stylesheet cascade at 320x568, 390x844, 430x932, 768x1024, with/without marquee; inline module and profile module syntax; git diff --check.
Mock delivery load: 100/200/300/400 recipients, up to 1200 unique writes, offline/reopen/lost response retries and storage quota rollback. Mock automatic replies: 200/300 concurrent, duplicate suppression. No real customer messages or notifications sent.

Limitations: stylesheet cascade checks are not real iOS rendering tests; no authenticated real customer account or mobile device was used. Timeout UI covers unresolved asynchronous loads, not a completely frozen JavaScript thread. Live-device messaging latency is not measured by mock tests.
