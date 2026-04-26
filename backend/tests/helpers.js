// ---------------------------------------------------------------------------
// Shared Test Helpers
// ---------------------------------------------------------------------------

/**
 * Mock Express Response object with chainable methods
 */
const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  res.set = jest.fn().mockReturnValue(res);
  return res;
};

/**
 * Mock Express Request object
 */
const mockReq = (overrides = {}) => ({
  body: {},
  params: {},
  query: {},
  cookies: {},
  headers: {},
  user: null,
  ...overrides,
});

/**
 * Call an asyncHandler-wrapped controller and properly wait for it to finish.
 *
 * asyncHandler returns (req, res, next) => { Promise.resolve(fn(...)).catch(next) }
 * — it does NOT return the promise. So `await controller(req, res, next)` returns
 * immediately. We work around this by creating our own promise that resolves when
 * res.json/res.send is called OR when next(err) is called.
 */
const callController = (controller, req, res) => {
  return new Promise((resolve) => {
    const originalJson = res.json;
    const originalSend = res.send;

    // Resolve when json() is called (success path)
    res.json = jest.fn((...args) => {
      originalJson(...args);
      resolve();
      return res;
    });

    // Resolve when send() is called (CSV export path)
    res.send = jest.fn((...args) => {
      originalSend(...args);
      resolve();
      return res;
    });

    // next() = error path
    const next = jest.fn((err) => {
      resolve(err);
    });

    controller(req, res, next);
  });
};

module.exports = { mockReq, mockRes, callController };
