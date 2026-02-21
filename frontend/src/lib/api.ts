import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const client = axios.create({
    baseURL: API_URL,
});

// Attach JWT token to every request
client.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    }
    return config;
});

export const api = {
    // Token management
    getToken: () => (typeof window !== 'undefined' ? localStorage.getItem('token') : null),
    clearToken: () => {
        if (typeof window !== 'undefined') localStorage.removeItem('token');
    },

    // ── Auth ──────────────────────────────────────────────────────────

    /** Get nonce + sign-message for an address */
    getNonce: async (address: string): Promise<{ nonce: string; message: string }> => {
        const res = await client.get('/auth/nonce', { params: { address } });
        return res.data;
    },

    /** Verify signature — backend recovers signer, no address comparison */
    verifySignature: async (signature: string, nonce: string) => {
        const res = await client.post('/auth/verify', { signature, nonce });
        localStorage.setItem('token', res.data.token);
        return res.data;
    },

    getMe: async () => {
        const res = await client.get('/auth/me');
        return res.data;
    },

    // ── Campaigns ────────────────────────────────────────────────────

    getCampaigns: async () => {
        try {
            const res = await client.get('/campaigns');
            return res.data;
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 503) {
                return [];
            }
            throw error;
        }
    },

    getMyCampaigns: async () => {
        const res = await client.get('/campaigns/mine');
        return res.data;
    },

    getAdminCampaigns: async () => {
        const res = await client.get('/campaigns/admin/list');
        return res.data;
    },

    getCampaign: async (id: number) => {
        const res = await client.get(`/campaigns/${id}`);
        return res.data;
    },

    getCampaignMeta: async () => {
        const res = await client.get('/campaigns/meta');
        return res.data;
    },

    uploadBanner: async (file: File) => {
        const formData = new FormData();
        formData.append('banner', file);
        const res = await client.post('/campaigns/upload-banner', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return res.data;
    },

    deleteCampaign: async (id: number) => {
        const res = await client.delete(`/campaigns/${id}`);
        return res.data;
    },

    // ── Admin Contract Controls ─────────────────────────────────────

    getAdminState: async () => {
        const res = await client.get('/campaigns/admin/state');
        return res.data;
    },

    pauseContract: async () => {
        const res = await client.post('/campaigns/admin/pause');
        return res.data;
    },

    resumeContract: async () => {
        const res = await client.post('/campaigns/admin/resume');
        return res.data;
    },

    withdrawCommissions: async (amountEth?: string, to?: string) => {
        const res = await client.post('/campaigns/admin/withdraw-commissions', {
            amountEth,
            to,
        });
        return res.data;
    },

    emergencyStop: async (to?: string) => {
        const res = await client.post('/campaigns/admin/emergency-stop', { to });
        return res.data;
    },

    // ── Donations ────────────────────────────────────────────────────

    getDonations: async (campaignId: number) => {
        const res = await client.get(`/donations/${campaignId}`);
        return res.data;
    },

    getUserContributions: async (address: string) => {
        const res = await client.get(`/donations/user/${address}`);
        return res.data;
    },

    // ── Currency Conversion ──────────────────────────────────────────

    convertCurrency: async (amount: number, from: string = 'usd') => {
        const res = await client.get('/convert', {
            params: { amount, from },
        });
        return res.data;
    },
};
