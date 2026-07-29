import { Request, Response, NextFunction } from 'express';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  requestId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  durationMs?: number;
  userId?: string;
  firmId?: string;
  error?: string;
  [key: string]: any;
}

const stdoutJson = (entry: LogEntry) => {
  process.stdout.write(JSON.stringify(entry) + '\n');
};

export const log = {
  debug(msg: string, meta?: Record<string, any>) {
    stdoutJson({ level: 'debug', message: msg, timestamp: new Date().toISOString(), ...meta });
  },
  info(msg: string, meta?: Record<string, any>) {
    stdoutJson({ level: 'info', message: msg, timestamp: new Date().toISOString(), ...meta });
  },
  warn(msg: string, meta?: Record<string, any>) {
    stdoutJson({ level: 'warn', message: msg, timestamp: new Date().toISOString(), ...meta });
  },
  error(msg: string, meta?: Record<string, any>) {
    stdoutJson({ level: 'error', message: msg, timestamp: new Date().toISOString(), ...meta });
  },
};

let store: { getRequestId?: () => string | undefined } = {};

export function setStore(s: typeof store) {
  store = s;
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const requestId = ((req as any).requestId as string) || undefined;
  const userId = ((req as any).userId as string) || undefined;
  const firmId = ((req as any).firmId as string) || undefined;

  log.info(`${req.method} ${req.path}`, {
    requestId,
    method: req.method,
    path: req.path,
    userId,
    firmId,
    ip: req.ip,
  });

  const _end = res.end;
  res.end = function (this: Response, ...args: any[]) {
    const durationMs = Date.now() - start;
    const statusCode = res.statusCode;

    if (statusCode >= 500) {
      log.error(`${req.method} ${req.path} ${statusCode} (${durationMs}ms)`, {
        requestId, method: req.method, path: req.path, statusCode, durationMs, userId, firmId,
      });
    } else if (statusCode >= 400) {
      log.warn(`${req.method} ${req.path} ${statusCode} (${durationMs}ms)`, {
        requestId, method: req.method, path: req.path, statusCode, durationMs, userId, firmId,
      });
    } else {
      log.info(`${req.method} ${req.path} ${statusCode} (${durationMs}ms)`, {
        requestId, method: req.method, path: req.path, statusCode, durationMs, userId, firmId,
      });
    }

    return _end.apply(this, args as any);
  } as typeof res.end;

  next();
}
