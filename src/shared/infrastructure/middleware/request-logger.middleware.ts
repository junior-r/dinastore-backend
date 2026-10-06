import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

// Nest's own Logger only prints lifecycle events (module init, route
// mapping) and whatever application code explicitly logs -- there's no
// per-request access log by default, unlike Express+morgan or FastAPI+
// uvicorn. This fills that gap without adding a dependency.
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const { method, originalUrl } = req;
    const start = Date.now();

    res.on('finish', () => {
      const durationMs = Date.now() - start;
      this.logger.log(
        `${method} ${originalUrl} ${res.statusCode} ${durationMs}ms`,
      );
    });

    next();
  }
}
