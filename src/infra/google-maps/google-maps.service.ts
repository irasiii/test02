import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface DistanceMatrixResult {
  distanceMeters: number;
  durationSeconds: number;
  polyline: string;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress: string;
}

/**
 * Lightweight wrapper around Google Maps Platform REST APIs:
 *  - Distance Matrix API   (eta + fare estimate)
 *  - Geocoding              (address -> coords)
 *  - Directions (polyline)  (driver -> pickup / destination)
 *
 * The HTTP client is `native fetch` (Node 18+). We keep dependencies minimal.
 */
@Injectable()
export class GoogleMapsService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://maps.googleapis.com/maps/api';
  /** When no real API key is configured we return deterministic mock geometry so
   *  the whole app (request/estimate/accept/complete flows) runs without external
   *  calls. Set GOOGLE_MAPS_API_KEY to a real key to use live Google data. */
  private readonly isMock: boolean;

  constructor(private config: ConfigService) {
    this.apiKey = config.get<string>('googleMaps.apiKey', '');
    this.isMock = !this.apiKey || this.apiKey === 'your-google-maps-api-key';
  }

  async geocode(address: string): Promise<GeocodeResult | null> {
    if (this.isMock) {
      return { lat: 25.2048, lng: 55.2708, formattedAddress: address };
    }
    const url = `${this.baseUrl}/geocode/json?address=${encodeURIComponent(address)}&key=${this.apiKey}`;
    const data = await this.httpGet<any>(url);
    const first = data?.results?.[0];
    if (!first) return null;
    return {
      lat: first.geometry.location.lat,
      lng: first.geometry.location.lng,
      formattedAddress: first.formatted_address,
    };
  }

  async reverseGeocode(lat: number, lng: number): Promise<string | null> {
    if (this.isMock) return `Mock location (${lat}, ${lng})`;
    const url = `${this.baseUrl}/geocode/json?latlng=${lat},${lng}&key=${this.apiKey}`;
    const data = await this.httpGet<any>(url);
    return data?.results?.[0]?.formatted_address ?? null;
  }

  async distanceMatrix(
    origins: string,
    destinations: string,
  ): Promise<DistanceMatrixResult | null> {
    if (this.isMock) return this.mockRoute(origins, destinations);
    const url = `${this.baseUrl}/distancematrix/json?origins=${encodeURIComponent(
      origins,
    )}&destinations=${encodeURIComponent(destinations)}&key=${this.apiKey}`;
    const data = await this.httpGet<any>(url);
    const element = data?.rows?.[0]?.elements?.[0];
    if (!element || element.status !== 'OK') return null;
    return {
      distanceMeters: element.distance.value,
      durationSeconds: element.duration.value,
      polyline: '',
    };
  }

  async directions(origin: string, destination: string): Promise<DistanceMatrixResult | null> {
    if (this.isMock) return this.mockRoute(origin, destination);
    const url = `${this.baseUrl}/directions/json?origin=${encodeURIComponent(
      origin,
    )}&destination=${encodeURIComponent(destination)}&key=${this.apiKey}`;
    const data = await this.httpGet<any>(url);
    const route = data?.routes?.[0];
    if (!route) return null;
    const leg = route.legs?.[0];
    return {
      distanceMeters: leg?.distance?.value ?? 0,
      durationSeconds: leg?.duration?.value ?? 0,
      polyline: route.overview_polyline?.points ?? '',
    };
  }

  /** Deterministic geometry derived from the supplied "lat,lng" coordinates. */
  private mockRoute(origins: string, destinations: string): DistanceMatrixResult {
    const [oLat, oLng] = origins.split(',').map(Number);
    const [dLat, dLng] = destinations.split(',').map(Number);
    const distanceMeters = haversineMeters(oLat, oLng, dLat, dLng);
    const durationSeconds = Math.max(60, Math.round(distanceMeters / 8.33)); // ~30 km/h
    return { distanceMeters, durationSeconds, polyline: '' };
  }

  /**
   * Bin distance (km) and ETA (minutes) into a human-readable estimate.
   * Optionally use a Surge multiplier when demand > supply.
   */
  estimateFare(distanceMeters: number, durationSeconds: number, surge = 1.0) {
    const baseFare = 2.5;
    const perKm = 1.2;
    const perMin = 0.25;
    const km = distanceMeters / 1000;
    const min = durationSeconds / 60;
    const total = (baseFare + perKm * km + perMin * min) * surge;
    return {
      baseFare,
      perKm,
      perMin,
      surge,
      subtotal: Number(total.toFixed(2)),
      currency: 'USD',
      distanceKm: Number(km.toFixed(2)),
      durationMin: Math.ceil(min),
    };
  }

  private async httpGet<T>(url: string): Promise<T> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Google Maps API error ${res.status}`);
    return res.json() as Promise<T>;
  }
}

/** Great-circle distance in meters between two "lat,lng" points. */
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
