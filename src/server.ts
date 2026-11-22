import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { z } from "zod";
import { config } from "./config";
import { logger } from "./logger";
import { redis } from "./redis";
import supplierRouter from "./suppliers";
import { checkSupplierHealth, filterOffersInRedis, getCachedOffers } from "./activities/hotelActivities";
import { getTemporalClient } from "./temporal";

const app = express();
app.use(cors());
app.use(express.json());
app.use(supplierRouter);

const querySchema = z.object({
  city: z.string().trim().min(1, "city is required").max(80),
  minPrice: z.coerce.number().finite().nonnegative().optional(),
  maxPrice: z.coerce.number().finite().nonnegative().optional()
}).refine((value) =>
  value.minPrice === undefined || value.maxPrice === undefined || value.minPrice <= value.maxPrice,
  { message: "minPrice must be less than or equal to maxPrice" }
);

app.get("/health", async (_req: Request, res: Response) => {
  const [suppliers, redisStatus] = await Promise.all([
    checkSupplierHealth(),
    redis.ping().then(() => "up").catch(() => "down")
  ]);
  const healthy = suppliers.supplierA.status === "up" &&
    suppliers.supplierB.status === "up" && redisStatus === "up";
  res.status(healthy ? 200 : 503).json({
    status: healthy ? "healthy" : "degraded",
    redis: redisStatus,
    suppliers,
    timestamp: new Date().toISOString()
  });
});

app.get("/api/hotels", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid query parameters",
        details: parsed.error.issues.map((issue) => issue.message)
      });
    }
    const { city, minPrice, maxPrice } = parsed.data;
    const normalizedCity = city.toLowerCase();

    if (minPrice !== undefined || maxPrice !== undefined) {
      // Price range is evaluated by Redis sorted-set score, not in application memory.
      let cached = await getCachedOffers(normalizedCity);
      if (cached === null) {
        const client = await getTemporalClient();
        const workflowId = `hotel-comparison-${normalizedCity}-${Date.now()}`;
        const handle = await client.workflow.start("hotelComparisonWorkflow", {
          taskQueue: config.taskQueue,
          workflowId,
          args: [normalizedCity]
        });
        await handle.result();
      }
      const hotels = await filterOffersInRedis(normalizedCity, minPrice, maxPrice);
      return res.json(hotels);
    }

    const client = await getTemporalClient();
    const workflowId = `hotel-comparison-${normalizedCity}-${Date.now()}`;
    const handle = await client.workflow.start("hotelComparisonWorkflow", {
      taskQueue: config.taskQueue,
      workflowId,
      args: [normalizedCity]
    });
    const result = await handle.result();
    return res.json(result.hotels);
  } catch (error) {
    return next(error);
  }
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  logger.error("Request failed", {
    error: error instanceof Error ? error.message : String(error)
  });
  res.status(502).json({
    error: "Unable to complete hotel comparison",
    detail: error instanceof Error ? error.message : "Unknown error"
  });
});

const server = app.listen(config.port, () => {
  logger.info("Hotel Offer Orchestrator API listening", { port: config.port });
});

async function shutdown(signal: string) {
  logger.info("Shutting down API", { signal });
  server.close();
  await redis.quit().catch(() => undefined);
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
