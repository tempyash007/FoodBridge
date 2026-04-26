// ---------------------------------------------------------------------------
// Unit Tests — maps.service.js
// ---------------------------------------------------------------------------
const axios = require('axios');

jest.mock('axios');

const { getDistance, getOptimizedRoute } = require('src/services/maps.service');

describe('getDistance', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns correct distance_km and duration_min', async () => {
    axios.get.mockResolvedValue({
      data: {
        distances: [[5000]],   // 5000 meters
        durations: [[600]],    // 600 seconds
      },
    });

    const result = await getDistance(
      { lat: 12.97, lng: 77.59 },
      { lat: 12.99, lng: 77.61 },
    );

    expect(result.distance_km).toBe(5.0);
    expect(result.duration_min).toBe(10);
  });

  test('throws 503 error on API failure', async () => {
    axios.get.mockRejectedValue(new Error('Network Error'));

    await expect(
      getDistance({ lat: 0, lng: 0 }, { lat: 1, lng: 1 }),
    ).rejects.toThrow('Route service unavailable');
  });

  test('handles zero distance response', async () => {
    axios.get.mockResolvedValue({
      data: {
        distances: [[0]],
        durations: [[0]],
      },
    });

    const result = await getDistance(
      { lat: 12.97, lng: 77.59 },
      { lat: 12.97, lng: 77.59 },
    );

    expect(result.distance_km).toBe(0);
    expect(result.duration_min).toBe(0);
  });

  test('handles missing response fields gracefully', async () => {
    axios.get.mockResolvedValue({ data: {} });

    const result = await getDistance(
      { lat: 12.97, lng: 77.59 },
      { lat: 12.99, lng: 77.61 },
    );

    expect(result.distance_km).toBe(0);
    expect(result.duration_min).toBe(0);
  });

  test('passes correct headers and params to RapidAPI', async () => {
    axios.get.mockResolvedValue({
      data: { distances: [[1000]], durations: [[60]] },
    });

    await getDistance({ lat: 10, lng: 20 }, { lat: 30, lng: 40 });

    expect(axios.get).toHaveBeenCalledWith(
      'https://trueway-matrix.p.rapidapi.com/CalculateDrivingMatrix',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
        }),
        params: {
          origins: '10,20',
          destinations: '30,40',
        },
      }),
    );
  });
});

describe('getOptimizedRoute', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns empty result for no waypoints', async () => {
    const result = await getOptimizedRoute({ lat: 0, lng: 0 }, []);

    expect(result).toEqual({
      stops: [],
      total_km: 0,
      est_duration_min: 0,
      polyline: null,
    });
    expect(axios.get).not.toHaveBeenCalled();
  });

  test('returns empty result for null waypoints', async () => {
    const result = await getOptimizedRoute({ lat: 0, lng: 0 }, null);

    expect(result.stops).toEqual([]);
    expect(result.total_km).toBe(0);
  });

  test('sums distance and duration across multiple legs', async () => {
    // Leg 1: origin → wp1 = 3km, 5min
    // Leg 2: wp1 → wp2 = 7km, 12min
    axios.get
      .mockResolvedValueOnce({ data: { distances: [[3000]], durations: [[300]] } })
      .mockResolvedValueOnce({ data: { distances: [[7000]], durations: [[720]] } });

    const result = await getOptimizedRoute(
      { lat: 0, lng: 0 },
      [
        { lat: 1, lng: 1, name: 'Pickup A', type: 'PICKUP', address: '123 St' },
        { lat: 2, lng: 2, name: 'Deliver B', type: 'DELIVER', address: '456 Ave' },
      ],
    );

    expect(result.total_km).toBe(10.0);
    expect(result.est_duration_min).toBe(17);
    expect(result.stops).toHaveLength(2);
  });

  test('builds correct stops array structure', async () => {
    axios.get.mockResolvedValue({
      data: { distances: [[2000]], durations: [[180]] },
    });

    const result = await getOptimizedRoute(
      { lat: 0, lng: 0 },
      [{ lat: 1, lng: 1, name: 'Food Bank', type: 'DELIVER', address: '789 Blvd' }],
    );

    expect(result.stops[0]).toEqual({
      name: 'Food Bank',
      type: 'DELIVER',
      address: '789 Blvd',
      lat: 1,
      lng: 1,
    });
    expect(result.polyline).toBeNull();
  });

  test('throws 503 error on API failure', async () => {
    axios.get.mockRejectedValue(new Error('Network Error'));

    await expect(
      getOptimizedRoute(
        { lat: 0, lng: 0 },
        [{ lat: 1, lng: 1 }],
      ),
    ).rejects.toThrow('Route service unavailable');
  });
});
