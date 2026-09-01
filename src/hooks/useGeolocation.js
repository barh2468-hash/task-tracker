// Consolidates the location-request-with-confirm-fallback pattern that was
// duplicated at every geolocation-gated call site (startWork, endWork,
// startAttendance, finishAttendance) in the old page.tsx.

function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('הדפדפן לא תומך בשירותי מיקום.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: Number.isFinite(position.coords.accuracy) ? Math.round(position.coords.accuracy) : null,
        }),
      (error) => reject(error),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  });
}

// Returns a GeoLocationPoint on success, null if the user chose to continue
// without location after a failure, or false if they chose to cancel.
export async function getCurrentLocationWithFallback() {
  try {
    return await getCurrentLocation();
  } catch {
    const shouldContinue = window.confirm(
      'לא הצלחתי לקבל מיקום מהמכשיר. ודא ששירותי מיקום פעילים ושהרשאת מיקום מאושרת לדפדפן. האם להמשיך בלי לשמור מיקום?',
    );
    return shouldContinue ? null : false;
  }
}
