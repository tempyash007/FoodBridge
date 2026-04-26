// ---------------------------------------------------------------------------
// Unit Tests — category.controller.js
// ---------------------------------------------------------------------------
const pool = require('src/config/db');

jest.mock('src/config/db', () => ({ query: jest.fn() }));

const { getCategories } = require('src/controllers/category.controller');

// ── Helpers ──────────────────────────────────────────────────────────────────
const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = jest.fn();
const callController = async (ctrl, req, res) => await ctrl(req, res, mockNext);

describe('getCategories (public)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns all categories ordered by name', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        { category_id: 'c1', name: 'Dairy', icon_url: '/icons/dairy.png' },
        { category_id: 'c2', name: 'Grains', icon_url: '/icons/grains.png' },
      ],
    });

    const req = {};
    const res = mockRes();

    await callController(getCategories, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: {
          categories: expect.arrayContaining([
            expect.objectContaining({ name: 'Dairy' }),
            expect.objectContaining({ name: 'Grains' }),
          ]),
        },
        message: 'Categories fetched successfully',
      }),
    );
  });

  test('returns empty array when no categories exist', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const req = {};
    const res = mockRes();

    await callController(getCategories, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { categories: [] },
      }),
    );
  });

  test('propagates DB error via asyncHandler', async () => {
    pool.query.mockRejectedValue(new Error('Connection refused'));

    const req = {};
    const res = mockRes();

    await callController(getCategories, req, res);

    expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
  });
});
