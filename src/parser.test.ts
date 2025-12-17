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
});
