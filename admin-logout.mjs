// Only clear routing hints after Firebase confirms sign-out. Never clear customer storage.
export async function performAdminLogout({stopNotifications, signOut, storage, navigate}) {
  await stopNotifications();
  await signOut();
  try {
    storage.removeItem('salonAdminLoggedIn');
    storage.setItem('salonMode', 'customer');
  } catch {} // Explicit customer URL remains usable if storage is unavailable.
  navigate();
}
