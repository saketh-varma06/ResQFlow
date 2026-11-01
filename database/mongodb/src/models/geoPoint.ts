import { Schema } from "mongoose";

/**
 * GeoJSON Point sub-schema, shared by incidents, sosRequests and shelters.
 * Storage format: { type: "Point", coordinates: [longitude, latitude] }
 * (GeoJSON order is longitude first). Records without coordinates simply
 * omit `location` — exactly mirroring the nullable latitude/longitude pair
 * in PostgreSQL. Kept in sync with the scalar `latitude`/`longitude` fields
 * during migration and by the future application write path.
 */
export interface GeoPoint {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
}

export const geoPointSchema = new Schema<GeoPoint>(
  {
    type: {
      type: String,
      enum: ["Point"],
      required: true,
      default: "Point",
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: (v: number[]) =>
          Array.isArray(v) &&
          v.length === 2 &&
          typeof v[0] === "number" &&
          typeof v[1] === "number" &&
          v[0] >= -180 &&
          v[0] <= 180 && // longitude
          v[1] >= -90 &&
          v[1] <= 90, // latitude
        message:
          "coordinates must be [longitude, latitude] with longitude in [-180, 180] and latitude in [-90, 90]",
      },
    },
  },
  { _id: false },
);

/** Build a GeoPoint from a nullable lat/lon pair, or undefined when absent. */
export function toGeoPoint(
  latitude?: number | null,
  longitude?: number | null,
): GeoPoint | undefined {
  if (
    latitude === undefined ||
    latitude === null ||
    longitude === undefined ||
    longitude === null
  ) {
    return undefined;
  }
  return { type: "Point", coordinates: [longitude, latitude] };
}
