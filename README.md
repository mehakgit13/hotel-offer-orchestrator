# Hotel Offer Orchestrator

A TypeScript backend that concurrently retrieves hotel offers from two mock suppliers, deduplicates hotels by name, selects the lowest price, persists the final list in Redis, and orchestrates comparison through Temporal.

## Technology stack

- Node.js 20 + TypeScript
- Express 4 REST API
- Temporal workflow + worker
- Redis 7 (sorted set for price filtering)
- Docker Compose
- Vitest

## Architecture

1. Client calls `GET /api/hotels?city=delhi`.
2. Express starts `hotelComparisonWorkflow` on Temporal.
3. Temporal worker executes the `compareAndCache` activity.
4. The activity calls Supplier A and Supplier B concurrently using `Promise.all`.
5. The comparison function deduplicates by normalized hotel name and retains the cheaper offer.
6. The final list is saved in Redis:
   - `hotels:<city>:offers` stores the complete JSON list.
   - `hotels:<city>:prices` is a Redis sorted set; its score is the numeric price and its member is the serialized offer.
7. For a price range request, the API reads the sorted set with `ZRANGEBYSCORE`, so filtering is performed by Redis.

## Requirements

- Docker Desktop with Docker Compose v2
- Internet access for the first image and npm dependency downloads

## Run with Docker Compose (recommended)

From the project root:

```bash
docker compose up --build
```

Wait for Temporal's local development server and Redis to initialize. The Temporal development server provides its UI on port 8080. Services:

| Service | URL / Port |
|---|---|
| API | http://localhost:3000 |
| Temporal Web UI (built into the dev server) | http://localhost:8080 |
| Temporal frontend | localhost:7233 |
| Redis | localhost:6379 |

The API container and worker container share the same built image. The worker polls the `hotel-offer-task-queue` task queue.

## API examples

### Compare all hotels for a city

```bash
curl "http://localhost:3000/api/hotels?city=delhi"
```

Expected output (ordering is alphabetical):

```json
[
  { "name": "Blue Orchid", "price": 4800, "supplier": "Supplier B", "commissionPct": 11 },
  { "name": "Holton", "price": 5340, "supplier": "Supplier B", "commissionPct": 20 },
  { "name": "Radison", "price": 5900, "supplier": "Supplier A", "commissionPct": 13 },
  { "name": "The Grand", "price": 7200, "supplier": "Supplier A", "commissionPct": 12 }
]
```

### Filter by price (Redis ZRANGEBYSCORE)

```bash
curl "http://localhost:3000/api/hotels?city=delhi&minPrice=5000&maxPrice=6000"
```

Expected output:

```json
[
  { "name": "Holton", "price": 5340, "supplier": "Supplier B", "commissionPct": 20 },
  { "name": "Radison", "price": 5900, "supplier": "Supplier A", "commissionPct": 13 }
]
```

### City with no data

```bash
curl "http://localhost:3000/api/hotels?city=jaipur"
```

Expected output: `[]`.

### Health

```bash
curl -i "http://localhost:3000/health"
```

The health endpoint checks Redis and both mock supplier endpoints. It returns HTTP 200 when all are healthy, otherwise HTTP 503 with per-supplier details.

### Mock supplier endpoints

```bash
curl "http://localhost:3000/supplierA/hotels?city=delhi"
curl "http://localhost:3000/supplierB/hotels?city=delhi"
```

## Run tests

```bash
npm install
npm test
npm run typecheck
npm run build
```

The unit tests cover cheaper-offer selection, retaining one-supplier hotels, and case-insensitive deduplication.

## Run locally without Docker (advanced)

You still need Redis and a Temporal server running locally. Set environment variables if they are not using the defaults, then:

Terminal 1:
```bash
npm install
npm run build
npm start
```

Terminal 2:
```bash
npm run worker
```

## Simulate a supplier outage

In `docker-compose.yml`, set `SUPPLIER_A_ENABLED=false` under the `api` service and recreate it:

```bash
docker compose up -d --force-recreate api
```

The Supplier A mock endpoint will return HTTP 503. The health endpoint will report Supplier A as down. The comparison activity uses retries and fails the workflow if either supplier remains unavailable; this keeps the result from silently presenting an incomplete comparison.

Restore with `SUPPLIER_A_ENABLED=true` and recreate the API.

## Stop services

```bash
docker compose down
```

To remove persisted Redis data as well:

```bash
docker compose down -v
```

## Submission contents

- `src/`: TypeScript application, Temporal workflow, worker and activities
- `Dockerfile`: multi-stage container build
- `.env.example`: local environment variable reference
- `docker-compose.yml`: Temporal, Temporal UI, Redis, API and worker
- `postman/Hotel-Offer-Orchestrator.postman_collection.json`: importable Postman collection
- `test/`: unit tests
- `README.md`: setup, architecture and API documentation

## Design decisions

- Hotel names are normalized with trim + lowercase for deduplication.
- When prices tie, Supplier A is retained because Supplier A entries are inserted first and only a strictly lower price replaces an existing offer.
- Commission percentage is carried from the supplier whose offer is selected.
- A cache miss for a price-filter request triggers a fresh Temporal comparison before Redis filtering.
- Redis sorted sets provide efficient numeric range selection.
