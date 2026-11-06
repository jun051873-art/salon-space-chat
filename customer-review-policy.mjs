// Keep a real customer's anonymous identity intact: it cannot be recovered by password.
export function canReplaceSession(user, profileExists) {
  return !user || (user.isAnonymous === true && profileExists === false);
}
export function isReviewCustomer(uid, profile, adminUid) {
  return uid !== adminUid && profile?.role === 'customer' &&
    profile.status === 'active' && profile.reviewAccess === true;
}
