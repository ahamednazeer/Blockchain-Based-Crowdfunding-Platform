'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/contexts/WalletContext';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import { DataCard } from '@/components/DataCard';
import {
    Wallet,
    CurrencyEth,
    ListChecks,
    ChartLineUp,
    ArrowSquareOut,
} from '@phosphor-icons/react';

interface ContributionItem {
    campaignId: number;
    campaignTitle: string;
    amount: string;
    amountWei: string;
    timestamp: number;
}

interface ContributionPayload {
    totalContributions: number;
    totalAmount: string;
    averageContribution: string;
    contributions: ContributionItem[];
}

export default function ContributionsPage() {
    const router = useRouter();
    const { isConnected, account, connectWallet } = useWallet();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<ContributionPayload | null>(null);

    useEffect(() => {
        if (!isConnected || !account) return;
        const walletAddress = account;
        async function fetchContributions() {
            try {
                const payload = await api.getUserContributions(walletAddress);
                setData(payload);
            } catch (error) {
                console.error('Failed to fetch contributions:', error);
            } finally {
                setLoading(false);
            }
        }
        fetchContributions();
    }, [isConnected, account]);

    if (!isConnected) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="scanlines" />
                <div className="card text-center py-16 px-8 max-w-md">
                    <Wallet size={48} weight="duotone" className="text-blue-400 mx-auto mb-4" />
                    <h2 className="text-xl font-chivo font-bold uppercase tracking-wider mb-2">Connect Wallet</h2>
                    <p className="text-slate-400 text-sm mb-6">Connect your MetaMask wallet to view your contribution history.</p>
                    <button onClick={connectWallet} className="btn-primary">Connect Wallet</button>
                </div>
            </div>
        );
    }

    const contributions = data?.contributions || [];

    return (
        <DashboardLayout>
            <div className="space-y-6 animate-slide-up">
                <div>
                    <h1 className="text-2xl font-chivo font-bold uppercase tracking-wider">
                        My Contributions
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Track all your donations and contribution averages.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <DataCard
                        title="Total Donations"
                        value={data?.totalContributions ?? 0}
                        icon={ListChecks}
                    />
                    <DataCard
                        title="Total Contributed"
                        value={`${(parseFloat(data?.totalAmount || '0')).toFixed(4)} ETH`}
                        icon={CurrencyEth}
                    />
                    <DataCard
                        title="Average Contribution"
                        value={`${(parseFloat(data?.averageContribution || '0')).toFixed(4)} ETH`}
                        icon={ChartLineUp}
                    />
                </div>

                <div className="card">
                    <h3 className="text-sm font-mono text-slate-400 uppercase tracking-widest mb-4">
                        Contribution History
                    </h3>

                    {loading ? (
                        <div className="animate-shimmer h-48" />
                    ) : contributions.length > 0 ? (
                        <div className="space-y-2">
                            {contributions.map((entry, index) => (
                                <div
                                    key={`${entry.campaignId}-${entry.timestamp}-${index}`}
                                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border border-slate-800 rounded-sm p-3"
                                >
                                    <div className="min-w-0">
                                        <p className="text-slate-200 font-medium truncate">{entry.campaignTitle}</p>
                                        <p className="text-xs text-slate-500 font-mono">
                                            Campaign #{entry.campaignId} · {entry.timestamp ? new Date(entry.timestamp * 1000).toLocaleString() : 'Unknown date'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <p className="text-sm font-bold font-mono text-gradient-eth">
                                            {entry.amount} ETH
                                        </p>
                                        <button
                                            onClick={() => router.push(`/campaigns/${entry.campaignId}`)}
                                            className="text-slate-500 hover:text-blue-400 transition-colors"
                                            title="View Campaign"
                                        >
                                            <ArrowSquareOut size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <CurrencyEth size={48} weight="duotone" className="text-slate-600 mx-auto mb-4" />
                            <p className="text-slate-400 font-mono mb-4">No contributions yet.</p>
                            <button onClick={() => router.push('/campaigns')} className="btn-primary">
                                Browse Campaigns
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
