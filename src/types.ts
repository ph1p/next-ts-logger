export type LogLevel = "info" | "warn" | "error" | "trace";

export interface HttpRequestLog {
	method: string;
	path: string;
	statusCode: number;
	duration: number;
	breakdown?: Record<string, number>;
}

export type ParsedLog =
	| {
			type: "message";
			level: LogLevel;
			message: string;
	  }
	| {
			type: "http";
			data: HttpRequestLog;
	  };

/**
 * Common logger interface compatible with Pino and Winston.
 * Both loggers support these methods natively.
 */
export interface Logger {
	info(obj: object, msg?: string): void;
	info(msg: string): void;
	warn(obj: object, msg?: string): void;
	warn(msg: string): void;
	error(obj: object, msg?: string): void;
	error(msg: string): void;
	trace(obj: object, msg?: string): void;
	trace(msg: string): void;
	child(bindings: Record<string, unknown>): Logger;
}
