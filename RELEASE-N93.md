# N93 — Compact customer home weather
Previous production: N92, 8695baada343108b99117504ec9d29aa043df785.

Customer homepage weather only: full available width with border-box sizing, no flex shrink, smaller current-weather icon (34px) and temperature (22px), compact 64px daily cards with horizontal scrolling confined to their rail. The homepage inbox height cap is removed only while weather is present, so weather/source/error content is not clipped. Other home cards and store layout are unchanged.

Validation: npm test; actual CSS cascade regression at 320x568, 390x844, 430x932 and 768x1024 with/without marquee, including weather width, no shrink, rail bounds and height-cap removal; git diff --check. No physical mobile rendering verification.
