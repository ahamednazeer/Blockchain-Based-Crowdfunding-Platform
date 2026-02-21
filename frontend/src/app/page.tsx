'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/contexts/WalletContext';
import { api } from '@/lib/api';
import {
    Cube,
    Wallet,
    Rocket,
    MagnifyingGlass,
    CurrencyEth,
    Target,
    Users,
    Lightning,
} from '@phosphor-icons/react';
import CampaignCard from '@/components/CampaignCard';
import CurrencyConverter from '@/components/CurrencyConverter';

export default function HomePage() {
    const router = useRouter();
    const { isConnected, connecting, connectWallet } = useWallet();
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ total: 0, raised: '0', donors: 0 });

    useEffect(() => {
        async function fetchCampaigns() {
            try {
                const data = await api.getCampaigns();
                const active = data.filter((c: any) => c.isActive);
                setCampaigns(active.slice(0, 6));

                // Calculate stats
                const totalRaised = data.reduce(
                    (sum: number, c: any) => sum + parseFloat(c.amountCollected || '0'),
                    0
                );
                setStats({
                    total: data.length,
                    raised: totalRaised.toFixed(4),
                    donors: 0, // Will be calculated per-campaign
                });
            } catch (error) {
                console.error('Failed to fetch campaigns:', error);
            } finally {
                setLoading(false);
            }
        }
        fetchCampaigns();
    }, []);

    return (
        <div className="min-h-screen bg-slate-950 relative">
            <div className="scanlines" />

            {/* Hero Section */}
            <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950/30" />
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-20 left-20 w-72 h-72 bg-blue-600/20 rounded-full blur-3xl animate-float" />
                    <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }} />
                </div>

                <div className="relative z-10 max-w-7xl mx-auto px-6 py-24">
                    <div className="text-center max-w-3xl mx-auto">
                        <div className="flex items-center justify-center gap-3 mb-6">
                            <Cube size={48} weight="duotone" className="text-blue-400" />
                        </div>
                        <h1 className="text-5xl md:text-6xl font-chivo font-black uppercase tracking-wider mb-4">
                            Crowd<span className="text-gradient">Chain</span>
                        </h1>
                        <p className="text-xl text-slate-400 mb-2 font-mono uppercase tracking-widest text-sm">
                            Decentralized Crowdfunding Platform
                        </p>
                        <p className="text-slate-500 mt-4 max-w-lg mx-auto">
                            Create and fund campaigns using Ethereum blockchain.
                            Fully transparent, fully secure, fully decentralized.
                        </p>

                        <div className="flex items-center justify-center gap-4 mt-8">
                            {!isConnected ? (
                                <button
                                    onClick={connectWallet}
                                    disabled={connecting}
                                    className="bg-blue-600 hover:bg-blue-500 text-white rounded-sm font-medium tracking-wide uppercase text-sm px-8 py-3.5 shadow-[0_0_20px_rgba(59,130,246,0.5)] transition-all duration-150 disabled:opacity-50 flex items-center gap-2"
                                >
                                    <Wallet size={20} weight="duotone" />
                                    {connecting ? 'Connecting...' : 'Connect Wallet'}
                                </button>
                            ) : (
                                <button
                                    onClick={() => router.push('/create')}
                                    className="bg-blue-600 hover:bg-blue-500 text-white rounded-sm font-medium tracking-wide uppercase text-sm px-8 py-3.5 shadow-[0_0_20px_rgba(59,130,246,0.5)] transition-all duration-150 flex items-center gap-2"
                                >
                                    <Rocket size={20} weight="duotone" />
                                    Create Campaign
                                </button>
                            )}
                            <button
                                onClick={() => router.push('/campaigns')}
                                className="btn-secondary flex items-center gap-2 px-8 py-3.5"
                            >
                                <MagnifyingGlass size={20} />
                                Browse Campaigns
                            </button>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-16 max-w-2xl mx-auto">
                        <div className="card text-center">
                            <Target size={24} weight="duotone" className="text-blue-400 mx-auto mb-2" />
                            <p className="text-2xl font-bold font-mono text-slate-100">{stats.total}</p>
                            <p className="text-xs text-slate-500 font-mono uppercase tracking-wider">Total Campaigns</p>
                        </div>
                        <div className="card text-center">
                            <CurrencyEth size={24} weight="duotone" className="text-blue-400 mx-auto mb-2" />
                            <p className="text-2xl font-bold font-mono text-gradient-eth">{stats.raised} ETH</p>
                            <p className="text-xs text-slate-500 font-mono uppercase tracking-wider">Total Raised</p>
                        </div>
                        <div className="card text-center">
                            <Lightning size={24} weight="duotone" className="text-blue-400 mx-auto mb-2" />
                            <p className="text-2xl font-bold font-mono text-slate-100">100%</p>
                            <p className="text-xs text-slate-500 font-mono uppercase tracking-wider">Transparent</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Featured Campaigns */}
            <div className="max-w-7xl mx-auto px-6 py-16">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-2xl font-chivo font-bold uppercase tracking-wider flex items-center gap-3">
                            <Lightning size={28} weight="duotone" className="text-blue-400" />
                            Active Campaigns
                        </h2>
                        <p className="text-slate-500 mt-1">Browse and support campaigns</p>
                    </div>
                    <button
                        onClick={() => router.push('/campaigns')}
                        className="btn-secondary text-xs"
                    >
                        View All
                    </button>
                </div>

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
                    <div className="card text-center py-16">
                        <Target size={48} weight="duotone" className="text-slate-600 mx-auto mb-4" />
                        <p className="text-slate-400 font-mono">No campaigns yet. Be the first to create one.</p>
                    </div>
                )}
            </div>

            {/* Currency Converter */}
            <div className="max-w-7xl mx-auto px-6 pb-16">
                <div className="max-w-md mx-auto">
                    <CurrencyConverter />
                </div>
            </div>

            {/* Footer */}
            <footer className="border-t border-slate-800 py-8">
                <div className="max-w-7xl mx-auto px-6 text-center">
                    <p className="text-xs text-slate-600 font-mono uppercase tracking-wider">
                        CrowdChain - Powered by Ethereum Blockchain
                    </p>
                </div>
            </footer>
        </div>
    );
}
