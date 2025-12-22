# next-ts-logger

This acts as log interceptor for next.js applications. Compatible with Pino and Winston.

## Motivation

I was using pino and wanted to have also get my Next.js application work with it. I stumpled upon [next-logger](https://github.com/sainsburys-tech/next-logger), but it does not support TypeScript and started to get buggy with turbopack enabled, so I decided to create this package.

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
import { registerNextLogger } from "next-ts-logger";

export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const logger = pino();
    registerNextLogger(logger);
  }
}
```

### With Winston

```ts
// instrumentation.ts
import winston from "winston";
import { registerNextLogger } from "next-ts-logger";

export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const logger = winston.createLogger({
      transports: [new winston.transports.Console()],
    });
    registerNextLogger(logger);
  }
}
```
