import React from 'react';

interface ProgressBarProps {
    percent: number;
    className?: string;
    showLabel?: boolean;
}

export function ProgressBar({ percent, className = '', showLabel = true }: ProgressBarProps) {
    const clampedPercent = Math.min(100, Math.max(0, percent));

    return (
        <div className={className}>
            <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{
                        width: `${clampedPercent}%`,
                        background: clampedPercent >= 100
                            ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                            : 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                        boxShadow: clampedPercent > 0
                            ? clampedPercent >= 100
                                ? '0 0 8px rgba(34, 197, 94, 0.6)'
                                : '0 0 8px rgba(59, 130, 246, 0.6)'
                            : 'none',
                    }}
                />
            </div>
            {showLabel && (
                <p className="text-xs font-mono text-slate-400 mt-1">
                    {clampedPercent}% funded
                </p>
            )}
        </div>
    );
}
