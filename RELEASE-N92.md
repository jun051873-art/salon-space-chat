# N92 — Pull to refresh on data viewing pages
Previous version N91: 99fffab71afefdf74ec0bfd1a225b148a98058d9.

Customer: home, about, products, featured detail, holidays. Server reads bypass cached settings/catalog data and refresh customer header identity. Announcement cards are refreshed through home settings; open modal details are excluded.
Store: home, messages list, customer analysis, customer database, pending approvals, customer feedback. Existing manual customer refresh shares the in-flight guard.

At top, pull downward approximately 116 CSS pixels to arm the refresh. Show rotating arrow, release-to-refresh, loading, success/error and slow-network feedback. No document reload, writes or automatic sends. Exclude dialogs, focused editable fields, editing/settings/booking/chat routes, horizontal and multi-touch gestures. Avoid navigation on refresh and guard return against route changes. Read costs occur only on an intentional pull. Store customers and messages retain their existing bounded query/pagination mechanisms.

Validation: full npm test suite, pull gesture unit fixtures (threshold, duplicate suppression, nested scroll, form, dialog, cancellation and horizontal swipe); production stylesheet cascade checks; inline JavaScript syntax. Attached recording inspected. No physical iOS/Android touch verification or real customer message writes.
