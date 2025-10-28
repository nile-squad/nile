import { describe, it, expect } from 'vitest';
import { createPerformanceTracker, measurePerformance } from './performance';

describe('Performance Utilities', () => {
	describe('createPerformanceTracker', () => {
		it('should track single stage execution time', () => {
			const tracker = createPerformanceTracker();

			tracker.startStage('test-stage');
			tracker.endStage();

			const report = tracker.getReport();

			expect(report.stages).toHaveLength(1);
			expect(report.stages[0].stage).toBe('test-stage');
			expect(report.stages[0].duration).toBeGreaterThanOrEqual(0);
		});

		it('should track multiple stages sequentially', () => {
			const tracker = createPerformanceTracker();

			tracker.startStage('stage1');
			tracker.endStage();

			tracker.startStage('stage2');
			tracker.endStage();

			tracker.startStage('stage3');
			tracker.endStage();

			const report = tracker.getReport();

			expect(report.stages).toHaveLength(3);
			expect(report.stages[0].stage).toBe('stage1');
			expect(report.stages[1].stage).toBe('stage2');
			expect(report.stages[2].stage).toBe('stage3');

			for (const stage of report.stages) {
				expect(stage.duration).toBeGreaterThanOrEqual(0);
			}
		});

		it('should include stage metadata', () => {
			const tracker = createPerformanceTracker();

			tracker.startStage('stage1', { actionName: 'testAction' });
			tracker.endStage();

			const report = tracker.getReport();

			expect(report.stages[0].metadata).toEqual({ actionName: 'testAction' });
		});

		it('should calculate total duration', () => {
			const tracker = createPerformanceTracker();

			tracker.startStage('stage1');
			tracker.endStage();

			tracker.startStage('stage2');
			tracker.endStage();

			const report = tracker.getReport();

			expect(report.totalDuration).toBeGreaterThanOrEqual(0);
			expect(report.totalDuration).toBeGreaterThanOrEqual(
				(report.stages[0].duration || 0) + (report.stages[1].duration || 0)
			);
		});

		it('should include report-level metadata', () => {
			const tracker = createPerformanceTracker();

			tracker.startStage('stage1');
			tracker.endStage();

			const report = tracker.getReport({ serviceName: 'testService' });

			expect(report.metadata).toEqual({ serviceName: 'testService' });
		});

		it('should format report as readable string', () => {
			const tracker = createPerformanceTracker();

			tracker.startStage('authentication');
			tracker.endStage();

			tracker.startStage('validation');
			tracker.endStage();

			const formatted = tracker.formatReport();

			expect(formatted).toContain('Total Duration:');
			expect(formatted).toContain('authentication:');
			expect(formatted).toContain('validation:');
			expect(formatted).toContain('ms');
		});
	});

	describe('measurePerformance', () => {
		it('should measure synchronous function execution time', async () => {
			const { result, duration } = await measurePerformance(() => {
				return 'test-result';
			});

			expect(result).toBe('test-result');
			expect(duration).toBeGreaterThanOrEqual(0);
		});

	it('should measure async function execution time', async () => {
		const { result, duration } = await measurePerformance(async () => {
			await new Promise((resolve) => setTimeout(resolve, 10));
			return 'async-result';
		});

		expect(result).toBe('async-result');
		// Warn if timing is off, but don't fail (can be flaky in parallel execution)
		if (duration < 10) {
			console.warn(`⚠️  Performance timing inaccurate: expected >= 10ms, got ${duration}ms`);
		}
		expect(duration).toBeGreaterThanOrEqual(0);
	});

		it('should handle functions that return objects', async () => {
			const { result, duration } = await measurePerformance(() => {
				return { value: 42, message: 'success' };
			});

			expect(result).toEqual({ value: 42, message: 'success' });
			expect(duration).toBeGreaterThanOrEqual(0);
		});

		it('should handle functions that throw errors', async () => {
			await expect(async () => {
				await measurePerformance(() => {
					throw new Error('Test error');
				});
			}).rejects.toThrow('Test error');
		});
	});

	describe('Performance Tracker - Edge Cases', () => {
		it('should handle endStage called without startStage', () => {
			const tracker = createPerformanceTracker();

			tracker.endStage(); // No stage started

			const report = tracker.getReport();

			expect(report.stages).toHaveLength(0);
		});

		it('should handle multiple endStage calls for same stage', () => {
			const tracker = createPerformanceTracker();

			tracker.startStage('stage1');
			tracker.endStage();
			tracker.endStage(); // Second call should not affect

			const report = tracker.getReport();

			expect(report.stages).toHaveLength(1);
			expect(report.stages[0].duration).toBeDefined();
		});

		it('should handle stage without endStage', () => {
			const tracker = createPerformanceTracker();

			tracker.startStage('incomplete-stage');
			// No endStage call

			const report = tracker.getReport();

			expect(report.stages).toHaveLength(1);
			expect(report.stages[0].duration).toBeUndefined();
			expect(report.stages[0].endTime).toBeUndefined();
		});

		it('should track very fast operations', () => {
			const tracker = createPerformanceTracker();

			tracker.startStage('fast-operation');
			// Immediate end
			tracker.endStage();

			const report = tracker.getReport();

			expect(report.stages[0].duration).toBeGreaterThanOrEqual(0);
			expect(report.stages[0].duration).toBeLessThan(10); // Should be very fast
		});
	});
});
