import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { registerNextLogger, type Logger } from "./index";

function createMockLogger(): Logger & {
	calls: { method: string; args: unknown[] }[];
} {
	const calls: { method: string; args: unknown[] }[] = [];

	const createMethod = (method: string) => {
		return (...args: unknown[]) => {
			calls.push({ method, args });
		};
	};

	const logger: Logger & { calls: { method: string; args: unknown[] }[] } = {
		calls,
		info: createMethod("info"),
		warn: createMethod("warn"),
		error: createMethod("error"),
		trace: createMethod("trace"),
		child: () => logger,
	};

	return logger;
}

describe("registerNextLogger", () => {
	let mockLogger: ReturnType<typeof createMockLogger>;
	let originalConsoleLog: typeof console.log;
	let originalConsoleWarn: typeof console.warn;
	let originalConsoleError: typeof console.error;
	let originalStdoutWrite: typeof process.stdout.write;

	beforeEach(() => {
		mockLogger = createMockLogger();
		originalConsoleLog = console.log;
		originalConsoleWarn = console.warn;
		originalConsoleError = console.error;
		originalStdoutWrite = process.stdout.write;
	});

	afterEach(() => {
		console.log = originalConsoleLog;
		console.warn = originalConsoleWarn;
		console.error = originalConsoleError;
		process.stdout.write = originalStdoutWrite;
	});

	it("should create logger without errors", () => {
		expect(() => registerNextLogger(mockLogger)).not.toThrow();
	});

	it("should wrap console.log", () => {
		const originalLog = console.log;
		registerNextLogger(mockLogger);
		expect(console.log).not.toBe(originalLog);
	});

	it("should wrap console.warn", () => {
		const originalWarn = console.warn;
		registerNextLogger(mockLogger);
		expect(console.warn).not.toBe(originalWarn);
	});

	it("should wrap console.error", () => {
		const originalError = console.error;
		registerNextLogger(mockLogger);
		expect(console.error).not.toBe(originalError);
	});

	it("should wrap process.stdout.write", () => {
		const originalWrite = process.stdout.write;
		registerNextLogger(mockLogger);
		expect(process.stdout.write).not.toBe(originalWrite);
	});

	describe("HTTP request parsing", () => {
		it("should parse simple HTTP request log", () => {
			registerNextLogger(mockLogger);
			console.log("GET /api/test 200 in 50ms");

			expect(mockLogger.calls).toHaveLength(1);
			expect(mockLogger.calls[0].method).toBe("info");
			expect(mockLogger.calls[0].args[0]).toEqual({
				method: "GET",
				path: "/api/test",
				statusCode: 200,
				duration: 50,
			});
			expect(mockLogger.calls[0].args[1]).toBe("HTTP request");
		});

		it("should parse HTTP request with seconds", () => {
			registerNextLogger(mockLogger);
			console.log("POST /api/data 201 in 1.5s");

			expect(mockLogger.calls).toHaveLength(1);
			expect(mockLogger.calls[0].args[0]).toEqual({
				method: "POST",
				path: "/api/data",
				statusCode: 201,
				duration: 1500,
			});
		});

		it("should parse HTTP request with breakdown", () => {
			registerNextLogger(mockLogger);
			console.log("GET /page 200 in 100ms (render: 50ms, data: 30ms)");

			expect(mockLogger.calls).toHaveLength(1);
			expect(mockLogger.calls[0].args[0]).toEqual({
				method: "GET",
				path: "/page",
				statusCode: 200,
				duration: 100,
				breakdown: {
					render: 50,
					data: 30,
				},
			});
		});

		it("should parse HTTP request from stdout.write", () => {
			registerNextLogger(mockLogger);
			process.stdout.write("DELETE /api/item 204 in 25ms\n");

			expect(mockLogger.calls).toHaveLength(1);
			expect(mockLogger.calls[0].args[0]).toEqual({
				method: "DELETE",
				path: "/api/item",
				statusCode: 204,
				duration: 25,
			});
		});
	});

	describe("Next.js bootstrap format", () => {
		it("should parse bootstrap messages (3 spaces prefix)", () => {
			registerNextLogger(mockLogger);
			console.log("   Ready on http://localhost:3000");

			expect(mockLogger.calls).toHaveLength(1);
			expect(mockLogger.calls[0].method).toBe("info");
			expect(mockLogger.calls[0].args[0]).toBe(
				"Ready on http://localhost:3000",
			);
		});
	});

	describe("ANSI stripping", () => {
		it("should strip ANSI codes from messages", () => {
			registerNextLogger(mockLogger);
			console.log("   \x1b[32mServer started\x1b[0m");

			expect(mockLogger.calls).toHaveLength(1);
			expect(mockLogger.calls[0].args[0]).toBe("Server started");
		});

		it("should strip ANSI codes from HTTP requests", () => {
			registerNextLogger(mockLogger);
			console.log("\x1b[32mGET\x1b[0m /api/test 200 in 50ms");

			expect(mockLogger.calls).toHaveLength(1);
			expect(mockLogger.calls[0].args[0]).toEqual({
				method: "GET",
				path: "/api/test",
				statusCode: 200,
				duration: 50,
			});
		});
	});

	describe("passthrough for non-Next.js logs", () => {
		it("should pass through regular console.log calls", () => {
			const passedThrough: unknown[][] = [];
			console.log = (...args: unknown[]) => {
				passedThrough.push(args);
			};

			registerNextLogger(mockLogger);
			console.log("Regular log message");

			expect(mockLogger.calls).toHaveLength(0);
			expect(passedThrough).toHaveLength(1);
			expect(passedThrough[0]).toEqual(["Regular log message"]);
		});

		it("should pass through stdout.write for non-HTTP content", () => {
			let passedThrough = "";
			process.stdout.write = ((chunk: string | Uint8Array) => {
				passedThrough += typeof chunk === "string" ? chunk : chunk.toString();
				return true;
			}) as typeof process.stdout.write;

			registerNextLogger(mockLogger);
			process.stdout.write("Regular output\n");

			expect(mockLogger.calls).toHaveLength(0);
			expect(passedThrough).toBe("Regular output\n");
		});
	});
});
