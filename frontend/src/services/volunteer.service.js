import { fetchWithAuth } from './api';

export const volunteerService = {
    getDashboard: async () => {
        const response = await fetchWithAuth('/volunteer/dashboard');
        if (!response.ok) throw new Error('Failed to fetch volunteer dashboard');
        const data = await response.json();
        return data.data;
    },

    getAvailableMissions: async () => {
        const response = await fetchWithAuth('/volunteer/missions/available');
        if (!response.ok) throw new Error('Failed to fetch available missions');
        const data = await response.json();
        return data.data;
    },

    getActiveMissions: async () => {
        const response = await fetchWithAuth('/volunteer/missions/active');
        if (!response.ok) throw new Error('Failed to fetch active missions');
        const data = await response.json();
        return data.data;
    },

    acceptMission: async (claimId) => {
        const response = await fetchWithAuth(`/volunteer/missions/${claimId}/accept`, {
            method: 'POST'
        });
        if (!response.ok) throw new Error('Failed to accept mission');
        const data = await response.json();
        return data.data;
    },

    updateMissionStatus: async (missionId, status) => {
        const response = await fetchWithAuth(`/volunteer/missions/${missionId}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
        });
        if (!response.ok) throw new Error('Failed to update mission status');
        const data = await response.json();
        return data.data;
    },

    getSchedule: async () => {
        const response = await fetchWithAuth('/volunteer/schedule');
        if (!response.ok) throw new Error('Failed to fetch schedule');
        const data = await response.json();
        return data.data;
    },

    updateSchedule: async (scheduleData) => {
        const response = await fetchWithAuth('/volunteer/schedule', {
            method: 'PUT',
            body: JSON.stringify(scheduleData)
        });
        if (!response.ok) throw new Error('Failed to update schedule');
        const data = await response.json();
        return data.data;
    },

    getLeaderboard: async () => {
        const response = await fetchWithAuth('/volunteer/leaderboard');
        if (!response.ok) throw new Error('Failed to fetch leaderboard');
        const data = await response.json();
        return data.data;
    }
};
