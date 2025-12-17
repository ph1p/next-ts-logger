import { prefixes } from "next/dist/build/output/log";
import type { HttpRequestLog, LogLevel, ParsedLog } from "./types";

// biome-ignore lint/suspicious/noControlCharactersInRegex: Required for ANSI escape sequence matching
const ANSI_REGEX = /\x1b\[[0-9;]*m/g;

const HTTP_REQUEST_REGEX =
	/^(\w+)\s+(\S+)\s+(\d+)\s+in\s+([\d.]+(?:ms|s))(?:\s+\(([^)]+)\))?$/;

const PREFIX_TO_LEVEL: Record<string, LogLevel> = {
	[prefixes.wait]: "info",
	[prefixes.error]: "error",
	[prefixes.warn]: "warn",
	[prefixes.ready]: "info",
	[prefixes.info]: "info",
	[prefixes.event]: "info",
	[prefixes.trace]: "trace",
};

export function stripAnsi(str: string): string {
	return str.replace(ANSI_REGEX, "");
}

export function argsToMessage(args: unknown[]): string {
	return args
		.map((a) => (typeof a === "string" ? stripAnsi(a) : String(a)))
		.join(" ")
		.trim();
}

function parseTime(time: string): number {
	return time.endsWith("ms")
		? parseFloat(time.slice(0, -2))
		: parseFloat(time.slice(0, -1)) * 1000;
}

function parseBreakdown(breakdown: string): Record<string, number> {
	return Object.fromEntries(
		breakdown
			.split(",")
			.map((part) => part.split(":").map((s) => s.trim()))
			.filter(([key, value]) => key && value)
			.map(([key, value]) => [key, parseTime(value)]),
	);
}

function findPrefix(str: string): LogLevel | null {
	if (!str.startsWith(" ")) return null;

	const afterSpace = str.slice(1);
	for (const [prefix, level] of Object.entries(PREFIX_TO_LEVEL)) {
		if (afterSpace.startsWith(prefix)) return level;
	}
	return null;
}

export function parseHttpRequest(str: string): HttpRequestLog | null {
	const match = str.match(HTTP_REQUEST_REGEX);
	if (!match) return null;

	const [, method, path, statusCode, duration, breakdown] = match;
	return {
		method,
		path,
		statusCode: parseInt(statusCode, 10),
		duration: parseTime(duration),
		...(breakdown && { breakdown: parseBreakdown(breakdown) }),
	};
}

export function parseNextLog(args: unknown[]): ParsedLog | null {
	if (args.length === 0 || typeof args[0] !== "string") return null;

	const firstArg = args[0];
	const stripped = stripAnsi(firstArg);

	// Next.js bootstrap format: "   <message>" (3 spaces)
	if (stripped.startsWith("   ") && stripped[3] !== " ") {
		return { type: "message", level: "info", message: argsToMessage(args) };
	}

	// HTTP request format: "GET /path 200 in 3.1s"
	const httpLog = parseHttpRequest(stripped);
	if (httpLog) return { type: "http", data: httpLog };

	// Prefixed log format: " <prefix> <message>"
	const level = findPrefix(firstArg);
	if (level) return { type: "message", level, message: argsToMessage(args) };

	return null;
}
