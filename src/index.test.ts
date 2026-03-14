import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Logger, registerNextLogger } from "./index";

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

	describe("prefixed log interception", () => {
		it("should intercept wait prefix via console.log", () => {
			registerNextLogger(mockLogger);
			console.log(" ○ Compiling /page...");

			expect(mockLogger.calls).toHaveLength(1);
			expect(mockLogger.calls[0].method).toBe("info");
			expect(mockLogger.calls[0].args[0]).toBe("○ Compiling /page...");
		});

		it("should intercept error prefix via console.error", () => {
			registerNextLogger(mockLogger);
			console.error(" ⨯ Unhandled error");

			expect(mockLogger.calls).toHaveLength(1);
			expect(mockLogger.calls[0].method).toBe("error");
			expect(mockLogger.calls[0].args[0]).toBe("⨯ Unhandled error");
		});

		it("should intercept warn prefix via console.warn", () => {
			registerNextLogger(mockLogger);
			console.warn(" ⚠ Fast Refresh had to perform a full reload");

			expect(mockLogger.calls).toHaveLength(1);
			expect(mockLogger.calls[0].method).toBe("warn");
			expect(mockLogger.calls[0].args[0]).toBe(
				"⚠ Fast Refresh had to perform a full reload",
			);
		});

		it("should intercept event prefix via console.log", () => {
			registerNextLogger(mockLogger);
			console.log(" ✓ Compiled successfully");

			expect(mockLogger.calls).toHaveLength(1);
			expect(mockLogger.calls[0].method).toBe("info");
			expect(mockLogger.calls[0].args[0]).toBe("✓ Compiled successfully");
		});

		it("should intercept trace prefix via console.log", () => {
			registerNextLogger(mockLogger);
			console.log(" » some trace info");

			expect(mockLogger.calls).toHaveLength(1);
			expect(mockLogger.calls[0].method).toBe("trace");
		});
	});

	describe("stdout.write edge cases", () => {
		it("should handle Buffer input in stdout.write", () => {
			registerNextLogger(mockLogger);
			process.stdout.write(Buffer.from("GET /api 200 in 10ms\n"));

			expect(mockLogger.calls).toHaveLength(1);
			expect(mockLogger.calls[0].args[0]).toEqual({
				method: "GET",
				path: "/api",
				statusCode: 200,
				duration: 10,
			});
		});

		it("should strip ANSI from stdout.write HTTP logs", () => {
			registerNextLogger(mockLogger);
			process.stdout.write("\x1b[32mGET\x1b[0m /api 200 in 5ms\n");

			expect(mockLogger.calls).toHaveLength(1);
			expect(mockLogger.calls[0].args[0]).toEqual({
				method: "GET",
				path: "/api",
				statusCode: 200,
				duration: 5,
			});
		});
	});

	describe("child logger", () => {
		it("should call child with next.js name binding", () => {
			let childBindings: Record<string, unknown> | undefined;
			const childLogger = createMockLogger();
			const parentLogger: Logger = {
				...createMockLogger(),
				child: (bindings) => {
					childBindings = bindings;
					return childLogger;
				},
			};

			registerNextLogger(parentLogger);
			expect(childBindings).toEqual({ name: "next.js" });
		});

		it("should use child logger for intercepted logs", () => {
			const childLogger = createMockLogger();
			const parentLogger: Logger = {
				...createMockLogger(),
				child: () => childLogger,
			};

			registerNextLogger(parentLogger);
			console.log("GET /test 200 in 10ms");

			expect(childLogger.calls).toHaveLength(1);
			expect(childLogger.calls[0].method).toBe("info");
		});
	});

	describe("multiple calls", () => {
		it("should handle multiple console.log calls", () => {
			registerNextLogger(mockLogger);
			console.log("GET /a 200 in 1ms");
			console.log("POST /b 201 in 2ms");
			console.log("   Startup message");

			expect(mockLogger.calls).toHaveLength(3);
			expect(mockLogger.calls[0].args[0]).toEqual(
				expect.objectContaining({ path: "/a" }),
			);
			expect(mockLogger.calls[1].args[0]).toEqual(
				expect.objectContaining({ path: "/b" }),
			);
			expect(mockLogger.calls[2].args[0]).toBe("Startup message");
		});
	});
});
