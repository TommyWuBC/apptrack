import maxmind, { type CityResponse, type Reader } from "maxmind";
import type { GeoLookup } from "./geo-lookup.js";

export async function openGeoLite2Lookup(
  databasePath: string,
): Promise<{ lookup: GeoLookup; close: () => void }> {
  const reader: Reader<CityResponse> = await maxmind.open<CityResponse>(
    databasePath,
  );
  return {
    lookup: (ip) => {
      const hit = reader.get(ip);
      if (!hit) return null;
      return {
        country: hit.country?.iso_code ?? null,
        region: hit.subdivisions?.[0]?.iso_code ?? null,
        city: hit.city?.names?.en ?? null,
      };
    },
    // maxmind's in-memory Reader owns no open file descriptor after `open`.
    close: () => {},
  };
}
