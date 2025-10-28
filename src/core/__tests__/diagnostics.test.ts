import { describe, expect, it, vi, beforeEach } from 'vitest';
import { logDiagnostic, type DiagnosticsConfig } from '../diagnostics';
import * as internalConfig from '../../internal.config';

describe('Diagnostics', () => {
	let logSpy: any;

	beforeEach(() => {
		logSpy = vi.spyOn(internalConfig, 'log');
	});

	it('should not log when diagnostics is disabled', () => {
		const config: DiagnosticsConfig = {
			enabled: false,
		};

		logDiagnostic(config, 'test-stage', 'testService', 'testAction');

		expect(logSpy).not.toHaveBeenCalled();
	});

	it('should log with minimal level by default', () => {
		const config: DiagnosticsConfig = {
			enabled: true,
		};

		logDiagnostic(config, 'test-stage', 'testService', 'testAction', {
			duration: 100,
			status: true,
		});

		expect(logSpy).toHaveBeenCalledOnce();
		const call: any = logSpy.mock.calls[0][0];
		expect(call.atFunction).toBe('logDiagnostic');
		expect(call.message).toBe('[test-stage] testService.testAction');
		expect(call.data.stage).toBe('test-stage');
		expect(call.data.service).toBe('testService');
		expect(call.data.action).toBe('testAction');
		expect(call.data.duration_ms).toBe(100);
		expect(call.data.status).toBe(true);
	});

	it('should include hook name in detailed level', () => {
		const config: DiagnosticsConfig = {
			enabled: true,
			logLevel: 'detailed',
		};

		logDiagnostic(config, 'before-hook', 'testService', 'testAction', {
			hookName: 'validatePayload',
			duration: 50,
			status: true,
		});

		expect(logSpy).toHaveBeenCalledOnce();
		const call: any = logSpy.mock.calls[0][0];
		expect(call.data.hookName).toBe('validatePayload');
		expect(call.data.duration_ms).toBe(50);
	});

	it('should include everything in verbose level', () => {
		const config: DiagnosticsConfig = {
			enabled: true,
			logLevel: 'verbose',
		};

		const details = {
			hookName: 'validatePayload',
			duration: 50,
			status: true,
			customField: 'custom value',
		};

		logDiagnostic(config, 'before-hook', 'testService', 'testAction', details);

		expect(logSpy).toHaveBeenCalledOnce();
		const call: any = logSpy.mock.calls[0][0];
		expect(call.data.details).toEqual(details);
	});

	it('should not include timings when includeTimings is false', () => {
		const config: DiagnosticsConfig = {
			enabled: true,
			includeTimings: false,
		};

		logDiagnostic(config, 'test-stage', 'testService', 'testAction', {
			duration: 100,
			status: true,
		});

		expect(logSpy).toHaveBeenCalledOnce();
		const call: any = logSpy.mock.calls[0][0];
		expect(call.data.duration_ms).toBeUndefined();
		expect(call.data.status).toBe(true);
	});

	it('should include payloads when explicitly enabled', () => {
		const config: DiagnosticsConfig = {
			enabled: true,
			includePayloads: true,
		};

		const payload = { username: 'test', email: 'test@example.com' };

		logDiagnostic(config, 'test-stage', 'testService', 'testAction', {
			payload,
			status: true,
		});

		expect(logSpy).toHaveBeenCalledOnce();
		const call: any = logSpy.mock.calls[0][0];
		expect(call.data.payload).toEqual(payload);
	});

	it('should not include payloads by default', () => {
		const config: DiagnosticsConfig = {
			enabled: true,
		};

		const payload = { username: 'test', email: 'test@example.com' };

		logDiagnostic(config, 'test-stage', 'testService', 'testAction', {
			payload,
			status: true,
		});

		expect(logSpy).toHaveBeenCalledOnce();
		const call: any = logSpy.mock.calls[0][0];
		expect(call.data.payload).toBeUndefined();
	});

	it('should handle undefined config gracefully', () => {
		logDiagnostic(undefined, 'test-stage', 'testService', 'testAction');

		expect(logSpy).not.toHaveBeenCalled();
	});

	it('should log errors with detailed information', () => {
		const config: DiagnosticsConfig = {
			enabled: true,
			logLevel: 'detailed',
		};

		logDiagnostic(config, 'execution-error', 'testService', 'testAction', {
			duration: 100,
			status: false,
			error: 'Something went wrong',
		});

		expect(logSpy).toHaveBeenCalledOnce();
		const call: any = logSpy.mock.calls[0][0];
		expect(call.data.status).toBe(false);
		expect(call.data.error).toBe('Something went wrong');
	});
});

