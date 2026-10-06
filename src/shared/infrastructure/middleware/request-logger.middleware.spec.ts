import { Logger } from '@nestjs/common';
import { RequestLoggerMiddleware } from './request-logger.middleware';

describe('RequestLoggerMiddleware', () => {
  it('logs method, path, status code, and duration once the response finishes', () => {
    const middleware = new RequestLoggerMiddleware();
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();

    const handlers: Record<string, () => void> = {};
    const req = { method: 'GET', originalUrl: '/catalog/products' };
    const res = {
      statusCode: 200,
      on: (event: string, handler: () => void) => {
        handlers[event] = handler;
      },
    };
    const next = jest.fn();

    middleware.use(req as never, res as never, next);
    expect(next).toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();

    handlers.finish();

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^GET \/catalog\/products 200 \d+ms$/),
    );

    logSpy.mockRestore();
  });
});
