const axios = require("axios");

const rapidApiHeaders = {
  "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
  "X-RapidAPI-Host": "trueway-matrix.p.rapidapi.com",
};

// ---------------------------------------------------------------------------
// getDistance
// originLatLng      = { lat, lng }
// destinationLatLng = { lat, lng }
// Returns { distance_km, duration_min }
// ---------------------------------------------------------------------------
const getDistance = async (originLatLng, destinationLatLng) => {
  try {
    const response = await axios.get(
      "https://trueway-matrix.p.rapidapi.com/CalculateDrivingMatrix",
      {
        headers: rapidApiHeaders,
        params: {
          origins: `${originLatLng.lat},${originLatLng.lng}`,        // ← plural
          destinations: `${destinationLatLng.lat},${destinationLatLng.lng}`, // ← plural
        },
      }
    );

    const data = response.data;

    // TrueWay returns distances in meters, durations in seconds — in [0][0]
    const distanceMeters = data?.distances?.[0]?.[0] ?? 0;
    const durationSeconds = data?.durations?.[0]?.[0] ?? 0;

    return {
      distance_km: parseFloat((distanceMeters / 1000).toFixed(1)),
      duration_min: Math.round(durationSeconds / 60),
    };
  } catch (err) {
    console.error("RapidAPI Distance Matrix error:", err.response?.data || err.message);
    const error = new Error("Route service unavailable");
    error.status = 503;
    throw error;
  }
};

// ---------------------------------------------------------------------------
// getOptimizedRoute
// originLatLng   = { lat, lng }
// waypointsArray = [{ lat, lng, name?, type?, address? }, ...]
// Returns { stops, total_km, est_duration_min, polyline }
// ---------------------------------------------------------------------------
const getOptimizedRoute = async (originLatLng, waypointsArray) => {
  if (!waypointsArray || waypointsArray.length === 0) {
    return { stops: [], total_km: 0, est_duration_min: 0, polyline: null };
  }

  try {
    let total_km = 0;
    let est_duration_min = 0;

    // Full sequence: origin → wp[0] → wp[1] → ...
    const allPoints = [originLatLng, ...waypointsArray];

    for (let i = 0; i < allPoints.length - 1; i++) {
      const leg = await getDistance(allPoints[i], allPoints[i + 1]);
      total_km += leg.distance_km ?? 0;
      est_duration_min += leg.duration_min ?? 0;
    }

    const stops = waypointsArray.map((wp) => ({
      name: wp.name || "",
      type: wp.type || "",        // "PICKUP" or "DELIVER"
      address: wp.address || "",
      lat: wp.lat,
      lng: wp.lng,
    }));

    return {
      stops,
      total_km: parseFloat(total_km.toFixed(1)),
      est_duration_min: Math.round(est_duration_min),
      polyline: null,             // frontend handles map display
    };
  } catch (err) {
    if (err.message === "Route service unavailable") throw err;
    console.error("getOptimizedRoute error:", err.message);
    const error = new Error("Route service unavailable");
    error.status = 503;
    throw error;
  }
};

module.exports = { getDistance, getOptimizedRoute };