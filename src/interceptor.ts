import { parseHttpRequest, parseNextLog, stripAnsi } from "./parser";
import type { Logger, ParsedLog } from "./types";

function logParsed(logger: Logger, parsed: ParsedLog): void {
	if (parsed.type === "http") {
		logger.info(parsed.data, "HTTP request");
	} else {
		logger[parsed.level](parsed.message);
	}
}

function wrapConsole(
	original: typeof console.log,
	logger: Logger,
): (...args: unknown[]) => void {
	return (...args: unknown[]) => {
		const parsed = parseNextLog(args);
		if (parsed) {
			logParsed(logger, parsed);
		} else {
			original(...args);
		}
	};
}

export function interceptConsole(logger: Logger): void {
	console.log = wrapConsole(console.log.bind(console), logger);
	console.warn = wrapConsole(console.warn.bind(console), logger);
	console.error = wrapConsole(console.error.bind(console), logger);
}

export function interceptStdout(logger: Logger): void {
	const originalWrite = process.stdout.write.bind(process.stdout);

	process.stdout.write = ((
		chunk: Uint8Array | string,
		encodingOrCallback?: BufferEncoding | ((err?: Error | null) => void),
		callback?: (err?: Error | null) => void,
	): boolean => {
		const str = typeof chunk === "string" ? chunk : chunk.toString();
		const httpLog = parseHttpRequest(stripAnsi(str).trim());

		if (httpLog) {
			logger.info(httpLog, "HTTP request");
			return true;
		}

		return originalWrite(chunk, encodingOrCallback as BufferEncoding, callback);
	}) as typeof process.stdout.write;
}
