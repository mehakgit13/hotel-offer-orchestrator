import { config } from "../config";
import { logger } from "../logger";
import { redis, cacheKeys } from "../redis";
import { selectBestOffers } from "../hotelLogic";
import { ComparisonResult, HotelOffer, SupplierHotel } from "../types";

async function fetchSupplier(url: string, city: string, supplier: string): Promise<SupplierHotel[]> {
  const endpoint = `${url}?city=${encodeURIComponent(city)}`;
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) {
    throw new Error(`${supplier} returned HTTP ${response.status}`);
  }
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new Error(`${supplier} response must be a JSON array`);
  return payload as SupplierHotel[];
}

export async function fetchBothSuppliers(city: string): Promise<{
  supplierA: SupplierHotel[];
  supplierB: SupplierHotel[];
}> {
  logger.info("Fetching supplier hotel listings in parallel", { city });
  const [supplierA, supplierB] = await Promise.all([
    fetchSupplier(config.supplierAUrl, city, "Supplier A"),
    fetchSupplier(config.supplierBUrl, city, "Supplier B")
  ]);
  return { supplierA, supplierB };
}

export async function compareAndCache(city: string): Promise<ComparisonResult> {
  const { supplierA, supplierB } = await fetchBothSuppliers(city);
  const hotels = selectBestOffers(supplierA, supplierB);
  const result: ComparisonResult = {
    city: city.trim().toLowerCase(),
    hotels,
    generatedAt: new Date().toISOString()
  };
  await saveOffersToRedis(result.city, hotels);
  logger.info("Hotel comparison completed and cached", {
    city: result.city,
    supplierACount: supplierA.length,
    supplierBCount: supplierB.length,
    resultCount: hotels.length
  });
  return result;
}

export async function saveOffersToRedis(city: string, hotels: HotelOffer[]): Promise<void> {
  const keys = cacheKeys(city);
  const pipeline = redis.pipeline();
  pipeline.del(keys.list, keys.prices);
  pipeline.set(keys.list, JSON.stringify(hotels), "EX", config.cacheTtlSeconds);
  for (const hotel of hotels) {
    // Sorted-set member stores the complete offer; score is the numeric price.
    pipeline.zadd(keys.prices, hotel.price, JSON.stringify(hotel));
  }
  pipeline.expire(keys.prices, config.cacheTtlSeconds);
  pipeline.set(keys.meta, JSON.stringify({ cachedAt: new Date().toISOString(), count: hotels.length }), "EX", config.cacheTtlSeconds);
  const result = await pipeline.exec();
  if (result?.some(([error]) => error)) throw new Error("Failed to persist hotel offers in Redis");
}

export async function getCachedOffers(city: string): Promise<HotelOffer[] | null> {
  const keys = cacheKeys(city);
  const raw = await redis.get(keys.list);
  if (raw === null) return null;
  return JSON.parse(raw) as HotelOffer[];
}

export async function filterOffersInRedis(
  city: string,
  minPrice?: number,
  maxPrice?: number
): Promise<HotelOffer[]> {
  const keys = cacheKeys(city);
  const min = minPrice ?? "-inf";
  const max = maxPrice ?? "+inf";
  const members = await redis.zrangebyscore(keys.prices, min, max);
  return members.map((member) => JSON.parse(member) as HotelOffer);
}

export async function checkSupplierHealth(): Promise<{
  supplierA: { status: "up" | "down"; detail: string };
  supplierB: { status: "up" | "down"; detail: string };
}> {
  const check = async (url: string, enabled: boolean, label: string) => {
    if (!enabled) return { status: "down" as const, detail: "Disabled by configuration" };
    try {
      const response = await fetch(`${url}?city=delhi`, { signal: AbortSignal.timeout(3000) });
      if (!response.ok) return { status: "down" as const, detail: `HTTP ${response.status}` };
      return { status: "up" as const, detail: "Responding normally" };
    } catch (error) {
      return { status: "down" as const, detail: error instanceof Error ? error.message : `${label} unavailable` };
    }
  };
  const [supplierA, supplierB] = await Promise.all([
    check(config.supplierAUrl, config.supplierAEnabled, "Supplier A"),
    check(config.supplierBUrl, config.supplierBEnabled, "Supplier B")
  ]);
  return { supplierA, supplierB };
}
