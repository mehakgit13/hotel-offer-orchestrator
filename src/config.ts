export const config = {
  port: Number(process.env.PORT ?? 3000),
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  temporalAddress: process.env.TEMPORAL_ADDRESS ?? "localhost:7233",
  temporalNamespace: process.env.TEMPORAL_NAMESPACE ?? "default",
  taskQueue: process.env.TASK_QUEUE ?? "hotel-offer-task-queue",
  supplierAUrl: process.env.SUPPLIER_A_URL ?? "http://localhost:3000/supplierA/hotels",
  supplierBUrl: process.env.SUPPLIER_B_URL ?? "http://localhost:3000/supplierB/hotels",
  supplierAEnabled: process.env.SUPPLIER_A_ENABLED !== "false",
  supplierBEnabled: process.env.SUPPLIER_B_ENABLED !== "false",
  cacheTtlSeconds: Number(process.env.CACHE_TTL_SECONDS ?? 900)
};
