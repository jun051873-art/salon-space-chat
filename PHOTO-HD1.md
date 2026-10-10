# Main feature photo quality fix (HD1)

Base: `a80282db9f539f729b5c59e49d0e62d39548975b`.

The main feature uploader previously limited images to 800 pixels on the long edge and 50,000 data-URL characters. The crop editor also capped non-avatar output at 1400 pixels, preventing a larger upload setting from taking effect.

The feature uploader now preserves up to 2400 pixels, permits up to 420,000 data-URL characters, tries lossless PNG when it fits, and uses JPEG quality at least 0.82 otherwise. Detailed images may require fewer pixels to fit the budget. Existing low-resolution images cannot be restored; reselect the original photo after deployment. Small originals are never upscaled. Avatar, cover, chat attachment, and board upload budgets are unchanged.

Feature detail images and board detail images open a full-screen viewer using the stored image directly, with zoom, reset, pinch/pan, keyboard controls, and native dialog close. Customer and admin entry URLs stay the same. Both entry import versions change so the customer viewer and admin feature upload use the new code. No authentication, chat history, Firestore rules, or production content is changed.

## Validation

- JavaScript syntax checks and `git diff --check` passed.
- Actual `compressCanvas` execution against a Canvas implementation: a 1600 × 2400 test poster changed from 533 × 800 (42,995 characters) to 1600 × 2400 (387,251 characters). Decoded dimensions, budget bounds, no upscaling of a 320 × 200 source, quality floor with a dense image, and a representative settings document under 1 MiB passed. These are synthetic tests, not the user's uploaded poster.
- Existing test suite: 12 scripts passed; unchanged `tests/push-presentation.test.cjs` fails on its legacy literal `\\n` notification prefix assertion against the unchanged upstream notification formatter. This is not a photo regression.
- No real iPhone/Android or browser interaction test completed: this environment lacks installed browser executables. `tests/photo-preview.html` is a cloud-free manual fixture for upload/crop and viewer testing. Test on iPhone and Android before production release.

## Rollback and release

Keep this on a draft branch until reviewed. Revert its commit to undo it; the prior saved images and app data are retained. After deployment, reselect the original main feature photo from the admin settings and save it once. No reinstall or clearing login data is needed.
