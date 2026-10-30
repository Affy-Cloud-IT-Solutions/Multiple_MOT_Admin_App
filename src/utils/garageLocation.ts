import { Linking, PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

// Same key the customer app uses for reverse geocoding
const GOOGLE_MAPS_API_KEY = 'AIzaSyCCiW08B0GTFjP1uj4LZ3QnqKzUVSuYcH0';

export interface DetectedGarageLocation {
  latitude: number;
  longitude: number;
  /** Street line, e.g. "12 High Street" */
  address: string;
  city: string;
  postcode: string;
}

/**
 * permission - the user said no (we can ask again)
 * blocked    - "Don't ask again" / denied in Settings (only the Settings app can change it)
 * disabled   - the phone's location services are turned off
 * timeout    - no GPS fix in time
 */
export type LocationErrorCode = 'permission' | 'blocked' | 'disabled' | 'timeout';

export class LocationError extends Error {
  constructor(message: string, public code: LocationErrorCode) {
    super(message);
  }
}

async function ensurePermission(): Promise<void> {
  if (Platform.OS === 'android') {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    ]);
    const fine = result[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
    const coarse = result[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION];
    if (fine === PermissionsAndroid.RESULTS.GRANTED || coarse === PermissionsAndroid.RESULTS.GRANTED) return;
    if (fine === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN || coarse === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
      throw new LocationError('Location access is blocked for this app.', 'blocked');
    }
    throw new LocationError('Location access was not allowed.', 'permission');
  }
  await new Promise<void>((resolve, reject) =>
    Geolocation.requestAuthorization(
      () => resolve(),
      // iOS only asks once - after that the choice can only be changed in Settings
      () => reject(new LocationError('Location access is turned off for this app.', 'blocked'))
    )
  );
}

function getPosition(highAccuracy: boolean): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) =>
    Geolocation.getCurrentPosition(
      pos => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      err => {
        if (err.code === 1) {
          reject(new LocationError('Location access is turned off for this app.', Platform.OS === 'ios' ? 'blocked' : 'permission'));
        } else if (err.code === 3) {
          reject(new LocationError('Could not get a GPS fix in time. Move near a window or outside and try again.', 'timeout'));
        } else {
          reject(new LocationError("Your phone's location is turned off.", 'disabled'));
        }
      },
      { enableHighAccuracy: highAccuracy, timeout: highAccuracy ? 15000 : 10000, maximumAge: 10000 }
    )
  );
}

/** Opens the phone's location (GPS) settings so the user can turn location on. */
export async function openLocationSettings(): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      await Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS');
      return;
    } catch {
      // Some devices don't expose that screen - fall back to the app's settings
    }
  }
  await Linking.openSettings();
}

/** Opens this app's settings page (to allow a blocked location permission). */
export function openAppSettings(): Promise<void> {
  return Linking.openSettings();
}

async function fetchJson(url: string, headers: Record<string, string> = {}): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function reverseGeocode(latitude: number, longitude: number): Promise<Omit<DetectedGarageLocation, 'latitude' | 'longitude'>> {
  // 1. Google - best UK street-level results
  const google = await fetchJson(
    `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}&region=uk`
  );
  const result = google?.status === 'OK' ? google.results?.[0] : null;
  if (result) {
    const part = (type: string) =>
      (result.address_components || []).find((c: any) => (c.types || []).includes(type))?.long_name || '';
    const street = [part('premise'), part('street_number'), part('route')].filter(Boolean).join(' ');
    return {
      address: street || part('neighborhood') || part('sublocality') || '',
      city: part('postal_town') || part('locality') || part('administrative_area_level_2') || '',
      postcode: part('postal_code'),
    };
  }

  // 2. OpenStreetMap fallback
  const osm = await fetchJson(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
    { 'User-Agent': 'OndoorcarserviceHub/1.0' }
  );
  const addr = osm?.address || {};
  let postcode = addr.postcode || '';
  // 3. postcodes.io for the UK postcode if the map provider had none
  if (!postcode) {
    const pc = await fetchJson(`https://api.postcodes.io/postcodes?lon=${longitude}&lat=${latitude}&limit=1`);
    postcode = pc?.result?.[0]?.postcode || '';
  }
  return {
    address: [addr.house_number, addr.road || addr.pedestrian || addr.street].filter(Boolean).join(' ') || addr.suburb || '',
    city: addr.city || addr.town || addr.village || addr.county || '',
    postcode,
  };
}

/** Live device location (GPS) with the street, city and postcode looked up from it. */
export async function detectGarageLocation(): Promise<DetectedGarageLocation> {
  await ensurePermission();
  let coords: { latitude: number; longitude: number };
  try {
    coords = await getPosition(true);
  } catch (err) {
    // Indoors high-accuracy GPS can time out - fall back to network location
    if (!(err instanceof LocationError) || err.code !== 'timeout') throw err;
    coords = await getPosition(false);
  }
  const place = await reverseGeocode(coords.latitude, coords.longitude);
  return { ...coords, ...place };
}
