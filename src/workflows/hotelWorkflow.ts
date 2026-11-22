import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities/hotelActivities";
import { ComparisonResult } from "../types";

const {
  compareAndCache
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "30 seconds",
  retry: {
    initialInterval: "1 second",
    maximumInterval: "10 seconds",
    maximumAttempts: 3
  }
});

export async function hotelComparisonWorkflow(city: string): Promise<ComparisonResult> {
  // The activity fetches both supplier APIs concurrently, compares results,
  // and writes the final deduplicated list to Redis.
  return compareAndCache(city);
}
