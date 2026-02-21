'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/contexts/WalletContext';
import { api } from '@/lib/api';
import { donateToCampaign } from '@/lib/contract';
import {
    ArrowLeft,
    CurrencyEth,
    Clock,
    Target,
    User,
    Copy,
    Check,
    ChartLine,
    Cube,
    Lightning,
    Info,
    ShareNetwork,
    LinkSimple,
    WhatsappLogo,
    TelegramLogo,
    XLogo,
    EnvelopeSimple,
} from '@phosphor-icons/react';
import { ProgressBar } from '@/components/ProgressBar';
import { StatusBadge } from '@/components/StatusBadge';
import Modal from '@/components/Modal';
import CurrencyConverter from '@/components/CurrencyConverter';
import DashboardLayout from '@/components/DashboardLayout';

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const { isConnected, connectWallet } = useWallet();
    const [campaign, setCampaign] = useState<any>(null);
    const [platformMeta, setPlatformMeta] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [donateModalOpen, setDonateModalOpen] = useState(false);
    const [donateAmount, setDonateAmount] = useState('');
    const [donating, setDonating] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [sharingCampaign, setSharingCampaign] = useState(false);
    const [shareFeedback, setShareFeedback] = useState<{
        variant: 'success' | 'info' | 'error';
        message: string;
    } | null>(null);
    const [donateFeedback, setDonateFeedback] = useState<{
        variant: 'info' | 'error';
        message: string;
    } | null>(null);
    const [inrRate, setInrRate] = useState<number | null>(null);
    const [inrRateLoading, setInrRateLoading] = useState(false);
    const [inrRateError, setInrRateError] = useState('');

    useEffect(() => {
        async function fetchCampaign() {
            try {
                const [campaignData, metaData] = await Promise.all([
                    api.getCampaign(parseInt(id)),
                    api.getCampaignMeta().catch(() => null),
                ]);
                setCampaign(campaignData);
                if (metaData) {
                    setPlatformMeta(metaData);
                }
            } catch (error) {
                console.error('Failed to fetch campaign:', error);
            } finally {
                setLoading(false);
            }
        }
        fetchCampaign();
    }, [id]);

    const handleDonate = async () => {
        if (!donateAmount || parseFloat(donateAmount) <= 0) return;
        setDonateFeedback(null);
        setDonating(true);
        try {
            await donateToCampaign(campaign.id, donateAmount);
            // Refresh campaign data
            const [campaignData, metaData] = await Promise.all([
                api.getCampaign(campaign.id),
                api.getCampaignMeta().catch(() => null),
            ]);
            setCampaign(campaignData);
            if (metaData) {
                setPlatformMeta(metaData);
            }
            setDonateModalOpen(false);
            setDonateAmount('');
            setDonateFeedback(null);
        } catch (error: any) {
            const code = error?.code ?? error?.info?.error?.code;
            const shortMessage = String(error?.shortMessage || '').toLowerCase();
            const isRejected = code === 4001
                || code === 'ACTION_REJECTED'
                || shortMessage.includes('user rejected')
                || shortMessage.includes('user denied');

            if (isRejected) {
                setDonateFeedback({
                    variant: 'info',
                    message: 'Transaction cancelled in wallet. No funds were sent.',
                });
                return;
            }

            console.error('Donation failed:', error);
            setDonateFeedback({
                variant: 'error',
                message: error?.reason
                    || error?.shortMessage
                    || error?.message
                    || 'Donation failed. Please try again.',
            });
        } finally {
            setDonating(false);
        }
    };

    useEffect(() => {
        let cancelled = false;

        async function fetchInrRate() {
            if (!donateModalOpen) return;

            setInrRateLoading(true);
            setInrRateError('');

            try {
                const data = await api.convertCurrency(1, 'inr');
                if (!cancelled) {
                    setInrRate(Number(data.rate));
                }
            } catch (error) {
                console.error('Failed to fetch INR rate:', error);
                if (!cancelled) {
                    setInrRate(null);
                    setInrRateError('Live INR conversion is temporarily unavailable');
                }
            } finally {
                if (!cancelled) {
                    setInrRateLoading(false);
                }
            }
        }

        fetchInrRate();
        return () => {
            cancelled = true;
        };
    }, [donateModalOpen]);

    const copyText = (value: string, field: string) => {
        navigator.clipboard.writeText(value);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const openDonateModal = () => {
        setDonateFeedback(null);
        setDonateModalOpen(true);
    };

    const parsedDonateAmount = Number(donateAmount);
    const hasValidDonateAmount = Number.isFinite(parsedDonateAmount) && parsedDonateAmount > 0;
    const inrEstimate = hasValidDonateAmount && inrRate
        ? parsedDonateAmount * inrRate
        : null;

    if (loading) {
        const loadingContent = (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="card animate-shimmer w-96 h-64" />
            </div>
        );

        if (isConnected) {
            return <DashboardLayout>{loadingContent}</DashboardLayout>;
        }

        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                {loadingContent}
            </div>
        );
    }

    if (!campaign) {
        const notFoundContent = (
            <div className="card text-center py-16">
                <Target size={48} weight="duotone" className="text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 font-mono">Campaign not found</p>
                <button onClick={() => router.push('/campaigns')} className="btn-primary mt-4">
                    Back to Campaigns
                </button>
            </div>
        );

        if (isConnected) {
            return (
                <DashboardLayout>
                    <div className="flex items-center justify-center min-h-[60vh]">
                        {notFoundContent}
                    </div>
                </DashboardLayout>
            );
        }

        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                {notFoundContent}
            </div>
        );
    }

    const now = Math.floor(Date.now() / 1000);
    const isExpired = campaign.deadline < now;
    const daysLeft = Math.max(0, Math.ceil((campaign.deadline - now) / 86400));
    const canDonate = campaign.isActive && !isExpired && campaign.percentFunded < 100;

    const status = !campaign.isActive
        ? 'DELETED'
        : campaign.percentFunded >= 100
            ? 'COMPLETED'
            : isExpired
                ? 'EXPIRED'
                : 'ACTIVE';

    const donors = Array.isArray(campaign.donors) ? campaign.donors : [];
    const totalDonors = campaign.totalDonors ?? donors.length;
    const goalEth = parseFloat(campaign.goal || '0');
    const raisedEth = parseFloat(campaign.amountCollected || '0');
    const remaining = Math.max(0, goalEth - raisedEth);
    const fundedPercent = Number(campaign.percentFunded || 0);
    const deadlineTimestamp = Number(campaign.deadline || 0);
    const averageDonation = totalDonors > 0
        ? raisedEth / totalDonors
        : 0;
    const largestDonation = donors.reduce(
        (max: number, donor: any) => Math.max(max, parseFloat(donor.amount || '0')),
        0
    );
    const lastDonationTimestamp = donors.reduce(
        (max: number, donor: any) => Math.max(max, Number(donor.timestamp || 0)),
        0
    );
    const createdAtTimestamp = Number(campaign.createdAt || 0);
    const campaignAgeDays = createdAtTimestamp > 0
        ? Math.max(0, Math.floor((now - createdAtTimestamp) / 86400))
        : null;
    const goalWei = campaign.goalWei || '0';
    const amountCollectedWei = campaign.amountCollectedWei || '0';

    let remainingWei = '0';
    try {
        const zeroWei = BigInt(0);
        const remainingBigInt = BigInt(goalWei) - BigInt(amountCollectedWei);
        remainingWei = (remainingBigInt > zeroWei ? remainingBigInt : zeroWei).toString();
    } catch {
        remainingWei = '0';
    }

    const formatTimestamp = (ts: number) => {
        if (!ts || ts <= 0) return 'N/A';
        return new Date(ts * 1000).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const platformStatus = platformMeta
        ? platformMeta.isEmergencyStopped
            ? 'EMERGENCY_STOPPED'
            : platformMeta.isPaused
                ? 'PAUSED'
                : 'ACTIVE'
        : 'UNKNOWN';

    const shortOwner = campaign.owner
        ? `${campaign.owner.slice(0, 6)}...${campaign.owner.slice(-4)}`
        : 'Unknown';
    const contentShellClass = isConnected
        ? 'w-full py-6'
        : 'max-w-7xl mx-auto px-6 py-8';
    const statusBadgeGlow = status === 'ACTIVE'
        ? 'drop-shadow(0 0 10px rgba(16,185,129,0.55))'
        : status === 'COMPLETED'
            ? 'drop-shadow(0 0 10px rgba(59,130,246,0.55))'
            : status === 'EXPIRED'
                ? 'drop-shadow(0 0 10px rgba(245,158,11,0.50))'
                : 'drop-shadow(0 0 8px rgba(244,63,94,0.42))';
    const statusTheme = status === 'ACTIVE'
        ? {
            heroBorder: 'border-emerald-500/45',
            heroAura: 'radial-gradient(circle, rgba(16,185,129,0.38), rgba(15,23,42,0))',
            heroTint: 'linear-gradient(135deg, rgba(16,185,129,0.20), rgba(15,23,42,0) 55%)',
            heroShadow: '0 0 0 1px rgba(16,185,129,0.16), 0 0 45px rgba(16,185,129,0.16)',
            snapshotGradient: 'from-slate-900/85 via-slate-900/55 to-emerald-950/26',
            sidebarGradient: 'from-slate-900/90 via-slate-900/55 to-emerald-950/26',
            shareGradient: 'from-slate-900/85 via-slate-900/55 to-emerald-950/22',
            quickCardClass: 'border-emerald-500/28 bg-gradient-to-br from-emerald-950/32 to-slate-900/42 shadow-[inset_0_0_24px_rgba(16,185,129,0.10)]',
            statusMetricClass: 'border-emerald-500/36 bg-emerald-950/24',
            donatePanelClass: 'border-emerald-500/42 from-emerald-950/42 via-slate-900/70 to-slate-900/80',
        }
        : status === 'COMPLETED'
            ? {
                heroBorder: 'border-blue-500/45',
                heroAura: 'radial-gradient(circle, rgba(59,130,246,0.36), rgba(15,23,42,0))',
                heroTint: 'linear-gradient(135deg, rgba(59,130,246,0.18), rgba(15,23,42,0) 55%)',
                heroShadow: '0 0 0 1px rgba(59,130,246,0.15), 0 0 45px rgba(59,130,246,0.15)',
                snapshotGradient: 'from-slate-900/85 via-slate-900/55 to-blue-950/26',
                sidebarGradient: 'from-slate-900/90 via-slate-900/55 to-blue-950/26',
                shareGradient: 'from-slate-900/85 via-slate-900/55 to-blue-950/22',
                quickCardClass: 'border-blue-500/28 bg-gradient-to-br from-blue-950/30 to-slate-900/42 shadow-[inset_0_0_24px_rgba(59,130,246,0.09)]',
                statusMetricClass: 'border-blue-500/36 bg-blue-950/24',
                donatePanelClass: 'border-blue-500/40 from-blue-950/40 via-slate-900/70 to-slate-900/80',
            }
            : status === 'EXPIRED'
                ? {
                    heroBorder: 'border-amber-500/40',
                    heroAura: 'radial-gradient(circle, rgba(245,158,11,0.34), rgba(15,23,42,0))',
                    heroTint: 'linear-gradient(135deg, rgba(245,158,11,0.16), rgba(15,23,42,0) 55%)',
                    heroShadow: '0 0 0 1px rgba(245,158,11,0.15), 0 0 45px rgba(245,158,11,0.12)',
                    snapshotGradient: 'from-slate-900/85 via-slate-900/55 to-amber-950/24',
                    sidebarGradient: 'from-slate-900/90 via-slate-900/55 to-amber-950/24',
                    shareGradient: 'from-slate-900/85 via-slate-900/55 to-amber-950/20',
                    quickCardClass: 'border-amber-500/24 bg-gradient-to-br from-amber-950/28 to-slate-900/42 shadow-[inset_0_0_22px_rgba(245,158,11,0.09)]',
                    statusMetricClass: 'border-amber-500/32 bg-amber-950/20',
                    donatePanelClass: 'border-amber-500/36 from-amber-950/36 via-slate-900/70 to-slate-900/80',
                }
                : {
                    heroBorder: 'border-rose-500/35',
                    heroAura: 'radial-gradient(circle, rgba(244,63,94,0.30), rgba(15,23,42,0))',
                    heroTint: 'linear-gradient(135deg, rgba(244,63,94,0.14), rgba(15,23,42,0) 55%)',
                    heroShadow: '0 0 0 1px rgba(244,63,94,0.14), 0 0 45px rgba(244,63,94,0.10)',
                    snapshotGradient: 'from-slate-900/85 via-slate-900/55 to-rose-950/20',
                    sidebarGradient: 'from-slate-900/90 via-slate-900/55 to-rose-950/20',
                    shareGradient: 'from-slate-900/85 via-slate-900/55 to-rose-950/18',
                    quickCardClass: 'border-rose-500/22 bg-gradient-to-br from-rose-950/26 to-slate-900/42 shadow-[inset_0_0_20px_rgba(244,63,94,0.08)]',
                    statusMetricClass: 'border-rose-500/30 bg-rose-950/18',
                    donatePanelClass: 'border-rose-500/32 from-rose-950/30 via-slate-900/70 to-slate-900/80',
                };

    const getSharePayload = () => {
        const url = typeof window !== 'undefined'
            ? `${window.location.origin}/campaigns/${campaign.id}`
            : `/campaigns/${campaign.id}`;

        const text = `Support "${campaign.title}" on CrowdChain. ${raisedEth.toFixed(4)} ETH raised of ${goalEth.toFixed(4)} ETH.${isExpired ? ' Campaign ended.' : ` ${daysLeft} day${daysLeft === 1 ? '' : 's'} left.`}`;
        const title = `Support ${campaign.title}`;
        return { url, text, title };
    };

    const handleCopyShareLink = async () => {
        try {
            const { url } = getSharePayload();
            await navigator.clipboard.writeText(url);
            setCopiedField('share');
            setShareFeedback({
                variant: 'success',
                message: 'Campaign link copied. Share it anywhere.',
            });
            setTimeout(() => {
                setCopiedField((prev) => (prev === 'share' ? null : prev));
            }, 2000);
        } catch (error) {
            console.error('Copy share link failed:', error);
            setShareFeedback({
                variant: 'error',
                message: 'Could not copy link. Try another share option.',
            });
        }
    };

    const openShareTarget = (platform: 'x' | 'whatsapp' | 'telegram' | 'email') => {
        const { url, text, title } = getSharePayload();
        const encodedUrl = encodeURIComponent(url);
        const encodedText = encodeURIComponent(text);
        const emailSubject = encodeURIComponent(`${title} | CrowdChain`);
        const emailBody = encodeURIComponent(`${text}\n\n${url}`);

        if (platform === 'email') {
            window.location.href = `mailto:?subject=${emailSubject}&body=${emailBody}`;
            return;
        }

        let shareUrl = '';
        if (platform === 'x') {
            shareUrl = `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`;
        }
        if (platform === 'whatsapp') {
            shareUrl = `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
        }
        if (platform === 'telegram') {
            shareUrl = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
        }

        if (!shareUrl) return;
        window.open(shareUrl, '_blank', 'noopener,noreferrer');
    };

    const handleNativeShare = async () => {
        const { title, text, url } = getSharePayload();

        if (typeof navigator === 'undefined' || !('share' in navigator)) {
            await handleCopyShareLink();
            setShareFeedback({
                variant: 'info',
                message: 'Native share is unavailable here. Link copied instead.',
            });
            return;
        }

        setSharingCampaign(true);
        try {
            await navigator.share({ title, text, url });
            setShareFeedback({
                variant: 'success',
                message: 'Thanks for sharing this campaign.',
            });
        } catch (error: any) {
            const wasCancelled = error?.name === 'AbortError';
            if (!wasCancelled) {
                console.error('Native share failed:', error);
                setShareFeedback({
                    variant: 'error',
                    message: 'Share sheet failed. Use copy link or social options below.',
                });
            }
        } finally {
            setSharingCampaign(false);
        }
    };

    const detailContent = (
        <>
            <div className={contentShellClass}>
                {/* Back */}
                <button
                    onClick={() => router.push('/campaigns')}
                    className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors mb-6 text-sm font-mono"
                >
                    <ArrowLeft size={16} /> Back to Campaigns
                </button>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Hero */}
                        <div
                            className={`relative min-h-[380px] overflow-hidden rounded-sm border bg-slate-900/60 ${statusTheme.heroBorder}`}
                            style={{ boxShadow: statusTheme.heroShadow }}
                        >
                            {campaign.bannerUrl ? (
                                <img
                                    src={campaign.bannerUrl}
                                    alt={campaign.title}
                                    className="absolute inset-0 h-full w-full object-cover"
                                />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
                                    <Target size={72} weight="duotone" className="text-slate-600" />
                                </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/25 via-slate-950/25 to-slate-950" />
                            <div className="absolute inset-0 pointer-events-none" style={{ background: statusTheme.heroTint }} />
                            <div
                                className="absolute -top-24 -right-24 h-72 w-72 rounded-full blur-3xl"
                                style={{ background: statusTheme.heroAura }}
                            />

                            <div className="absolute top-4 left-4 flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center rounded-sm border border-slate-600/70 bg-slate-950/70 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-300">
                                    Campaign #{campaign.id}
                                </span>
                                <span className="inline-flex items-center rounded-sm border border-blue-700/60 bg-blue-950/50 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-blue-300">
                                    {campaign.category || 'Uncategorized'}
                                </span>
                                <span className="inline-flex items-center rounded-sm border border-slate-700/70 bg-slate-900/80 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-300">
                                    by {shortOwner}
                                </span>
                            </div>

                            <div className="absolute top-4 right-4" style={{ filter: statusBadgeGlow }}>
                                <StatusBadge status={status} />
                            </div>

                            <div className="absolute bottom-0 left-0 right-0 p-5 md:p-6 space-y-4">
                                <div>
                                    <h1 className="text-3xl md:text-4xl font-chivo font-black uppercase tracking-wider text-slate-50">
                                        {campaign.title}
                                    </h1>
                                    <p className="mt-2 text-sm md:text-base leading-relaxed text-slate-300/95 line-clamp-3">
                                        {campaign.description}
                                    </p>
                                </div>

                                <div className="rounded-sm border border-slate-700/70 bg-slate-950/75 p-4 backdrop-blur-sm">
                                    <ProgressBar percent={campaign.percentFunded} className="mb-3" showLabel={false} />
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                                        <div>
                                            <p className="text-slate-500 uppercase tracking-wider">Raised</p>
                                            <p className="text-slate-100 font-bold">{raisedEth.toFixed(4)} ETH</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-500 uppercase tracking-wider">Goal</p>
                                            <p className="text-slate-100 font-bold">{goalEth.toFixed(4)} ETH</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-500 uppercase tracking-wider">Progress</p>
                                            <p className="text-slate-100 font-bold">{fundedPercent.toFixed(2)}%</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-500 uppercase tracking-wider">Time Left</p>
                                            <p className="text-slate-100 font-bold">{isExpired ? 'Expired' : `${daysLeft}d`}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Primary Donate CTA */}
                        {canDonate && (
                            <div className={`rounded-sm border bg-gradient-to-r p-4 md:p-5 ${statusTheme.donatePanelClass}`}>
                                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                                    <div>
                                        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400">
                                            Support This Campaign
                                        </p>
                                        <h3 className="text-xl md:text-2xl font-chivo font-black uppercase tracking-wider text-slate-100 mt-1">
                                            Help Close The Remaining {remaining.toFixed(3)} ETH
                                        </h3>
                                        <p className="text-xs md:text-sm font-mono text-slate-500 mt-1">
                                            {daysLeft} day{daysLeft === 1 ? '' : 's'} left · {totalDonors} donor{totalDonors === 1 ? '' : 's'} already contributed
                                        </p>
                                    </div>
                                    {isConnected ? (
                                        <button
                                            onClick={openDonateModal}
                                            className="w-full lg:w-auto min-w-[220px] flex items-center justify-center gap-2 py-4 px-8 rounded-sm font-medium tracking-wide uppercase bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 text-white shadow-[0_0_20px_rgba(34,197,94,0.55)] transition-all"
                                        >
                                            <CurrencyEth size={20} weight="duotone" />
                                            Donate Now
                                        </button>
                                    ) : (
                                        <button
                                            onClick={connectWallet}
                                            className="w-full lg:w-auto min-w-[220px] btn-primary py-4 px-8"
                                        >
                                            Connect Wallet to Donate
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Quick Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className={`rounded-sm border p-3 ${statusTheme.quickCardClass}`}>
                                <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Donors</p>
                                <p className="text-lg font-mono font-bold text-slate-100 mt-1">{totalDonors}</p>
                            </div>
                            <div className={`rounded-sm border p-3 ${statusTheme.quickCardClass}`}>
                                <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Remaining</p>
                                <p className="text-lg font-mono font-bold text-slate-100 mt-1">{remaining.toFixed(3)} ETH</p>
                            </div>
                            <div className={`rounded-sm border p-3 ${statusTheme.quickCardClass}`}>
                                <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Avg Donation</p>
                                <p className="text-lg font-mono font-bold text-slate-100 mt-1">{averageDonation.toFixed(3)} ETH</p>
                            </div>
                            <div className={`rounded-sm border p-3 ${statusTheme.quickCardClass}`}>
                                <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Campaign Age</p>
                                <p className="text-lg font-mono font-bold text-slate-100 mt-1">
                                    {campaignAgeDays === null ? 'N/A' : `${campaignAgeDays}d`}
                                </p>
                            </div>
                        </div>

                        {/* Campaign Snapshot */}
                        <div className={`card border-slate-700/70 bg-gradient-to-br ${statusTheme.snapshotGradient}`}>
                            <h3 className="text-sm font-mono text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                                <ChartLine size={14} />
                                Campaign Snapshot
                            </h3>
                            <p className="text-xs font-mono text-slate-600 uppercase tracking-wider">
                                Live campaign telemetry and on-chain metadata
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 text-sm font-mono mt-4">
                                <div className="rounded-sm border border-slate-800/80 bg-slate-950/45 p-3">
                                    <p className="text-xs text-slate-600 uppercase">Campaign ID</p>
                                    <p className="text-slate-200 font-bold">#{campaign.id}</p>
                                </div>
                                <div className={`rounded-sm border bg-slate-950/45 p-3 ${statusTheme.statusMetricClass}`}>
                                    <p className="text-xs text-slate-600 uppercase">Status</p>
                                    <StatusBadge status={status} className="mt-1" />
                                </div>
                                <div className="rounded-sm border border-slate-800/80 bg-slate-950/45 p-3">
                                    <p className="text-xs text-slate-600 uppercase">Category</p>
                                    <p className="text-slate-200">{campaign.category || 'Uncategorized'}</p>
                                </div>
                                <div className="rounded-sm border border-slate-800/80 bg-slate-950/45 p-3">
                                    <p className="text-xs text-slate-600 uppercase">Created At</p>
                                    <p className="text-slate-200">{formatTimestamp(createdAtTimestamp)}</p>
                                </div>
                                <div className="rounded-sm border border-slate-800/80 bg-slate-950/45 p-3">
                                    <p className="text-xs text-slate-600 uppercase">Deadline</p>
                                    <p className="text-slate-200">{formatTimestamp(deadlineTimestamp)}</p>
                                </div>
                                <div className="rounded-sm border border-slate-800/80 bg-slate-950/45 p-3">
                                    <p className="text-xs text-slate-600 uppercase">Campaign Age</p>
                                    <p className="text-slate-200">
                                        {campaignAgeDays === null ? 'N/A' : `${campaignAgeDays} day${campaignAgeDays === 1 ? '' : 's'}`}
                                    </p>
                                </div>
                                <div className="rounded-sm border border-slate-800/80 bg-slate-950/45 p-3">
                                    <p className="text-xs text-slate-600 uppercase">Progress</p>
                                    <p className="text-slate-200 font-bold">{fundedPercent.toFixed(2)}%</p>
                                </div>
                                <div className="rounded-sm border border-slate-800/80 bg-slate-950/45 p-3">
                                    <p className="text-xs text-slate-600 uppercase">Goal</p>
                                    <p className="text-slate-200">{goalEth.toFixed(4)} ETH</p>
                                </div>
                                <div className="rounded-sm border border-slate-800/80 bg-slate-950/45 p-3">
                                    <p className="text-xs text-slate-600 uppercase">Raised</p>
                                    <p className="text-slate-200">{raisedEth.toFixed(4)} ETH</p>
                                </div>
                                <div className="rounded-sm border border-slate-800/80 bg-slate-950/45 p-3">
                                    <p className="text-xs text-slate-600 uppercase">Remaining</p>
                                    <p className="text-slate-200">{remaining.toFixed(4)} ETH</p>
                                </div>
                                <div className="rounded-sm border border-slate-800/80 bg-slate-950/45 p-3">
                                    <p className="text-xs text-slate-600 uppercase">Total Donors</p>
                                    <p className="text-slate-200">{totalDonors}</p>
                                </div>
                                <div className="rounded-sm border border-slate-800/80 bg-slate-950/45 p-3">
                                    <p className="text-xs text-slate-600 uppercase">Time Remaining</p>
                                    <p className="text-slate-200">{isExpired ? 'Expired' : `${daysLeft} day${daysLeft === 1 ? '' : 's'}`}</p>
                                </div>
                                <div className="rounded-sm border border-slate-800/80 bg-slate-950/45 p-3">
                                    <p className="text-xs text-slate-600 uppercase">Created (Unix)</p>
                                    <p className="text-slate-200">{createdAtTimestamp || 'N/A'}</p>
                                </div>
                                <div className="rounded-sm border border-slate-800/80 bg-slate-950/45 p-3">
                                    <p className="text-xs text-slate-600 uppercase">Deadline (Unix)</p>
                                    <p className="text-slate-200">{deadlineTimestamp || 'N/A'}</p>
                                </div>
                                <div className="rounded-sm border border-slate-800/80 bg-slate-950/45 p-3">
                                    <p className="text-xs text-slate-600 uppercase">Average Donation</p>
                                    <p className="text-slate-200">{averageDonation.toFixed(4)} ETH</p>
                                </div>
                                <div className="rounded-sm border border-slate-800/80 bg-slate-950/45 p-3">
                                    <p className="text-xs text-slate-600 uppercase">Largest Donation</p>
                                    <p className="text-slate-200">{largestDonation.toFixed(4)} ETH</p>
                                </div>
                                <div className="rounded-sm border border-slate-800/80 bg-slate-950/45 p-3 sm:col-span-2 xl:col-span-3">
                                    <p className="text-xs text-slate-600 uppercase">Last Donation</p>
                                    <p className="text-slate-200">{formatTimestamp(lastDonationTimestamp)}</p>
                                </div>
                            </div>
                        </div>

                        {/* Creator */}
                        <div className="card border-slate-700/70 bg-gradient-to-r from-slate-900/70 via-slate-900/45 to-slate-900/70">
                            <h3 className="text-sm font-mono text-slate-400 uppercase tracking-widest mb-3">Campaign Creator</h3>
                            <div className="flex items-center gap-3">
                                <div className="h-11 w-11 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-[0_0_18px_rgba(59,130,246,0.35)]">
                                    <User size={18} weight="bold" className="text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600">Owner Wallet</p>
                                    <p className="text-sm font-mono text-slate-300 break-all">{campaign.owner}</p>
                                </div>
                                <button
                                    onClick={() => copyText(campaign.owner, 'owner')}
                                    className="rounded-sm border border-slate-700 p-2 text-slate-500 hover:text-slate-300 hover:border-slate-500 transition-colors"
                                >
                                    {copiedField === 'owner' ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                                </button>
                            </div>
                        </div>

                        {/* Donors */}
                        {donors.length > 0 && (
                            <div className="card border-slate-700/70 bg-slate-900/40">
                                <h3 className="text-sm font-mono text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Lightning size={14} />
                                    Donors ({totalDonors})
                                </h3>
                                <div className="space-y-3">
                                    {donors.map((donor: any, idx: number) => (
                                        <div
                                            key={idx}
                                            className="rounded-sm border border-slate-800/80 bg-slate-950/45 p-3 flex items-center justify-between text-sm font-mono"
                                        >
                                            <div className="min-w-0 flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-full bg-slate-800/90 border border-slate-700/80 flex items-center justify-center text-[10px] text-slate-400">
                                                    {idx + 1}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-slate-300 truncate max-w-[220px]">{donor.address}</p>
                                                    <p className="text-slate-600 text-[10px]">
                                                        {formatTimestamp(Number(donor.timestamp || 0))}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-slate-100 font-bold">{donor.amount} ETH</p>
                                                <p className="text-slate-600 text-[10px] font-mono">
                                                    {donor.amountWei || '0'} wei
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6 lg:sticky lg:top-24 self-start">
                        {/* Funding Stats */}
                        <div className={`card border-slate-700/70 bg-gradient-to-br ${statusTheme.sidebarGradient}`}>
                            <h3 className="text-sm font-mono text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <CurrencyEth size={14} />
                                Funding Progress
                            </h3>
                            <p className="text-4xl font-bold font-mono text-gradient-eth mb-1">
                                {raisedEth.toFixed(2)} ETH
                            </p>
                            <p className="text-sm text-slate-500 font-mono mb-4">
                                raised of {goalEth.toFixed(2)} ETH goal
                            </p>
                            <ProgressBar percent={campaign.percentFunded} className="mb-4" showLabel={false} />
                            <p className="text-xs font-mono text-slate-500 -mt-2 mb-4">{fundedPercent.toFixed(2)}% funded</p>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-sm border border-slate-800/80 bg-slate-950/45 p-3">
                                    <p className="text-xs text-slate-600 font-mono uppercase">Remaining</p>
                                    <p className="text-sm font-bold font-mono text-slate-200">{remaining.toFixed(4)} ETH</p>
                                </div>
                                <div className="rounded-sm border border-slate-800/80 bg-slate-950/45 p-3">
                                    <p className="text-xs text-slate-600 font-mono uppercase">Donors</p>
                                    <p className="text-sm font-bold font-mono text-slate-200">{totalDonors}</p>
                                </div>
                                <div className="rounded-sm border border-slate-800/80 bg-slate-950/45 p-3">
                                    <p className="text-xs text-slate-600 font-mono uppercase">Time Left</p>
                                    <p className="text-sm font-bold font-mono text-slate-200">
                                        {isExpired ? 'Expired' : `${daysLeft}d`}
                                    </p>
                                </div>
                                <div className={`rounded-sm border bg-slate-950/45 p-3 ${statusTheme.statusMetricClass}`}>
                                    <p className="text-xs text-slate-600 font-mono uppercase">Status</p>
                                    <StatusBadge status={status} />
                                </div>
                            </div>
                        </div>

                        {/* Share Campaign */}
                        <div className={`card border-slate-700/70 bg-gradient-to-br ${statusTheme.shareGradient}`}>
                            <h3 className="text-sm font-mono text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <ShareNetwork size={14} />
                                Share Campaign
                            </h3>
                            <button
                                onClick={handleNativeShare}
                                disabled={sharingCampaign}
                                className="btn-primary w-full flex items-center justify-center gap-2"
                            >
                                <ShareNetwork size={16} weight="duotone" />
                                {sharingCampaign ? 'Opening Share...' : 'Quick Share'}
                            </button>

                            <div className="grid grid-cols-2 gap-2 mt-3">
                                <button
                                    onClick={handleCopyShareLink}
                                    className="rounded-sm border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs font-mono uppercase tracking-wider text-slate-200 hover:border-slate-500 hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5"
                                >
                                    <LinkSimple size={14} />
                                    {copiedField === 'share' ? 'Copied' : 'Copy Link'}
                                </button>
                                <button
                                    onClick={() => openShareTarget('x')}
                                    className="rounded-sm border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs font-mono uppercase tracking-wider text-slate-200 hover:border-slate-500 hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5"
                                >
                                    <XLogo size={14} />
                                    X
                                </button>
                                <button
                                    onClick={() => openShareTarget('whatsapp')}
                                    className="rounded-sm border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs font-mono uppercase tracking-wider text-slate-200 hover:border-slate-500 hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5"
                                >
                                    <WhatsappLogo size={14} />
                                    WhatsApp
                                </button>
                                <button
                                    onClick={() => openShareTarget('telegram')}
                                    className="rounded-sm border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs font-mono uppercase tracking-wider text-slate-200 hover:border-slate-500 hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5"
                                >
                                    <TelegramLogo size={14} />
                                    Telegram
                                </button>
                                <button
                                    onClick={() => openShareTarget('email')}
                                    className="col-span-2 rounded-sm border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs font-mono uppercase tracking-wider text-slate-200 hover:border-slate-500 hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5"
                                >
                                    <EnvelopeSimple size={14} />
                                    Email Campaign
                                </button>
                            </div>

                            {shareFeedback && (
                                <p
                                    className={`mt-3 text-xs font-mono ${shareFeedback.variant === 'success'
                                        ? 'text-emerald-300'
                                        : shareFeedback.variant === 'error'
                                            ? 'text-red-300'
                                            : 'text-blue-300'
                                        }`}
                                >
                                    {shareFeedback.message}
                                </p>
                            )}
                        </div>

                        {/* Converter */}
                        <CurrencyConverter />

                        {/* Deadline */}
                        <div className="card border-slate-700/70 bg-slate-900/45">
                            <h3 className="text-sm font-mono text-slate-400 uppercase tracking-widest mb-2">
                                <Clock size={14} className="inline mr-2" />
                                Deadline
                            </h3>
                            <p className="text-sm font-mono text-slate-300">
                                {new Date(campaign.deadline * 1000).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })}
                            </p>
                            <p className="text-xs font-mono text-slate-600 mt-2">
                                Unix: {campaign.deadline}
                            </p>
                        </div>

                        {/* On-Chain Details */}
                        <div className="card border-slate-700/70 bg-slate-900/45">
                            <h3 className="text-sm font-mono text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <Cube size={14} />
                                On-Chain Details
                            </h3>
                            <div className="space-y-2 text-xs font-mono">
                                <div className="flex items-start justify-between gap-3">
                                    <span className="text-slate-500">Banner CID</span>
                                    <div className="text-right">
                                        <p className="text-slate-300 break-all max-w-[220px]">{campaign.bannerCID || 'N/A'}</p>
                                        {campaign.bannerCID ? (
                                            <button
                                                onClick={() => copyText(campaign.bannerCID, 'cid')}
                                                className="text-slate-500 hover:text-slate-300 transition-colors mt-1"
                                            >
                                                {copiedField === 'cid' ? <Check size={14} className="text-green-400 inline" /> : <Copy size={14} className="inline" />}
                                            </button>
                                        ) : null}
                                    </div>
                                </div>
                                <div className="flex justify-between gap-3">
                                    <span className="text-slate-500">Goal (wei)</span>
                                    <span className="text-slate-300 break-all text-right">{goalWei}</span>
                                </div>
                                <div className="flex justify-between gap-3">
                                    <span className="text-slate-500">Raised (wei)</span>
                                    <span className="text-slate-300 break-all text-right">{amountCollectedWei}</span>
                                </div>
                                <div className="flex justify-between gap-3">
                                    <span className="text-slate-500">Remaining (wei)</span>
                                    <span className="text-slate-300 break-all text-right">{remainingWei}</span>
                                </div>
                                <div className="flex justify-between gap-3">
                                    <span className="text-slate-500">Created (unix)</span>
                                    <span className="text-slate-300 text-right">{createdAtTimestamp || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between gap-3">
                                    <span className="text-slate-500">Platform Status</span>
                                    <span className="text-slate-300 text-right">{platformStatus}</span>
                                </div>
                                {platformMeta ? (
                                    <div className="flex justify-between gap-3">
                                        <span className="text-slate-500">Creation Fee</span>
                                        <span className="text-slate-300 text-right">{platformMeta.creationFeeEth} ETH</span>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Donate Modal */}
            <Modal
                isOpen={donateModalOpen}
                onClose={() => setDonateModalOpen(false)}
                title="Donate to Campaign"
            >
                <div className="space-y-4">
                    {donateFeedback && (
                        <div
                            className={`rounded-sm border p-3 ${donateFeedback.variant === 'error'
                                ? 'border-red-800/70 bg-red-950/40 text-red-200'
                                : 'border-blue-800/70 bg-blue-950/30 text-blue-200'
                                }`}
                        >
                            <p className="text-xs font-mono uppercase tracking-wider flex items-center gap-2">
                                <Info size={12} />
                                {donateFeedback.variant === 'error' ? 'Donation Failed' : 'Transaction Cancelled'}
                            </p>
                            <p className="text-xs font-mono mt-1">{donateFeedback.message}</p>
                        </div>
                    )}
                    <div>
                        <label className="block text-xs font-mono text-slate-500 uppercase tracking-wider mb-2">
                            Amount (ETH)
                        </label>
                        <input
                            type="number"
                            value={donateAmount}
                            onChange={(e) => {
                                setDonateAmount(e.target.value);
                                if (donateFeedback) {
                                    setDonateFeedback(null);
                                }
                            }}
                            placeholder="0.01"
                            className="input-modern"
                            step="0.001"
                            min="0"
                        />
                        {hasValidDonateAmount && (
                            <div className="mt-3 rounded-sm border border-slate-800 bg-slate-900/60 p-3">
                                {inrRateLoading ? (
                                    <p className="text-xs font-mono text-slate-500">
                                        Fetching live INR conversion...
                                    </p>
                                ) : inrEstimate !== null ? (
                                    <>
                                        <p className="text-xs font-mono uppercase tracking-wider text-slate-500">
                                            Approximate INR
                                        </p>
                                        <p className="text-lg font-mono font-bold text-slate-100 mt-1">
                                            {new Intl.NumberFormat('en-IN', {
                                                style: 'currency',
                                                currency: 'INR',
                                                maximumFractionDigits: 2,
                                            }).format(inrEstimate)}
                                        </p>
                                        <p className="text-[11px] font-mono text-slate-600 mt-1">
                                            1 ETH = {new Intl.NumberFormat('en-IN', {
                                                style: 'currency',
                                                currency: 'INR',
                                                maximumFractionDigits: 2,
                                            }).format(inrRate ?? 0)} (live)
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-xs font-mono text-amber-400">
                                        {inrRateError || 'INR conversion unavailable right now'}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                    <p className="text-xs text-slate-600 font-mono">
                        MetaMask will open to confirm the transaction.
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setDonateModalOpen(false)}
                            className="btn-secondary flex-1"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleDonate}
                            disabled={donating || !donateAmount || parseFloat(donateAmount) <= 0}
                            className="btn-success flex-1"
                        >
                            {donating ? 'Processing...' : 'Confirm Donation'}
                        </button>
                    </div>
                </div>
            </Modal>
        </>
    );

    if (isConnected) {
        return <DashboardLayout>{detailContent}</DashboardLayout>;
    }

    return (
        <div className="min-h-screen bg-slate-950 relative">
            <div className="scanlines" />
            {detailContent}
        </div>
    );
}
