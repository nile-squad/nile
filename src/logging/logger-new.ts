import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { nanoid } from "nanoid";
import pino, { type Logger, type TransportMultiOptions } from "pino";

export type Log = {
	atFunction: string;
	appName: string;
	message: string;
	data?: Record<string, any>;
	type?: "info" | "warn" | "error";
	log_id?: string;
};

const mode = process.env.MODE || "dev";
const logDir = join(process.cwd(), "logs");
const logFile = join(logDir, "app.log");

if (!existsSync(logDir)) {
	mkdirSync(logDir);
}

const transportOptions: TransportMultiOptions =
	mode === "dev"
		? {
				targets: [
					{
						level: "info",
						target: "pino-pretty",
						options: {
							colorize: true,
							translateTime: "yyyy-mm-dd HH:MM:ss.l",
							ignore: "pid,hostname",
						},
					},
				],
			}
		: {
				targets: [
					{
						level: "info",
						target: "pino/file",
						options: {
							destination: logFile,
							mkdir: true,
						},
					},
				],
			};

const transport = pino.transport(transportOptions);

const logger: Logger = pino(
	{
		base: null,
		timestamp: () => `,"time":"${new Date().toISOString()}"`,
		formatters: {
			level(label) {
				return { level: label };
			},
		},
	},
	transport,
);

/**
 * Creates a new log entry with the provided log information
 * @param {Log} log - The log object containing the log details
 * @returns {string} The generated log ID
 * @throws {Error} If appName is missing in the log object
 */
export function createLog(log: Log): string {
	if (!log.appName) {
		throw new Error(`Missing appName in log: ${JSON.stringify(log)}`);
	}

	const type = log.type || "info";
	const log_id = log.log_id || nanoid(6);

	const logRecord = {
		log_id,
		appName: log.appName,
		atFunction: log.atFunction,
		message: log.message,
		data: log.data ?? null,
	};

	logger[type as "info" | "warn" | "error"](logRecord);

	return log_id;
}

type LogFilter = {
	appName?: string;
	log_id?: string;
	type?: "info" | "warn" | "error";
	from?: Date;
	to?: Date;
};

/**
 * Retrieves logs based on the provided filters
 * @param {LogFilter} filters - Optional filters to apply when retrieving logs
 * @returns {Log[]} An array of log entries matching the filters
 */
export function getLogs(filters: LogFilter = {}): Log[] {
	if (!existsSync(logFile)) {
		return [];
	}

	const content = readFileSync(logFile, "utf-8");
	const lines = content.trim().split("\n");

	const logs = lines
		.map((line) => {
			try {
				return JSON.parse(line);
			} catch {
				return null;
			}
		})
		.filter(Boolean)
		.filter((log) => {
			if (filters.appName && log.appName !== filters.appName) {
				return false;
			}
			if (filters.log_id && log.log_id !== filters.log_id) {
				return false;
			}
			if (filters.type && log.level !== filters.type) {
				return false;
			}

			const time = new Date(log.time);
			if (filters.from && time < filters.from) {
				return false;
			}
			if (filters.to && time > filters.to) {
				return false;
			}

			return true;
		});

	return logs;
}
