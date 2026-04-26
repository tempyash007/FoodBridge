// ---------------------------------------------------------------------------
// Unit Tests — volunteer.controller.js
// ---------------------------------------------------------------------------
const pool = require('src/config/db');
const { getOptimizedRoute, getDistance } = require('src/services/maps.service');

jest.mock('src/config/db', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('src/services/maps.service', () => ({
  getOptimizedRoute: jest.fn(),
  getDistance: jest.fn(),
}));

const {
  getDashboard, getAvailableMissions, acceptMission, getActiveMissions,
  updateMissionStatus, getSchedule, updateSchedule, getLeaderboard, updateLocation,
} = require('src/controllers/volunteer.controller');
const { callController, mockReq, mockRes } = require('tests/helpers');

// Helper to mock getVolunteerId (first query in most controllers)
const mockVolunteerProfile = (id = 'vol-1') => {
  pool.query.mockResolvedValueOnce({ rows: [{ volunteer_id: id }] });
};
const mockNoVolunteerProfile = () => {
  pool.query.mockResolvedValueOnce({ rows: [] });
};

// ═══════════════════════════════════════════════════════════════════════════
// getDashboard
// ═══════════════════════════════════════════════════════════════════════════
describe('getDashboard', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns 404 when volunteer profile not found', async () => {
    mockNoVolunteerProfile();

    const req = mockReq({ user: { userId: 'v1', role: 'volunteer' } });
    const res = mockRes();
    await callController(getDashboard, req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns dashboard with stats', async () => {
    mockVolunteerProfile();
    pool.query
      .mockResolvedValueOnce({
        rows: [{ total_deliveries: 5, avg_rating: '4.5', current_latitude: null, current_longitude: null, meals_saved: 50, impact_deliveries: 5 }],
      })
      .mockResolvedValueOnce({ rows: [{ count: 2 }] })
      .mockResolvedValueOnce({ rows: [] }); // active missions

    const req = mockReq({ user: { userId: 'v1', role: 'volunteer' } });
    const res = mockRes();
    await callController(getDashboard, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          stats: expect.objectContaining({ total_deliveries: 5 }),
          current_deliveries: [],
        }),
      }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getAvailableMissions
// ═══════════════════════════════════════════════════════════════════════════
describe('getAvailableMissions', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns 404 when volunteer profile not found', async () => {
    mockNoVolunteerProfile();

    const req = mockReq({ user: { userId: 'v1', role: 'volunteer' } });
    const res = mockRes();
    await callController(getAvailableMissions, req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns available missions', async () => {
    mockVolunteerProfile();
    pool.query
      .mockResolvedValueOnce({ rows: [{ current_latitude: '12.97', current_longitude: '77.59' }] })
      .mockResolvedValueOnce({
        rows: [{
          claim_id: 'c1', listing_title: 'Rice', quantity: 10, quantity_unit: 'kg',
          estimated_servings: 20, expiry_time: new Date(Date.now() + 7200000),
          donor_org: 'NGO', recipient_org: 'Shelter', pickup_lat: '12.98', pickup_lng: '77.60',
          pickup_address: '123 St',
        }],
      });
    getDistance.mockResolvedValue({ distance_km: 2.5, duration_min: 8 });

    const req = mockReq({ user: { userId: 'v1', role: 'volunteer' } });
    const res = mockRes();
    await callController(getAvailableMissions, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
 });
});

// ═══════════════════════════════════════════════════════════════════════════
// acceptMission
// ═══════════════════════════════════════════════════════════════════════════
describe('acceptMission', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns 404 when volunteer profile not found', async () => {
    mockNoVolunteerProfile();

    const req = mockReq({ params: { claim_id: 'c1' }, user: { userId: 'v1', role: 'volunteer' } });
    const res = mockRes();
    await callController(acceptMission, req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns 404 when claim not found', async () => {
    mockVolunteerProfile();
    pool.query.mockResolvedValueOnce({ rows: [] });

    const req = mockReq({ params: { claim_id: 'nope' }, user: { userId: 'v1', role: 'volunteer' } });
    const res = mockRes();
    await callController(acceptMission, req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns 400 when claim is not approved', async () => {
    mockVolunteerProfile();
    pool.query.mockResolvedValueOnce({
      rows: [{ claim_id: 'c1', listing_id: 'l1', recipient_id: 'r1', status: 'completed' }],
    });

    const req = mockReq({ params: { claim_id: 'c1' }, user: { userId: 'v1', role: 'volunteer' } });
    const res = mockRes();
    await callController(acceptMission, req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 409 when mission already taken', async () => {
    mockVolunteerProfile();
    pool.query
      .mockResolvedValueOnce({ rows: [{ claim_id: 'c1', listing_id: 'l1', recipient_id: 'r1', status: 'approved' }] })
      .mockResolvedValueOnce({ rows: [{ mission_id: 'existing' }] });

    const req = mockReq({ params: { claim_id: 'c1' }, user: { userId: 'v1', role: 'volunteer' } });
    const res = mockRes();
    await callController(acceptMission, req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getActiveMissions
// ═══════════════════════════════════════════════════════════════════════════
describe('getActiveMissions', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns 404 when volunteer profile not found', async () => {
    mockNoVolunteerProfile();

    const req = mockReq({ user: { userId: 'v1', role: 'volunteer' } });
    const res = mockRes();
    await callController(getActiveMissions, req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns active missions list', async () => {
    mockVolunteerProfile();
    pool.query.mockResolvedValueOnce({
      rows: [{ mission_id: 'm1', status: 'assigned', listing_title: 'Rice' }],
    });

    const req = mockReq({ user: { userId: 'v1', role: 'volunteer' } });
    const res = mockRes();
    await callController(getActiveMissions, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// updateMissionStatus
// ═══════════════════════════════════════════════════════════════════════════
describe('updateMissionStatus', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns 404 when volunteer profile not found', async () => {
    mockNoVolunteerProfile();

    const req = mockReq({ params: { mission_id: 'm1' }, body: { status: 'EN_ROUTE' }, user: { userId: 'v1', role: 'volunteer' } });
    const res = mockRes();
    await callController(updateMissionStatus, req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns 400 when status is missing', async () => {
    mockVolunteerProfile();

    const req = mockReq({ params: { mission_id: 'm1' }, body: {}, user: { userId: 'v1', role: 'volunteer' } });
    const res = mockRes();
    await callController(updateMissionStatus, req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 400 when status value is invalid', async () => {
    mockVolunteerProfile();

    const req = mockReq({ params: { mission_id: 'm1' }, body: { status: 'INVALID' }, user: { userId: 'v1', role: 'volunteer' } });
    const res = mockRes();
    await callController(updateMissionStatus, req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 404 when mission not found', async () => {
    mockVolunteerProfile();
    pool.query.mockResolvedValueOnce({ rows: [] });

    const req = mockReq({ params: { mission_id: 'nope' }, body: { status: 'EN_ROUTE' }, user: { userId: 'v1', role: 'volunteer' } });
    const res = mockRes();
    await callController(updateMissionStatus, req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns 403 when volunteer does not own the mission', async () => {
    mockVolunteerProfile('vol-1');
    pool.query.mockResolvedValueOnce({
      rows: [{ mission_id: 'm1', status: 'assigned', claim_id: 'c1', volunteer_id: 'other-vol', listing_id: 'l1', donor_id: 'd1' }],
    });

    const req = mockReq({ params: { mission_id: 'm1' }, body: { status: 'EN_ROUTE' }, user: { userId: 'v1', role: 'volunteer' } });
    const res = mockRes();
    await callController(updateMissionStatus, req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('returns 400 on invalid status transition', async () => {
    mockVolunteerProfile('vol-1');
    pool.query.mockResolvedValueOnce({
      rows: [{ mission_id: 'm1', status: 'assigned', claim_id: 'c1', volunteer_id: 'vol-1', listing_id: 'l1', donor_id: 'd1' }],
    });

    const req = mockReq({ params: { mission_id: 'm1' }, body: { status: 'DELIVERED' }, user: { userId: 'v1', role: 'volunteer' } });
    const res = mockRes();
    await callController(updateMissionStatus, req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('successfully transitions assigned → EN_ROUTE', async () => {
    mockVolunteerProfile('vol-1');
    pool.query.mockResolvedValueOnce({
      rows: [{ mission_id: 'm1', status: 'assigned', claim_id: 'c1', volunteer_id: 'vol-1', listing_id: 'l1', donor_id: 'd1' }],
    });

    const mockClient = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    };
    pool.connect.mockResolvedValue(mockClient);

    const req = mockReq({ params: { mission_id: 'm1' }, body: { status: 'EN_ROUTE' }, user: { userId: 'v1', role: 'volunteer' } });
    const res = mockRes();
    await callController(updateMissionStatus, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getSchedule
// ═══════════════════════════════════════════════════════════════════════════
describe('getSchedule', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns 404 when volunteer profile not found', async () => {
    mockNoVolunteerProfile();

    const req = mockReq({ user: { userId: 'v1', role: 'volunteer' } });
    const res = mockRes();
    await callController(getSchedule, req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns schedule grouped by day of week', async () => {
    mockVolunteerProfile();
    pool.query.mockResolvedValueOnce({
      rows: [
        { availability_id: 'a1', day_of_week: 0, start_time: '09:00:00', end_time: '12:00:00' },
        { availability_id: 'a2', day_of_week: 0, start_time: '14:00:00', end_time: '17:00:00' },
      ],
    });

    const req = mockReq({ user: { userId: 'v1', role: 'volunteer' } });
    const res = mockRes();
    await callController(getSchedule, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const data = res.json.mock.calls[0][0].data;
    expect(data.schedule).toHaveLength(7);
    expect(data.schedule[0].slots).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// updateSchedule
// ═══════════════════════════════════════════════════════════════════════════
describe('updateSchedule', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns 400 when day_of_week is invalid', async () => {
    mockVolunteerProfile();

    const req = mockReq({ user: { userId: 'v1', role: 'volunteer' }, body: { day_of_week: 7, slots: [] } });
    const res = mockRes();
    await callController(updateSchedule, req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 400 when slots is not an array', async () => {
    mockVolunteerProfile();

    const req = mockReq({ user: { userId: 'v1', role: 'volunteer' }, body: { day_of_week: 0, slots: 'nope' } });
    const res = mockRes();
    await callController(updateSchedule, req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('updates schedule and returns 200', async () => {
    mockVolunteerProfile();

    const mockClient = {
      query: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
    };
    pool.connect.mockResolvedValue(mockClient);

    // After transaction, the schedule re-fetch
    pool.query.mockResolvedValueOnce({
      rows: [{ availability_id: 'a1', day_of_week: 1, start_time: '09:00:00', end_time: '12:00:00' }],
    });

    const req = mockReq({
      user: { userId: 'v1', role: 'volunteer' },
      body: { day_of_week: 1, slots: [{ start_time: '09:00', end_time: '12:00' }] },
    });
    const res = mockRes();
    await callController(updateSchedule, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getLeaderboard
// ═══════════════════════════════════════════════════════════════════════════
describe('getLeaderboard', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns rankings with my_rank', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        { user_id: 'other-1', name: 'Alice A.', total_deliveries: 50, points: '1250', rank: '1' },
        { user_id: 'other-2', name: 'Bob B.', total_deliveries: 40, points: '1000', rank: '2' },
        { user_id: 'vol-user-1', name: 'You', total_deliveries: 30, points: '750', rank: '3' },
      ],
    });

    const req = mockReq({ user: { userId: 'vol-user-1', role: 'volunteer' } });
    const res = mockRes();
    await callController(getLeaderboard, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const data = res.json.mock.calls[0][0].data;
    expect(data.top3).toHaveLength(3);
    expect(data.my_rank).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// updateLocation
// ═══════════════════════════════════════════════════════════════════════════
describe('updateLocation', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns 404 when volunteer profile not found', async () => {
    mockNoVolunteerProfile();

    const req = mockReq({ user: { userId: 'v1', role: 'volunteer' }, body: { latitude: 12.97, longitude: 77.59 } });
    const res = mockRes();
    await callController(updateLocation, req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns 400 when coordinates missing', async () => {
    mockVolunteerProfile();

    const req = mockReq({ user: { userId: 'v1', role: 'volunteer' }, body: {} });
    const res = mockRes();
    await callController(updateLocation, req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('updates location and returns ETA', async () => {
    mockVolunteerProfile('vol-1');
    pool.query
      .mockResolvedValueOnce({ rows: [] })  // UPDATE location
      .mockResolvedValueOnce({
        rows: [{ next_stop_name: 'Food Bank', pickup_lat: '12.98', pickup_lng: '77.60' }],
      });
    getDistance.mockResolvedValue({ distance_km: 1.5, duration_min: 5 });

    const req = mockReq({ user: { userId: 'v1', role: 'volunteer' }, body: { latitude: 12.97, longitude: 77.59 } });
    const res = mockRes();
    await callController(updateLocation, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ location_updated: true, next_stop: 'Food Bank', eta_min: 5 }),
      }),
    );
  });
});
