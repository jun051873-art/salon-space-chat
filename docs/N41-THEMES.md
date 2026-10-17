# N41 themes and short seasonal scenes

## Ready for web release
- 12 preset recipes: palette, layout, spacing, radius, glass, typography and navigation colors. Selecting previews; Publish saves through existing settings path.
- 28 selectable ambient scenes, including weather and holidays; direction selection; default 12 seconds, bounded to 5–20 seconds; no pointer interception. Leaving chat, hiding document, or replacing a scene cancels the active layer. Stale asynchronous weather results cannot reopen a departed scene.
- Optional live city weather: defaults to Yingge; eight city choices; no geolocation. MET Norway forecast is labelled estimated. Up to one fetch/hour/device/city, concurrent request coalescing, 6-second timeout, 5-minute failure backoff. Yesterday comparisons require a saved estimate from the same city/hour on the preceding Taiwan date; no fabricated historical data.
- Solar terms: HKO official dates for 2025–2030, Taiwan UTC+8 calendar-day rollover. Outside this range displays update-needed rather than inventing dates. Solar symbolism is explicitly separate from local weather.

## Prepared but withheld from production until rules deployment
- Profile: 28 self-selected scenes, daily weather and solar-term mode, city/direction preferences, 12-second playback.
- Firestore profile allowlist expanded only for approved effects and enumerated city/direction values. No widening of user ownership, approval/status, messages, private notes or other collections. No production data migration.
- Full implementation retained on branch `n41-profile-seasonal-ready`. Main keeps existing profile editor/validator until Firebase rule release is available.
- Firebase CLI has no signed-in user. Browser observation returned “native credential state cannot be safely resumed.” No credential workaround attempted. Publishing rules requires restored authorized Firebase access.

## Verification
- Full npm test suite passed, including 12 distinct layouts, 28 scene choices, solar date rollover, year boundary, weather condition selection, cache/coalescing, offline fallback and layer disposal.
- Firestore emulator tests passed: ownership/private-data checks, customer profile weather/solar saves, blocked-user rejection, and existing message/photo atomicity rules.
- Live MET Norway response and CORS headers verified from site Origin. Real iPhone visual QA remains pending because browser session was unavailable. This release does not establish full notification/media/broadcast acceptance.

## Sources and licensing
- Weather: https://api.met.no/ ; CC BY 4.0 https://creativecommons.org/licenses/by/4.0/ . Forecast is transformed into a simplified decorative scene. Provider permits low-volume simple browser requests with Origin identification; move to a caching server proxy before high-volume rollout: https://api.met.no/doc/TermsOfService . API: https://api.met.no/doc/locationforecast/HowTO . No paid API subscription created.
- Solar calendar dates: https://www.hko.gov.hk/tc/gts/time/calendar/text/files/T2026c.txt and same annual table for 2025, 2027–2030. Calendar facts bundled; not entire source text.
