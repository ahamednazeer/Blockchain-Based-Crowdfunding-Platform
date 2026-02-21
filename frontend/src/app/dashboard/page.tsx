'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/contexts/WalletContext';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import CampaignCard from '@/components/CampaignCard';
import { DataCard } from '@/components/DataCard';
import {
    Target,
    CurrencyEth,
    ChartLine,
    CheckCircle,
    Wallet,
} from '@phosphor-icons/react';

export default function UserDashboard() {
    const router = useRouter();
    const { isConnected, account, connectWallet } = useWallet();
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isConnected) return;
        async function fetchData() {
            try {
                const mine = await api.getMyCampaigns();
                setCampaigns(mine);
            } catch (error) {
                console.error('Failed to fetch campaigns:', error);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [isConnected, account]);

    if (!isConnected) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="scanlines" />
                <div className="card text-center py-16 px-8 max-w-md">
                    <Wallet size={48} weight="duotone" className="text-blue-400 mx-auto mb-4" />
                    <h2 className="text-xl font-chivo font-bold uppercase tracking-wider mb-2">Connect Wallet</h2>
                    <p className="text-slate-400 text-sm mb-6">Connect your MetaMask wallet to view your dashboard.</p>
                    <button onClick={connectWallet} className="btn-primary">Connect Wallet</button>
                </div>
            </div>
        );
    }

    const totalRaised = campaigns.reduce(
        (sum, c) => sum + parseFloat(c.amountCollected || '0'),
        0
    );

    const activeCampaigns = campaigns.filter((c) => c.isActive);
    const successfulCampaigns = campaigns.filter((c) => c.percentFunded >= 100);
    const successRate = campaigns.length
        ? ((successfulCampaigns.length / campaigns.length) * 100).toFixed(1)
        : '0.0';

    return (
        <DashboardLayout>
            <div className="space-y-6 animate-slide-up">
                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    <DataCard
                        title="My Campaigns"
                        value={campaigns.length}
                        icon={Target}
                    />
                    <DataCard
                        title="Total Raised"
                        value={`${totalRaised.toFixed(4)} ETH`}
                        icon={CurrencyEth}
                    />
                    <DataCard
                        title="Active"
                        value={activeCampaigns.length}
                        icon={ChartLine}
                    />
                    <DataCard
                        title="Success Rate"
                        value={`${successRate}%`}
                        icon={CheckCircle}
                    />
                </div>

                {/* My Campaigns */}
                <div>
                    <h2 className="text-xl font-chivo font-bold uppercase tracking-wider mb-4">
                        My Campaigns
                    </h2>
                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="card animate-shimmer h-80" />
                            ))}
                        </div>
                    ) : campaigns.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {campaigns.map((campaign) => (
                                <CampaignCard key={campaign.id} campaign={campaign} />
                            ))}
                        </div>
                    ) : (
                        <div className="card text-center py-12">
                            <Target size={48} weight="duotone" className="text-slate-600 mx-auto mb-4" />
                            <p className="text-slate-400 font-mono mb-4">You haven't created any campaigns yet.</p>
                            <button onClick={() => router.push('/create')} className="btn-primary">
                                Create Your First Campaign
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
