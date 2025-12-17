# next-ts-logger

A structured logger for Next.js compatible with Pino and Winston.

## Installation

```bash
npm install next-ts-logger
```

Install one of the supported loggers:

```bash
# Pino
npm install pino

# or Winston
npm install winston
```

## Usage

Create an `instrumentation.ts` file in your Next.js project root (or `src/` directory):

### With Pino

```ts
// instrumentation.ts
import pino from "pino";
import { createNextLogger } from "next-ts-logger";

export function register() {
  const logger = pino();
  createNextLogger(logger);
}
```

### With Winston

```ts
// instrumentation.ts
import winston from "winston";
import { createNextLogger } from "next-ts-logger";

export function register() {
  const logger = winston.createLogger({
    transports: [new winston.transports.Console()],
  });
  createNextLogger(logger);
}
```
