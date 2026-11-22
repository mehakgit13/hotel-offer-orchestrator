import Redis from "ioredis";
import { config } from "./config";

export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 250, 2000)
});

redis.on("error", (error) => {
  // Keep the process alive during transient Redis restarts.
  console.error(JSON.stringify({ level: "error", message: "Redis connection error", error: error.message }));
});

export function cacheKeys(city: string) {
  const normalized = city.trim().toLowerCase();
  return {
    list: `hotels:${normalized}:offers`,
    prices: `hotels:${normalized}:prices`,
    meta: `hotels:${normalized}:meta`
  };
}
