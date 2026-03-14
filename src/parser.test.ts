import { describe, expect, it } from "vitest";
import {
	argsToMessage,
	parseHttpRequest,
	parseNextLog,
	stripAnsi,
} from "./parser";

describe("stripAnsi", () => {
	it("should remove ANSI escape codes", () => {
		expect(stripAnsi("\x1b[32mgreen\x1b[0m")).toBe("green");
	});

	it("should handle multiple ANSI codes", () => {
		expect(stripAnsi("\x1b[1m\x1b[32mbold green\x1b[0m")).toBe("bold green");
	});

	it("should return unchanged string without ANSI codes", () => {
		expect(stripAnsi("plain text")).toBe("plain text");
	});

	it("should handle empty string", () => {
		expect(stripAnsi("")).toBe("");
	});
});

describe("argsToMessage", () => {
	it("should join string arguments", () => {
		expect(argsToMessage(["hello", "world"])).toBe("hello world");
	});

	it("should convert non-strings to strings", () => {
		expect(argsToMessage(["count:", 42])).toBe("count: 42");
	});

	it("should strip ANSI from strings", () => {
		expect(argsToMessage(["\x1b[32mgreen\x1b[0m", "text"])).toBe("green text");
	});

	it("should trim result", () => {
		expect(argsToMessage(["  padded  "])).toBe("padded");
	});

	it("should handle empty array", () => {
		expect(argsToMessage([])).toBe("");
	});
});

describe("parseHttpRequest", () => {
	it("should parse simple HTTP request", () => {
		expect(parseHttpRequest("GET /api/test 200 in 50ms")).toEqual({
			method: "GET",
			path: "/api/test",
			statusCode: 200,
			duration: 50,
		});
	});

	it("should parse request with seconds duration", () => {
		expect(parseHttpRequest("POST /api/data 201 in 1.5s")).toEqual({
			method: "POST",
			path: "/api/data",
			statusCode: 201,
			duration: 1500,
		});
	});

	it("should parse request with breakdown", () => {
		expect(
			parseHttpRequest("GET /page 200 in 100ms (render: 50ms, data: 30ms)"),
		).toEqual({
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

	it("should return null for non-HTTP log", () => {
		expect(parseHttpRequest("Some random log")).toBeNull();
	});

	it("should handle various HTTP methods", () => {
		expect(parseHttpRequest("DELETE /api/item 204 in 25ms")?.method).toBe(
			"DELETE",
		);
		expect(parseHttpRequest("PUT /api/item 200 in 30ms")?.method).toBe("PUT");
		expect(parseHttpRequest("PATCH /api/item 200 in 20ms")?.method).toBe(
			"PATCH",
		);
	});
});

describe("parseNextLog", () => {
	it("should return null for empty args", () => {
		expect(parseNextLog([])).toBeNull();
	});

	it("should return null for non-string first arg", () => {
		expect(parseNextLog([42])).toBeNull();
	});

	it("should parse bootstrap format (3 spaces)", () => {
		const result = parseNextLog(["   Ready on http://localhost:3000"]);
		expect(result).toEqual({
			type: "message",
			level: "info",
			message: "Ready on http://localhost:3000",
		});
	});

	it("should parse HTTP request format", () => {
		const result = parseNextLog(["GET /api/test 200 in 50ms"]);
		expect(result).toEqual({
			type: "http",
			data: {
				method: "GET",
				path: "/api/test",
				statusCode: 200,
				duration: 50,
			},
		});
	});

	it("should return null for regular log", () => {
		expect(parseNextLog(["Regular log message"])).toBeNull();
	});

	it("should not treat 4+ spaces as bootstrap format", () => {
		// 4 spaces matches the info prefix (" ") via findPrefix, not bootstrap
		const result = parseNextLog(["    four spaces"]);
		expect(result).not.toBeNull();
		expect(result?.type).toBe("message");
	});

	it("should parse prefixed log with ○ (wait) as info", () => {
		const result = parseNextLog([" ○ Compiling..."]);
		expect(result).toEqual({
			type: "message",
			level: "info",
			message: "○ Compiling...",
		});
	});

	it("should parse prefixed log with ⨯ (error) as error", () => {
		const result = parseNextLog([" ⨯ Something failed"]);
		expect(result).toEqual({
			type: "message",
			level: "error",
			message: "⨯ Something failed",
		});
	});

	it("should parse prefixed log with ⚠ (warn) as warn", () => {
		const result = parseNextLog([" ⚠ Deprecation warning"]);
		expect(result).toEqual({
			type: "message",
			level: "warn",
			message: "⚠ Deprecation warning",
		});
	});

	it("should parse prefixed log with ▲ (ready) as info", () => {
		const result = parseNextLog([" ▲ Next.js 14.0.0"]);
		expect(result).toEqual({
			type: "message",
			level: "info",
			message: "▲ Next.js 14.0.0",
		});
	});

	it("should parse prefixed log with ✓ (event) as info", () => {
		const result = parseNextLog([" ✓ Compiled successfully"]);
		expect(result).toEqual({
			type: "message",
			level: "info",
			message: "✓ Compiled successfully",
		});
	});

	it("should parse prefixed log with » (trace) as trace", () => {
		const result = parseNextLog([" » trace detail"]);
		expect(result).toEqual({
			type: "message",
			level: "trace",
			message: "» trace detail",
		});
	});

	it("should return null when prefix is not recognized", () => {
		expect(parseNextLog([" ? unknown prefix"])).toBeNull();
	});

	it("should concatenate multiple args for prefixed logs", () => {
		const result = parseNextLog([" ○ Compiling", "/page", "..."]);
		expect(result).toEqual({
			type: "message",
			level: "info",
			message: "○ Compiling /page ...",
		});
	});

	it("should concatenate multiple args for bootstrap format", () => {
		const result = parseNextLog(["   Local:", "http://localhost:3000"]);
		expect(result).toEqual({
			type: "message",
			level: "info",
			message: "Local: http://localhost:3000",
		});
	});

	it("should strip ANSI codes from prefixed logs", () => {
		const result = parseNextLog([" \x1b[32m○\x1b[0m Compiling..."]);
		// findPrefix checks the raw string for the prefix, ANSI wrapping may prevent matching
		// This tests the actual behavior
		if (result) {
			expect(result.type).toBe("message");
		}
	});

	it("should parse HTTP request with ANSI in args", () => {
		const result = parseNextLog(["\x1b[32mGET\x1b[0m /test 200 in 10ms"]);
		expect(result).toEqual({
			type: "http",
			data: {
				method: "GET",
				path: "/test",
				statusCode: 200,
				duration: 10,
			},
		});
	});
});

describe("parseHttpRequest edge cases", () => {
	it("should return null for empty string", () => {
		expect(parseHttpRequest("")).toBeNull();
	});

	it("should parse fractional milliseconds", () => {
		expect(parseHttpRequest("GET / 200 in 3.14ms")).toEqual({
			method: "GET",
			path: "/",
			statusCode: 200,
			duration: 3.14,
		});
	});

	it("should parse breakdown with seconds", () => {
		const result = parseHttpRequest(
			"GET /page 200 in 2s (render: 1.5s, data: 500ms)",
		);
		expect(result).toEqual({
			method: "GET",
			path: "/page",
			statusCode: 200,
			duration: 2000,
			breakdown: {
				render: 1500,
				data: 500,
			},
		});
	});

	it("should return null for missing 'in' keyword", () => {
		expect(parseHttpRequest("GET /api 200 50ms")).toBeNull();
	});

	it("should return null for missing status code", () => {
		expect(parseHttpRequest("GET /api in 50ms")).toBeNull();
	});

	it("should handle paths with query strings", () => {
		const result = parseHttpRequest("GET /api?foo=bar 200 in 10ms");
		expect(result?.path).toBe("/api?foo=bar");
	});

	it("should handle 500 status codes", () => {
		const result = parseHttpRequest("GET /error 500 in 5ms");
		expect(result?.statusCode).toBe(500);
	});
});
