// ---------------------------------------------------------------------------
// Unit Tests — asyncHandler.js
// ---------------------------------------------------------------------------
const asyncHandler = require('src/utils/asyncHandler');

describe('asyncHandler', () => {
  test('calls the wrapped handler with req, res, next', (done) => {
    const handler = jest.fn().mockResolvedValue(undefined);
    const wrapped = asyncHandler(handler);

    const req = {};
    const res = {};
    const next = jest.fn();

    wrapped(req, res, next);

    // Give the microtask queue time to flush
    setImmediate(() => {
      expect(handler).toHaveBeenCalledWith(req, res, next);
      done();
    });
  });

  test('catches rejected promise and forwards error to next()', (done) => {
    const error = new Error('DB connection failed');
    const handler = jest.fn().mockRejectedValue(error);
    const wrapped = asyncHandler(handler);

    const req = {};
    const res = {};
    const next = jest.fn();

    wrapped(req, res, next);

    setImmediate(() => {
      expect(next).toHaveBeenCalledWith(error);
      done();
    });
  });

  test('catches thrown error inside async handler and forwards to next()', (done) => {
    const error = new Error('Unexpected throw');
    // Use an async function that throws — Promise.resolve() will catch it
    const handler = jest.fn().mockImplementation(async () => {
      throw error;
    });
    const wrapped = asyncHandler(handler);

    const req = {};
    const res = {};
    const next = jest.fn();

    wrapped(req, res, next);

    setImmediate(() => {
      expect(next).toHaveBeenCalledWith(error);
      done();
    });
  });
});
