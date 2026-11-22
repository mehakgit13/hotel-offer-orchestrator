import { Connection, Client } from "@temporalio/client";
import { config } from "./config";

let clientPromise: Promise<Client> | undefined;

export async function getTemporalClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const connection = await Connection.connect({ address: config.temporalAddress });
      return new Client({ connection, namespace: config.temporalNamespace });
    })();
  }
  return clientPromise;
}
