import type { GeoLocationPoint } from "@/src/types";

export function getCurrentLocation(): Promise<GeoLocationPoint> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("הדפדפן לא תומך בשירותי מיקום."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: Number.isFinite(position.coords.accuracy)
            ? Math.round(position.coords.accuracy)
            : null,
        }),
      (error) => reject(error),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  });
}

export async function getCurrentLocationWithFallback(): Promise<GeoLocationPoint | null | false> {
  try {
    return await getCurrentLocation();
  } catch {
    const shouldContinue = window.confirm(
      "לא הצלחתי לקבל מיקום מהמכשיר. ודא ששירותי מיקום פעילים ושהרשאת מיקום מאושרת לדפדפן. האם להמשיך בלי לשמור מיקום?",
    );
    return shouldContinue ? null : false;
  }
}

export function mapsLink(lat: number | null | undefined, lng: number | null | undefined) {
  if (typeof lat !== "number" || typeof lng !== "number") return "";
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export function formatLocation(location: GeoLocationPoint) {
  const accuracy =
    typeof location.accuracy === "number" ? ` · דיוק כ-${location.accuracy} מ׳` : "";
  return `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}${accuracy}`;
}
