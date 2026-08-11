import { Request, Response, NextFunction } from 'express';

// Simple in-memory metrics (no external dependency needed)
const metrics = {
  requestsTotal: 0,
  requestsByPath: new Map<string, number>(),
  errorsTotal: 0,
  responseTimeSum: 0,
  responseTimeCount: 0,
  startTime: Date.now(),
};

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    metrics.requestsTotal++;
    metrics.responseTimeSum += duration;
    metrics.responseTimeCount++;

    const path = req.path;
    metrics.requestsByPath.set(path, (metrics.requestsByPath.get(path) || 0) + 1);

    if (res.statusCode >= 500) {
      metrics.errorsTotal++;
    }
  });

  next();
}

export function metricsEndpoint(_req: Request, res: Response) {
  const avgResponseTime = metrics.responseTimeCount > 0
    ? Math.round(metrics.responseTimeSum / metrics.responseTimeCount)
    : 0;

  const uptime = (Date.now() - metrics.startTime) / 1000;

  // Prometheus-format text
  const text = [
    '# Counsel API Metrics',
    '# TYPE requests_total counter',
    `requests_total ${metrics.requestsTotal}`,
    '# TYPE errors_total counter',
    `errors_total ${metrics.errorsTotal}`,
    '# TYPE avg_response_time_ms gauge',
    `avg_response_time_ms ${avgResponseTime}`,
    '# TYPE uptime_seconds gauge',
    `uptime_seconds ${uptime}`,
    '',
    '# Requests by path',
    ...Array.from(metrics.requestsByPath.entries()).map(([path, count]) =>
      `requests_by_path{path="${path}"} ${count}`
    ),
  ].join('\n');

  res.setHeader('Content-Type', 'text/plain');
  res.send(text);
}
