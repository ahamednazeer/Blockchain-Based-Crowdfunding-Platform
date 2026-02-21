'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/contexts/WalletContext';
import { api } from '@/lib/api';
import { createCampaign, getCampaignCreationFeeEth } from '@/lib/contract';
import DashboardLayout from '@/components/DashboardLayout';
import {
    Rocket,
    Image as ImageIcon,
    X,
    UploadSimple,
    SlidersHorizontal,
    Check,
    CalendarDots,
    CurrencyEth,
    TextAlignLeft,
    TextT,
    Tag,
    ArrowLeft,
} from '@phosphor-icons/react';

export default function CreateCampaignPage() {
    const router = useRouter();
    const { isConnected, connectWallet } = useWallet();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('');
    const [goal, setGoal] = useState('');
    const [deadline, setDeadline] = useState('');
    const [bannerFile, setBannerFile] = useState<File | null>(null);
    const [bannerSourceFile, setBannerSourceFile] = useState<File | null>(null);
    const [bannerPreview, setBannerPreview] = useState<string | null>(null);
    const [bannerSourcePreview, setBannerSourcePreview] = useState<string | null>(null);
    const [isAdjustingBanner, setIsAdjustingBanner] = useState(false);
    const [bannerOffsetX, setBannerOffsetX] = useState(0);
    const [bannerOffsetY, setBannerOffsetY] = useState(0);
    const [bannerScale, setBannerScale] = useState(1);
    const [applyingBannerAdjust, setApplyingBannerAdjust] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');
    const [step, setStep] = useState(1); // 1=form, 2=preview, 3=success
    const [creationFeeEth, setCreationFeeEth] = useState<string>('0');
    const bannerPreviewRef = useRef<string | null>(null);
    const bannerSourcePreviewRef = useRef<string | null>(null);

    useEffect(() => {
        if (!isConnected) return;
        let cancelled = false;
        async function fetchCreationFee() {
            try {
                const meta = await api.getCampaignMeta();
                if (!cancelled && meta?.creationFeeEth) {
                    setCreationFeeEth(meta.creationFeeEth);
                    return;
                }
            } catch {
                // Fallback below
            }

            try {
                const fee = await getCampaignCreationFeeEth();
                if (!cancelled) setCreationFeeEth(fee.eth);
            } catch {
                if (!cancelled) setCreationFeeEth('0');
            }
        }
        fetchCreationFee();
        return () => {
            cancelled = true;
        };
    }, [isConnected]);

    useEffect(() => {
        bannerPreviewRef.current = bannerPreview;
    }, [bannerPreview]);

    useEffect(() => {
        bannerSourcePreviewRef.current = bannerSourcePreview;
    }, [bannerSourcePreview]);

    useEffect(() => {
        return () => {
            const urls = new Set<string>();
            if (bannerPreviewRef.current) urls.add(bannerPreviewRef.current);
            if (bannerSourcePreviewRef.current) urls.add(bannerSourcePreviewRef.current);
            urls.forEach((url) => URL.revokeObjectURL(url));
        };
    }, []);

    const resetBannerAdjustments = () => {
        setBannerOffsetX(0);
        setBannerOffsetY(0);
        setBannerScale(1);
    };

    const cleanupBannerUrls = () => {
        const urls = new Set<string>();
        if (bannerPreview) urls.add(bannerPreview);
        if (bannerSourcePreview) urls.add(bannerSourcePreview);
        urls.forEach((url) => URL.revokeObjectURL(url));
    };

    if (!isConnected) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="scanlines" />
                <div className="card text-center py-16 px-8 max-w-md">
                    <Rocket size={48} weight="duotone" className="text-blue-400 mx-auto mb-4" />
                    <h2 className="text-xl font-chivo font-bold uppercase tracking-wider mb-2">Connect Wallet</h2>
                    <p className="text-slate-400 text-sm mb-6">You need to connect your MetaMask wallet to create a campaign.</p>
                    <button onClick={connectWallet} className="btn-primary">
                        Connect Wallet
                    </button>
                </div>
            </div>
        );
    }

    const handleBannerSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Validate
            const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (!allowed.includes(file.type)) {
                setError('Only JPEG, PNG, GIF, and WebP images are allowed');
                return;
            }
            if (file.size > 10 * 1024 * 1024) {
                setError('Image must be less than 10MB');
                return;
            }
            cleanupBannerUrls();
            const sourceUrl = URL.createObjectURL(file);
            setBannerFile(file);
            setBannerSourceFile(file);
            setBannerPreview(sourceUrl);
            setBannerSourcePreview(sourceUrl);
            setIsAdjustingBanner(false);
            resetBannerAdjustments();
            setError('');
        }
    };

    const removeBanner = () => {
        cleanupBannerUrls();
        setBannerFile(null);
        setBannerSourceFile(null);
        setBannerPreview(null);
        setBannerSourcePreview(null);
        setIsAdjustingBanner(false);
        resetBannerAdjustments();
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const applyBannerAdjustments = async () => {
        if (!bannerSourcePreview || !bannerSourceFile) return;

        setApplyingBannerAdjust(true);
        try {
            const img = await new Promise<HTMLImageElement>((resolve, reject) => {
                const image = new Image();
                image.onload = () => resolve(image);
                image.onerror = () => reject(new Error('Failed to load selected image'));
                image.src = bannerSourcePreview;
            });

            const width = 1600;
            const height = 700;
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                throw new Error('Unable to create image editor');
            }

            const baseScale = Math.max(width / img.width, height / img.height);
            const drawScale = baseScale * bannerScale;
            const drawWidth = img.width * drawScale;
            const drawHeight = img.height * drawScale;

            const centerX = (width - drawWidth) / 2;
            const centerY = (height - drawHeight) / 2;
            const maxOffsetXPx = Math.max(0, (drawWidth - width) / 2);
            const maxOffsetYPx = Math.max(0, (drawHeight - height) / 2);

            const drawX = centerX + (bannerOffsetX / 100) * maxOffsetXPx;
            const drawY = centerY + (bannerOffsetY / 100) * maxOffsetYPx;

            ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

            const blob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob(
                    (generated) => {
                        if (generated) {
                            resolve(generated);
                            return;
                        }
                        reject(new Error('Unable to export adjusted image'));
                    },
                    'image/webp',
                    0.92
                );
            });

            const cleanName = bannerSourceFile.name.replace(/\.[^/.]+$/, '') || 'campaign-banner';
            const adjustedFile = new File([blob], `${cleanName}-adjusted.webp`, { type: 'image/webp' });
            const adjustedPreview = URL.createObjectURL(adjustedFile);

            if (bannerPreview && bannerPreview !== bannerSourcePreview) {
                URL.revokeObjectURL(bannerPreview);
            }

            setBannerFile(adjustedFile);
            setBannerPreview(adjustedPreview);
            setIsAdjustingBanner(false);
        } catch (err) {
            console.error('Banner adjustment failed:', err);
            setError('Failed to apply banner adjustment');
        } finally {
            setApplyingBannerAdjust(false);
        }
    };

    const handleSubmit = async () => {
        setError('');

        // Validate
        if (!title.trim()) return setError('Title is required');
        if (!description.trim()) return setError('Description is required');
        if (!category.trim()) return setError('Category is required');
        if (!goal || parseFloat(goal) <= 0) return setError('Valid goal amount is required');
        if (!deadline) return setError('Deadline is required');
        if (!bannerFile) return setError('Banner image is required');

        const deadlineTimestamp = Math.floor(new Date(deadline).getTime() / 1000);
        if (deadlineTimestamp <= Math.floor(Date.now() / 1000)) {
            return setError('Deadline must be in the future');
        }

        setCreating(true);

        try {
            // Step 1: Upload banner to Pinata
            setUploading(true);
            const uploadResult = await api.uploadBanner(bannerFile);
            setUploading(false);

            // Step 2: Create campaign on blockchain via MetaMask
            await createCampaign(
                title.trim(),
                description.trim(),
                category.trim(),
                goal,
                deadlineTimestamp,
                uploadResult.cid
            );

            setStep(3);
        } catch (err: any) {
            console.error('Campaign creation failed:', err);
            setError(err?.reason || err?.message || 'Failed to create campaign');
            setUploading(false);
        } finally {
            setCreating(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="max-w-2xl mx-auto">
                {step === 3 ? (
                    /* Success */
                    <div className="card text-center py-16 animate-scale-in">
                        <Rocket size={64} weight="duotone" className="text-green-400 mx-auto mb-4" />
                        <h2 className="text-2xl font-chivo font-bold uppercase tracking-wider mb-2">
                            Campaign Created
                        </h2>
                        <p className="text-slate-400 mb-6">
                            Your campaign has been permanently stored on the blockchain.
                        </p>
                        <div className="flex gap-4 justify-center">
                            <button onClick={() => router.push('/campaigns')} className="btn-primary">
                                Browse Campaigns
                            </button>
                            <button onClick={() => { setStep(1); setTitle(''); setDescription(''); setCategory(''); setGoal(''); setDeadline(''); removeBanner(); }} className="btn-secondary">
                                Create Another
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="mb-8">
                            <button
                                onClick={() => router.back()}
                                className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors mb-4 text-sm font-mono"
                            >
                                <ArrowLeft size={16} /> Back
                            </button>
                            <h1 className="text-2xl font-chivo font-bold uppercase tracking-wider flex items-center gap-3">
                                <Rocket size={28} weight="duotone" className="text-blue-400" />
                                Create Campaign
                            </h1>
                            <p className="text-slate-500 mt-1">Launch your campaign on the blockchain</p>
                        </div>

                        {error && (
                            <div className="card border-red-800 bg-red-950/30 mb-6 text-red-400 text-sm font-mono">
                                {error}
                            </div>
                        )}

                        <div className="space-y-6">
                            {/* Banner Upload */}
                            <div className="card">
                                <label className="block text-xs font-mono text-slate-500 uppercase tracking-wider mb-3">
                                    <ImageIcon size={14} className="inline mr-2" />
                                    Campaign Banner *
                                </label>
                                {bannerPreview ? (
                                    <div className="space-y-3">
                                        <div className="relative w-full aspect-[16/7] rounded-sm overflow-hidden border border-slate-700 bg-slate-900">
                                            <img
                                                src={isAdjustingBanner && bannerSourcePreview ? bannerSourcePreview : bannerPreview}
                                                alt="Banner preview"
                                                className="absolute inset-0 w-full h-full object-cover transition-transform duration-200"
                                                style={
                                                    isAdjustingBanner
                                                        ? {
                                                            transform: `scale(${bannerScale})`,
                                                            objectPosition: `${50 + bannerOffsetX / 2}% ${50 + bannerOffsetY / 2}%`,
                                                        }
                                                        : undefined
                                                }
                                            />
                                            <div className="absolute top-3 right-3 flex items-center gap-2">
                                                <button
                                                    onClick={() => setIsAdjustingBanner((prev) => !prev)}
                                                    className="bg-slate-900/85 border border-slate-700 text-slate-200 hover:text-white px-2.5 py-1 rounded-sm text-xs font-mono uppercase tracking-wider flex items-center gap-1.5"
                                                >
                                                    <SlidersHorizontal size={12} />
                                                    {isAdjustingBanner ? 'Close' : 'Adjust'}
                                                </button>
                                                <button
                                                    onClick={removeBanner}
                                                    className="bg-slate-900/80 text-slate-300 hover:text-white p-1.5 rounded-full transition-colors"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        </div>
                                        <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest">
                                            Final banner ratio: 16:7
                                        </p>

                                        {isAdjustingBanner && bannerSourcePreview && (
                                            <div className="rounded-sm border border-slate-700 bg-slate-900/70 p-4 space-y-4">
                                                <p className="text-xs font-mono text-slate-400 uppercase tracking-widest">
                                                    Reposition & Zoom
                                                </p>
                                                <div className="space-y-3">
                                                    <div>
                                                        <div className="flex items-center justify-between text-xs font-mono text-slate-500 mb-1">
                                                            <span>Horizontal</span>
                                                            <span>{bannerOffsetX}</span>
                                                        </div>
                                                        <input
                                                            type="range"
                                                            min={-100}
                                                            max={100}
                                                            value={bannerOffsetX}
                                                            onChange={(e) => setBannerOffsetX(Number(e.target.value))}
                                                            className="w-full accent-blue-500"
                                                        />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center justify-between text-xs font-mono text-slate-500 mb-1">
                                                            <span>Vertical</span>
                                                            <span>{bannerOffsetY}</span>
                                                        </div>
                                                        <input
                                                            type="range"
                                                            min={-100}
                                                            max={100}
                                                            value={bannerOffsetY}
                                                            onChange={(e) => setBannerOffsetY(Number(e.target.value))}
                                                            className="w-full accent-blue-500"
                                                        />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center justify-between text-xs font-mono text-slate-500 mb-1">
                                                            <span>Zoom</span>
                                                            <span>{bannerScale.toFixed(2)}x</span>
                                                        </div>
                                                        <input
                                                            type="range"
                                                            min={1}
                                                            max={2}
                                                            step={0.01}
                                                            value={bannerScale}
                                                            onChange={(e) => setBannerScale(Number(e.target.value))}
                                                            className="w-full accent-blue-500"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={resetBannerAdjustments}
                                                        type="button"
                                                        className="btn-secondary"
                                                    >
                                                        Reset
                                                    </button>
                                                    <button
                                                        onClick={applyBannerAdjustments}
                                                        type="button"
                                                        disabled={applyingBannerAdjust}
                                                        className="btn-primary flex items-center gap-1.5"
                                                    >
                                                        {applyingBannerAdjust ? 'Applying...' : (
                                                            <>
                                                                <Check size={14} />
                                                                Apply
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full aspect-[16/7] border-2 border-dashed border-slate-700 rounded-sm flex flex-col items-center justify-center gap-3 hover:border-blue-500 transition-colors"
                                    >
                                        <UploadSimple size={32} className="text-slate-500" />
                                        <span className="text-sm text-slate-500 font-mono">Click to upload banner</span>
                                        <span className="text-xs text-slate-600 font-mono">JPEG, PNG, GIF, WebP (max 10MB)</span>
                                    </button>
                                )}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/gif,image/webp"
                                    onChange={handleBannerSelect}
                                    className="hidden"
                                />
                            </div>

                            {/* Title */}
                            <div className="card">
                                <label className="block text-xs font-mono text-slate-500 uppercase tracking-wider mb-2">
                                    <TextT size={14} className="inline mr-2" />
                                    Campaign Title *
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g. Build a Solar Farm"
                                    className="input-modern"
                                    maxLength={100}
                                />
                            </div>

                            {/* Description */}
                            <div className="card">
                                <label className="block text-xs font-mono text-slate-500 uppercase tracking-wider mb-2">
                                    <TextAlignLeft size={14} className="inline mr-2" />
                                    Description *
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Describe your campaign in detail..."
                                    className="input-modern min-h-[120px] resize-y"
                                    maxLength={2000}
                                />
                            </div>

                            {/* Category */}
                            <div className="card">
                                <label className="block text-xs font-mono text-slate-500 uppercase tracking-wider mb-2">
                                    <Tag size={14} className="inline mr-2" />
                                    Category *
                                </label>
                                <select
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    className="input-modern"
                                >
                                    <option value="">Select a category</option>
                                    <option value="Technology">Technology</option>
                                    <option value="Health">Health</option>
                                    <option value="Education">Education</option>
                                    <option value="Environment">Environment</option>
                                    <option value="Community">Community</option>
                                    <option value="Arts">Arts</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>

                            {/* Goal & Deadline */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="card">
                                    <label className="block text-xs font-mono text-slate-500 uppercase tracking-wider mb-2">
                                        <CurrencyEth size={14} className="inline mr-2" />
                                        Funding Goal (ETH) *
                                    </label>
                                    <input
                                        type="number"
                                        value={goal}
                                        onChange={(e) => setGoal(e.target.value)}
                                        placeholder="1.0"
                                        className="input-modern"
                                        step="0.001"
                                        min="0"
                                    />
                                </div>
                                <div className="card">
                                    <label className="block text-xs font-mono text-slate-500 uppercase tracking-wider mb-2">
                                        <CalendarDots size={14} className="inline mr-2" />
                                        Deadline *
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={deadline}
                                        onChange={(e) => setDeadline(e.target.value)}
                                        className="input-modern"
                                        min={new Date().toISOString().slice(0, 16)}
                                    />
                                </div>
                            </div>

                            <div className="card border-blue-900/60 bg-blue-950/20">
                                <p className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-1">
                                    Platform Commission
                                </p>
                                <p className="text-sm font-mono text-slate-200">
                                    Creating a campaign costs <span className="text-gradient-eth font-bold">{creationFeeEth} ETH</span> paid to platform admin.
                                </p>
                            </div>

                            {/* Submit */}
                            <button
                                onClick={handleSubmit}
                                disabled={creating}
                                className="btn-primary w-full py-4 text-base flex items-center justify-center gap-3"
                            >
                                {uploading ? 'Uploading Banner...' : creating ? 'Confirm in MetaMask...' : (
                                    <>
                                        <Rocket size={20} weight="duotone" />
                                        Create Campaign
                                    </>
                                )}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </DashboardLayout>
    );
}
