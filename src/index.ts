import { interceptConsole, interceptStdout } from "./interceptor";
import type { Logger } from "./types";

export { parseHttpRequest, parseNextLog, stripAnsi } from "./parser";
export type { HttpRequestLog, Logger, LogLevel, ParsedLog } from "./types";

export function createNextLogger(logger: Logger): void {
	const nextLogger = logger.child({ name: "next.js" });
	interceptConsole(nextLogger);
	interceptStdout(nextLogger);
}
