import { NativeConnection, Worker } from "@temporalio/worker";
import { config } from "./config";
import * as activities from "./activities/hotelActivities";
import { logger } from "./logger";

async function run(): Promise<void> {
  const connection = await NativeConnection.connect({ address: config.temporalAddress });
  const worker = await Worker.create({
    connection,
    namespace: config.temporalNamespace,
    taskQueue: config.taskQueue,
    workflowsPath: require.resolve("./workflows/hotelWorkflow"),
    activities
  });
  logger.info("Temporal worker started", { taskQueue: config.taskQueue });
  await worker.run();
}

run().catch((error) => {
  logger.error("Temporal worker failed", { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
