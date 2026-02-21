'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Users, Target } from '@phosphor-icons/react';
import { ProgressBar } from './ProgressBar';
import { StatusBadge } from './StatusBadge';

interface Campaign {
    id: number;
    title: string;
    description: string;
    category?: string;
    goal: string;
    amountCollected: string;
    deadline: number;
    bannerUrl: string | null;
    bannerCID: string;
    isActive: boolean;
    percentFunded: number;
    owner: string;
}

interface CampaignCardProps {
    campaign: Campaign;
}

export default function CampaignCard({ campaign }: CampaignCardProps) {
    const router = useRouter();
    const now = Math.floor(Date.now() / 1000);
    const isExpired = campaign.deadline < now;
    const daysLeft = Math.max(0, Math.ceil((campaign.deadline - now) / 86400));

    const status = !campaign.isActive
        ? 'DELETED'
        : campaign.percentFunded >= 100
            ? 'COMPLETED'
            : isExpired
                ? 'EXPIRED'
                : 'ACTIVE';

    return (
        <div
            onClick={() => router.push(`/campaigns/${campaign.id}`)}
            className="card card-hover cursor-pointer group animate-slide-up"
        >
            {/* Banner */}
            <div className="relative h-44 -mx-4 -mt-4 mb-4 overflow-hidden rounded-t-sm bg-slate-900">
                {campaign.bannerUrl ? (
                    <img
                        src={campaign.bannerUrl}
                        alt={campaign.title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
                        <Target size={48} weight="duotone" className="text-slate-600" />
                    </div>
                )}
                <div className="absolute top-3 right-3">
                    <StatusBadge status={status} />
                </div>
            </div>

            {/* Content */}
            {campaign.category && (
                <div className="mb-2">
                    <span className="inline-flex items-center rounded-sm border border-blue-700/50 bg-blue-950/40 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-blue-300">
                        {campaign.category}
                    </span>
                </div>
            )}
            <h3 className="font-chivo font-bold text-lg uppercase tracking-wider text-slate-100 mb-2 truncate">
                {campaign.title}
            </h3>
            <p className="text-slate-400 text-sm line-clamp-2 mb-4 min-h-[2.5rem]">
                {campaign.description}
            </p>

            {/* Progress */}
            <ProgressBar percent={campaign.percentFunded} className="mb-4" />

            {/* Stats */}
            <div className="flex items-center justify-between text-xs font-mono">
                <div className="text-slate-400">
                    <span className="text-slate-100 font-bold">{campaign.amountCollected}</span>
                    {' / '}
                    {campaign.goal} ETH
                </div>
                <div className="flex items-center gap-1 text-slate-500">
                    <Clock size={14} />
                    {status === 'ACTIVE' ? (
                        <span>{daysLeft}d left</span>
                    ) : (
                        <span>{status.toLowerCase()}</span>
                    )}
                </div>
            </div>
        </div>
    );
}
