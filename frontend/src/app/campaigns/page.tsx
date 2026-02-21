'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useWallet } from '@/contexts/WalletContext';
import {
    MagnifyingGlass,
    Target,
    FunnelSimple,
    Rocket,
    CurrencyEth,
    Lightning,
    House,
    Gauge,
    ListChecks,
} from '@phosphor-icons/react';
import CampaignCard from '@/components/CampaignCard';
import CurrencyConverter from '@/components/CurrencyConverter';
import DashboardLayout from '@/components/DashboardLayout';

interface Campaign {
    id: number;
    title: string;
    description: string;
    goal: string;
    amountCollected: string;
    deadline: number;
    bannerUrl: string | null;
    bannerCID: string;
    isActive: boolean;
    percentFunded: number;
    owner: string;
}

type CampaignFilter = 'all' | 'active' | 'completed' | 'expired';

export default function CampaignsPage() {
    const router = useRouter();
    const { isConnected, isAdmin } = useWallet();
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState<CampaignFilter>('all');

    useEffect(() => {
        async function fetchCampaigns() {
            try {
                const data = await api.getCampaigns();
                setCampaigns(data);
            } catch (error) {
                console.error('Failed to fetch campaigns:', error);
            } finally {
                setLoading(false);
            }
        }
        fetchCampaigns();
    }, []);

    const now = Math.floor(Date.now() / 1000);
    const activeCampaigns = campaigns.filter((c) => c.isActive);
    const completedCampaigns = campaigns.filter((c) => c.percentFunded >= 100);
    const expiredCampaigns = campaigns.filter(
        (c) => c.isActive && c.deadline <= now && c.percentFunded < 100
    );
    const totalRaised = campaigns.reduce(
        (sum, c) => sum + parseFloat(c.amountCollected || '0'),
        0
    );

    const filteredCampaigns = campaigns.filter((c) => {
        if (searchTerm && !c.title.toLowerCase().includes(searchTerm.toLowerCase())) {
            return false;
        }

        if (filter === 'active') return c.isActive && c.deadline > now && c.percentFunded < 100;
        if (filter === 'completed') return c.percentFunded >= 100;
        if (filter === 'expired') return c.deadline <= now && c.percentFunded < 100;
        return c.isActive;
    });

    const campaignsContent = (
        <>
            <div className="relative overflow-hidden border-b border-slate-800/80">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950/30" />
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-8 left-16 w-56 h-56 bg-blue-600/20 rounded-full blur-3xl animate-float" />
                    <div
                        className="absolute bottom-6 right-16 w-72 h-72 bg-purple-600/20 rounded-full blur-3xl animate-float"
                        style={{ animationDelay: '1s' }}
                    />
                </div>

                <div className="relative z-10 max-w-7xl mx-auto px-6 py-12">
                    {!isConnected && (
                        <div className="flex flex-wrap items-center gap-2 mb-6">
                            <button
                                onClick={() => router.push('/')}
                                className="btn-secondary flex items-center gap-2 text-xs"
                            >
                                <House size={14} />
                                Home
                            </button>
                            <button
                                onClick={() => router.push('/campaigns')}
                                className="bg-blue-600 text-white rounded-sm font-medium tracking-wide uppercase text-xs px-3 py-2 shadow-[0_0_10px_rgba(59,130,246,0.4)]"
                            >
                                All Campaigns
                            </button>
                            {isConnected && (
                                <button
                                    onClick={() => router.push(isAdmin ? '/admin' : '/dashboard')}
                                    className="btn-secondary flex items-center gap-2 text-xs"
                                >
                                    <Gauge size={14} />
                                    {isAdmin ? 'Admin' : 'Dashboard'}
                                </button>
                            )}
                            {isConnected && (
                                <button
                                    onClick={() => router.push('/contributions')}
                                    className="btn-secondary flex items-center gap-2 text-xs"
                                >
                                    <ListChecks size={14} />
                                    Contributions
                                </button>
                            )}
                            <button
                                onClick={() => router.push('/create')}
                                className="btn-secondary flex items-center gap-2 text-xs"
                            >
                                <Rocket size={14} />
                                Create
                            </button>
                        </div>
                    )}

                    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
                        <div>
                            <h1 className="text-3xl md:text-4xl font-chivo font-black uppercase tracking-wider flex items-center gap-3">
                                <Target size={34} weight="duotone" className="text-blue-400" />
                                Browse Campaigns
                            </h1>
                            <p className="text-slate-500 mt-2 max-w-xl">
                                Discover verified blockchain campaigns and fund ideas with transparent on-chain tracking.
                            </p>
                        </div>
                        <button
                            onClick={() => router.push('/create')}
                            className="btn-primary flex items-center gap-2 px-6 py-3 self-start lg:self-auto"
                        >
                            <Rocket size={18} weight="duotone" />
                            Create Campaign
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 max-w-3xl">
                        <div className="card text-center">
                            <Target size={22} weight="duotone" className="text-blue-400 mx-auto mb-2" />
                            <p className="text-2xl font-bold font-mono text-slate-100">{activeCampaigns.length}</p>
                            <p className="text-xs text-slate-500 font-mono uppercase tracking-wider">Active</p>
                        </div>
                        <div className="card text-center">
                            <CurrencyEth size={22} weight="duotone" className="text-blue-400 mx-auto mb-2" />
                            <p className="text-2xl font-bold font-mono text-gradient-eth">
                                {totalRaised.toFixed(3)}
                            </p>
                            <p className="text-xs text-slate-500 font-mono uppercase tracking-wider">Raised ETH</p>
                        </div>
                        <div className="card text-center">
                            <Lightning size={22} weight="duotone" className="text-blue-400 mx-auto mb-2" />
                            <p className="text-2xl font-bold font-mono text-slate-100">{completedCampaigns.length}</p>
                            <p className="text-xs text-slate-500 font-mono uppercase tracking-wider">Completed</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-10">
                <div className="card mb-8">
                    <div className="flex flex-col lg:flex-row gap-4">
                        <div className="relative flex-1">
                            <MagnifyingGlass
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                                size={18}
                            />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search campaigns by title..."
                                className="input-modern pl-10"
                            />
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <FunnelSimple size={18} className="text-slate-500" />
                            {(['all', 'active', 'completed', 'expired'] as const).map((f) => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`px-3 py-2 rounded-sm text-xs font-mono uppercase tracking-wider transition-all ${filter === f
                                        ? 'bg-blue-600 text-white shadow-[0_0_12px_rgba(59,130,246,0.5)]'
                                        : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                                        }`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
                    <div className="xl:col-span-3">
                        {loading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                {[...Array(6)].map((_, i) => (
                                    <div key={i} className="card animate-shimmer h-80" />
                                ))}
                            </div>
                        ) : filteredCampaigns.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                {filteredCampaigns.map((campaign) => (
                                    <CampaignCard key={campaign.id} campaign={campaign} />
                                ))}
                            </div>
                        ) : (
                            <div className="card text-center py-16">
                                <Target size={48} weight="duotone" className="text-slate-600 mx-auto mb-4" />
                                <p className="text-slate-400 font-mono">No campaigns found</p>
                            </div>
                        )}
                    </div>

                    <div className="space-y-6 xl:sticky xl:top-24">
                        <CurrencyConverter />
                        <div className="card">
                            <h3 className="text-sm font-mono text-slate-400 uppercase tracking-widest mb-3">
                                Stats
                            </h3>
                            <div className="space-y-2 text-sm font-mono">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Active</span>
                                    <span className="text-slate-200">{activeCampaigns.length}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Completed</span>
                                    <span className="text-slate-200">{completedCampaigns.length}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Expired</span>
                                    <span className="text-slate-200">{expiredCampaigns.length}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Results</span>
                                    <span className="text-slate-200">{filteredCampaigns.length}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );

    if (isConnected) {
        return <DashboardLayout>{campaignsContent}</DashboardLayout>;
    }

    return (
        <div className="min-h-screen bg-slate-950 relative">
            <div className="scanlines" />
            {campaignsContent}
        </div>
    );
}
