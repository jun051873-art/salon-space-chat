# N94 — Center customer chat header rail
Previous production: N93, 36a1cbce25000fd9c560d900d0151f265928fe94.

Remove the N91 extra 16px max-width deduction from the customer conversation header. Use full parent width, border-box and symmetric auto margins. Keep equal 90px side grid columns, centered name, and bounded booking action. Store styles and chat content unchanged.

Validation: production CSS cascade at 320x568, 390x844, 430x932, 768x1024, with/without marquee, asserts full width, symmetric margins, border-box and symmetric name columns. Existing weather/home/action checks also pass. git diff --check. No physical mobile rendering verification.
