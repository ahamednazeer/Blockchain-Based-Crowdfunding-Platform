'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/contexts/WalletContext';
import { api } from '@/lib/api';
import {
    deleteCampaignOnChain,
    emergencyWithdrawAndStopOnChain,
    pauseContractOnChain,
    resumeContractOnChain,
    withdrawCommissionsOnChain,
} from '@/lib/contract';
import DashboardLayout from '@/components/DashboardLayout';
import { DataCard } from '@/components/DataCard';
import { StatusBadge } from '@/components/StatusBadge';
import { ProgressBar } from '@/components/ProgressBar';
import Modal from '@/components/Modal';
import {
    ShieldCheck,
    Target,
    CurrencyEth,
    ChartLine,
    Users,
    Trash,
    Eye,
    WarningCircle,
    Power,
    ArrowsClockwise,
    ShieldWarning,
} from '@phosphor-icons/react';

interface PlatformState {
    creationFeeEth: string;
    contractBalanceEth: string;
    commissionsCollectedEth: string;
    isPaused: boolean;
    isEmergencyStopped: boolean;
}

export default function AdminDashboard() {
    const router = useRouter();
    const { account, isConnected, isAdmin, connectWallet } = useWallet();
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [platformState, setPlatformState] = useState<PlatformState | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState('');

    const [deleteTarget, setDeleteTarget] = useState<any>(null);
    const [deleting, setDeleting] = useState(false);

    const [selectedCampaignId, setSelectedCampaignId] = useState('');
    const [withdrawAmountEth, setWithdrawAmountEth] = useState('');

    const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);
    const [emergencyConfirmText, setEmergencyConfirmText] = useState('');

    const loadData = async () => {
        setLoading(true);
        try {
            const [campaignData, state] = await Promise.all([
                api.getAdminCampaigns(),
                api.getAdminState(),
            ]);
            setCampaigns(campaignData);
            setSelectedCampaignId((prev) => {
                if (!prev) return prev;
                const stillActive = campaignData.some((c: any) => String(c.id) === prev && c.isActive);
                return stillActive ? prev : '';
            });
            setPlatformState(state);
        } catch (error) {
            console.error('Failed to fetch admin data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!isConnected || !isAdmin) return;
        loadData();
    }, [isConnected, isAdmin]);

    const now = Math.floor(Date.now() / 1000);
    const activeCampaigns = campaigns.filter((c) => c.isActive);
    const totalRaised = campaigns.reduce((sum, c) => sum + parseFloat(c.amountCollected || '0'), 0);
    const completedCount = campaigns.filter((c) => c.percentFunded >= 100).length;
    const moderationCandidates = campaigns.filter((c) => c.isActive);

    const contractStatusText = useMemo(() => {
        if (!platformState) return 'UNKNOWN';
        if (platformState.isEmergencyStopped) return 'STOPPED';
        if (platformState.isPaused) return 'PAUSED';
        return 'ACTIVE';
    }, [platformState]);

    const getActionError = (error: any, fallback: string) =>
        error?.response?.data?.error ||
        error?.reason ||
        error?.shortMessage ||
        error?.message ||
        fallback;

    const handleDelete = async (campaignId: number) => {
        setActionLoading(`delete-${campaignId}`);
        try {
            await deleteCampaignOnChain(campaignId);
            await loadData();
        } catch (error: any) {
            console.error('Delete failed:', error);
            alert(getActionError(error, 'Failed to delete campaign'));
        } finally {
            setActionLoading('');
            setDeleting(false);
            setDeleteTarget(null);
            setSelectedCampaignId('');
        }
    };

    const handlePauseResume = async () => {
        if (!platformState) return;
        if (platformState.isEmergencyStopped) {
            alert('Contract is permanently stopped after emergency shutdown. Resume is not possible.');
            return;
        }
        setActionLoading('pause-resume');
        try {
            if (platformState.isPaused) {
                await resumeContractOnChain();
            } else {
                await pauseContractOnChain();
            }
            await loadData();
        } catch (error: any) {
            console.error('Pause/resume failed:', error);
            alert(getActionError(error, 'Failed to update contract pause state'));
        } finally {
            setActionLoading('');
        }
    };

    const handleWithdrawCommissions = async () => {
        if (!platformState) return;
        setActionLoading('withdraw');
        try {
            const amountToWithdraw = withdrawAmountEth.trim() || platformState.contractBalanceEth;
            await withdrawCommissionsOnChain(amountToWithdraw, account || undefined);
            await loadData();
            setWithdrawAmountEth('');
        } catch (error: any) {
            console.error('Withdraw failed:', error);
            alert(getActionError(error, 'Failed to withdraw commissions'));
        } finally {
            setActionLoading('');
        }
    };

    const handleModerationDelete = async () => {
        const id = Number(selectedCampaignId);
        if (!Number.isInteger(id) || id < 0) {
            alert('Select a campaign to deactivate');
            return;
        }
        await handleDelete(id);
    };

    const handleEmergencyStop = async () => {
        if (emergencyConfirmText !== 'STOP') {
            alert('Type STOP to confirm emergency shutdown');
            return;
        }
        setActionLoading('emergency');
        try {
            await emergencyWithdrawAndStopOnChain(account || undefined);
            setEmergencyModalOpen(false);
            setEmergencyConfirmText('');
            await loadData();
        } catch (error: any) {
            console.error('Emergency stop failed:', error);
            alert(getActionError(error, 'Failed to execute emergency stop'));
        } finally {
            setActionLoading('');
        }
    };

    if (!isConnected) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="scanlines" />
                <div className="card text-center py-16 px-8 max-w-md">
                    <ShieldCheck size={48} weight="duotone" className="text-purple-400 mx-auto mb-4" />
                    <h2 className="text-xl font-chivo font-bold uppercase tracking-wider mb-2">Admin Access</h2>
                    <p className="text-slate-400 text-sm mb-6">Connect your admin wallet to access the admin panel.</p>
                    <button onClick={connectWallet} className="btn-primary">Connect Wallet</button>
                </div>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="scanlines" />
                <div className="card text-center py-16 px-8 max-w-md">
                    <WarningCircle size={48} weight="duotone" className="text-red-400 mx-auto mb-4" />
                    <h2 className="text-xl font-chivo font-bold uppercase tracking-wider mb-2">Access Denied</h2>
                    <p className="text-slate-400 text-sm mb-6">Your wallet does not have admin privileges.</p>
                    <button onClick={() => router.push('/')} className="btn-secondary">Go Home</button>
                </div>
            </div>
        );
    }

    return (
        <DashboardLayout>
            <div className="space-y-6 animate-slide-up">
                <div className="flex items-center gap-3 mb-2">
                    <ShieldCheck size={24} weight="duotone" className="text-purple-400" />
                    <div>
                        <h1 className="text-2xl font-chivo font-bold uppercase tracking-wider">Admin Dashboard</h1>
                        <p className="text-slate-500 text-sm">Monetization, moderation, and contract controls</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
                    <DataCard title="Total Campaigns" value={campaigns.length} icon={Target} />
                    <DataCard title="Active" value={activeCampaigns.length} icon={ChartLine} />
                    <DataCard title="Total Raised" value={`${totalRaised.toFixed(4)} ETH`} icon={CurrencyEth} />
                    <DataCard title="Completed" value={completedCount} icon={Users} />
                    <DataCard title="Creation Fee" value={`${parseFloat(platformState?.creationFeeEth || '0').toFixed(4)} ETH`} icon={CurrencyEth} />
                    <DataCard title="Contract Balance" value={`${parseFloat(platformState?.contractBalanceEth || '0').toFixed(4)} ETH`} icon={CurrencyEth} />
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <div className="card space-y-4">
                        <div>
                            <h3 className="text-sm font-mono text-slate-400 uppercase tracking-widest">Platform Monetization</h3>
                            <p className="text-xs text-slate-600 mt-1">Admin commission from campaign creation fees.</p>
                        </div>
                        <div className="text-sm font-mono space-y-1">
                            <p className="text-slate-500">
                                Collected: <span className="text-slate-200">{parseFloat(platformState?.commissionsCollectedEth || '0').toFixed(4)} ETH</span>
                            </p>
                            <p className="text-slate-500">
                                Withdrawable: <span className="text-slate-200">{parseFloat(platformState?.contractBalanceEth || '0').toFixed(4)} ETH</span>
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                min="0"
                                step="0.0001"
                                value={withdrawAmountEth}
                                onChange={(e) => setWithdrawAmountEth(e.target.value)}
                                placeholder="Amount ETH (blank = all)"
                                className="input-modern"
                            />
                            <button
                                onClick={handleWithdrawCommissions}
                                disabled={actionLoading === 'withdraw' || platformState?.isEmergencyStopped}
                                className="btn-primary whitespace-nowrap"
                            >
                                {actionLoading === 'withdraw' ? 'Withdrawing...' : 'Withdraw'}
                            </button>
                        </div>
                    </div>

                    <div className="card space-y-4">
                        <div>
                            <h3 className="text-sm font-mono text-slate-400 uppercase tracking-widest">Pause / Resume Contract</h3>
                            <p className="text-xs text-slate-600 mt-1">
                                Status: <span className="text-slate-300">{contractStatusText}</span>
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handlePauseResume}
                                disabled={actionLoading === 'pause-resume' || platformState?.isEmergencyStopped}
                                className={`flex items-center gap-2 ${platformState?.isEmergencyStopped ? 'btn-danger opacity-70 cursor-not-allowed' : 'btn-secondary'}`}
                            >
                                {actionLoading === 'pause-resume' ? (
                                    <>
                                        <ArrowsClockwise size={16} className="animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <Power size={16} />
                                        {platformState?.isEmergencyStopped
                                            ? 'Permanently Stopped'
                                            : platformState?.isPaused
                                                ? 'Resume Contract'
                                                : 'Pause Contract'}
                                    </>
                                )}
                            </button>
                        </div>
                        {platformState?.isEmergencyStopped ? (
                            <p className="text-xs text-red-400 font-mono">
                                Emergency stop is irreversible. Contract cannot be resumed.
                            </p>
                        ) : (
                            <p className="text-xs text-slate-600 font-mono">
                                Paused contract blocks new campaign creation and donations.
                            </p>
                        )}
                    </div>

                    <div className="card space-y-4">
                        <div>
                            <h3 className="text-sm font-mono text-slate-400 uppercase tracking-widest">Campaign Moderation</h3>
                            <p className="text-xs text-slate-600 mt-1">Select an active campaign and deactivate it.</p>
                        </div>
                        <div className="space-y-2">
                            <select
                                value={selectedCampaignId}
                                onChange={(e) => setSelectedCampaignId(e.target.value)}
                                className="input-modern"
                                disabled={moderationCandidates.length === 0 || actionLoading.startsWith('delete-')}
                            >
                                <option value="">
                                    {moderationCandidates.length === 0
                                        ? 'No active campaigns'
                                        : 'Select active campaign'}
                                </option>
                                {moderationCandidates.map((c) => (
                                    <option key={c.id} value={String(c.id)}>
                                        #{c.id} - {c.title}
                                    </option>
                                ))}
                            </select>
                            <button
                                onClick={handleModerationDelete}
                                disabled={actionLoading.startsWith('delete-') || !selectedCampaignId}
                                className="btn-danger w-full"
                            >
                                {actionLoading.startsWith('delete-') ? 'Deactivating...' : 'Deactivate'}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="card border-red-900/60 bg-red-950/20">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div>
                            <h3 className="text-sm font-mono text-red-400 uppercase tracking-widest flex items-center gap-2">
                                <ShieldWarning size={18} />
                                Emergency Withdrawal & Permanent Stop
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                                This withdraws all contract balance and permanently disables campaign creation and donations.
                            </p>
                        </div>
                        <button
                            onClick={() => setEmergencyModalOpen(true)}
                            disabled={platformState?.isEmergencyStopped}
                            className="btn-danger"
                        >
                            {platformState?.isEmergencyStopped ? 'Already Stopped' : 'Trigger Emergency Stop'}
                        </button>
                    </div>
                </div>

                <div className="card overflow-hidden">
                    <h3 className="text-sm font-mono text-slate-400 uppercase tracking-widest mb-4">All Campaigns</h3>

                    {loading ? (
                        <div className="animate-shimmer h-64" />
                    ) : campaigns.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-700">
                                        <th className="text-left font-mono text-slate-500 uppercase text-xs tracking-wider py-3 px-4">ID</th>
                                        <th className="text-left font-mono text-slate-500 uppercase text-xs tracking-wider py-3 px-4">Title</th>
                                        <th className="text-left font-mono text-slate-500 uppercase text-xs tracking-wider py-3 px-4">Category</th>
                                        <th className="text-left font-mono text-slate-500 uppercase text-xs tracking-wider py-3 px-4">Owner</th>
                                        <th className="text-left font-mono text-slate-500 uppercase text-xs tracking-wider py-3 px-4">Goal</th>
                                        <th className="text-left font-mono text-slate-500 uppercase text-xs tracking-wider py-3 px-4">Raised</th>
                                        <th className="text-left font-mono text-slate-500 uppercase text-xs tracking-wider py-3 px-4">Progress</th>
                                        <th className="text-left font-mono text-slate-500 uppercase text-xs tracking-wider py-3 px-4">Status</th>
                                        <th className="text-right font-mono text-slate-500 uppercase text-xs tracking-wider py-3 px-4">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {campaigns.map((c) => {
                                        const isExpired = c.deadline < now;
                                        const status = !c.isActive
                                            ? 'INACTIVE'
                                            : c.percentFunded >= 100
                                                ? 'COMPLETED'
                                                : isExpired
                                                    ? 'EXPIRED'
                                                    : 'ACTIVE';

                                        return (
                                            <tr key={c.id} className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
                                                <td className="py-3 px-4 font-mono text-slate-400">#{c.id}</td>
                                                <td className="py-3 px-4 text-slate-200 font-medium truncate max-w-[180px]">{c.title}</td>
                                                <td className="py-3 px-4 text-slate-500 text-xs">{c.category || '-'}</td>
                                                <td className="py-3 px-4 font-mono text-slate-500 text-xs">
                                                    {c.owner.slice(0, 6)}...{c.owner.slice(-4)}
                                                </td>
                                                <td className="py-3 px-4 font-mono text-slate-300">{c.goal} ETH</td>
                                                <td className="py-3 px-4 font-mono text-slate-300">{c.amountCollected} ETH</td>
                                                <td className="py-3 px-4 w-32">
                                                    <ProgressBar percent={c.percentFunded} showLabel={false} />
                                                </td>
                                                <td className="py-3 px-4">
                                                    <StatusBadge status={status} />
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => router.push(`/campaigns/${c.id}`)}
                                                            className="text-slate-500 hover:text-blue-400 transition-colors"
                                                            title="View"
                                                        >
                                                            <Eye size={18} />
                                                        </button>
                                                        {c.isActive && (
                                                            <button
                                                                onClick={() => setDeleteTarget(c)}
                                                                className="text-slate-500 hover:text-red-400 transition-colors"
                                                                title="Deactivate"
                                                            >
                                                                <Trash size={18} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <Target size={48} weight="duotone" className="text-slate-600 mx-auto mb-4" />
                            <p className="text-slate-400 font-mono">No campaigns found</p>
                        </div>
                    )}
                </div>
            </div>

            <Modal
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                title="Deactivate Campaign"
                size="sm"
            >
                <div className="space-y-4">
                    <div className="flex items-center gap-3 text-red-400">
                        <WarningCircle size={24} weight="duotone" />
                        <p className="text-sm">This will deactivate the campaign and remove it from the active marketplace.</p>
                    </div>
                    {deleteTarget && (
                        <div className="bg-slate-800/50 rounded-sm p-3">
                            <p className="text-sm font-bold text-slate-200">{deleteTarget.title}</p>
                            <p className="text-xs text-slate-500 font-mono mt-1">ID: #{deleteTarget.id}</p>
                        </div>
                    )}
                    <div className="flex gap-3">
                        <button onClick={() => setDeleteTarget(null)} className="btn-secondary flex-1">Cancel</button>
                        <button
                            onClick={() => {
                                setDeleting(true);
                                handleDelete(deleteTarget.id);
                            }}
                            disabled={deleting}
                            className="btn-danger flex-1"
                        >
                            {deleting ? 'Deactivating...' : 'Confirm'}
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={emergencyModalOpen}
                onClose={() => {
                    setEmergencyModalOpen(false);
                    setEmergencyConfirmText('');
                }}
                title="Emergency Shutdown"
                size="sm"
            >
                <div className="space-y-4">
                    <p className="text-sm text-red-400">
                        This action withdraws all contract funds and permanently stops core operations. This cannot be undone.
                    </p>
                    <div>
                        <label className="block text-xs font-mono text-slate-500 uppercase tracking-wider mb-2">
                            Type STOP to confirm
                        </label>
                        <input
                            value={emergencyConfirmText}
                            onChange={(e) => setEmergencyConfirmText(e.target.value)}
                            className="input-modern"
                            placeholder="STOP"
                        />
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => {
                                setEmergencyModalOpen(false);
                                setEmergencyConfirmText('');
                            }}
                            className="btn-secondary flex-1"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleEmergencyStop}
                            disabled={actionLoading === 'emergency'}
                            className="btn-danger flex-1"
                        >
                            {actionLoading === 'emergency' ? 'Executing...' : 'Emergency Stop'}
                        </button>
                    </div>
                </div>
            </Modal>
        </DashboardLayout>
    );
}
