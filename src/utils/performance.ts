/**
 * Performance measurement utilities for tracking execution time
 */

export type PerformanceMetrics = {
  startTime: number;
  endTime?: number;
  duration?: number;
  stage: string;
  metadata?: Record<string, any>;
};

export type PerformanceReport = {
  totalDuration: number;
  stages: PerformanceMetrics[];
  metadata?: Record<string, any>;
};

/**
 * Create a performance tracker for measuring execution stages
 */
export function createPerformanceTracker() {
  const stages: PerformanceMetrics[] = [];
  const startTime = performance.now();

  return {
    /**
     * Mark the start of a stage
     */
    startStage(stage: string, metadata?: Record<string, any>): void {
      stages.push({
        stage,
        startTime: performance.now(),
        metadata,
      });
    },

    /**
     * Mark the end of the current stage
     */
    endStage(): void {
      const currentStage = stages.at(-1);
      if (currentStage && !currentStage.endTime) {
        currentStage.endTime = performance.now();
        currentStage.duration = currentStage.endTime - currentStage.startTime;
      }
    },

    /**
     * Get the full performance report
     */
    getReport(metadata?: Record<string, any>): PerformanceReport {
      const endTime = performance.now();
      return {
        totalDuration: endTime - startTime,
        stages,
        metadata,
      };
    },

    /**
     * Get formatted report as string
     */
    formatReport(): string {
      const report = this.getReport();
      const lines = [
        `Total Duration: ${report.totalDuration.toFixed(2)}ms`,
        '',
        'Stages:',
      ];

      for (const stage of report.stages) {
        const duration = stage.duration ? stage.duration.toFixed(2) : 'N/A';
        lines.push(`  - ${stage.stage}: ${duration}ms`);
      }

      return lines.join('\n');
    },
  };
}

/**
 * Simple performance measurement wrapper
 */
export async function measurePerformance<T>(
  fn: () => T | Promise<T>
): Promise<{ result: T; duration: number }> {
  const startTime = performance.now();
  const result = await fn();
  const endTime = performance.now();
  const duration = endTime - startTime;

  return { result, duration };
}
