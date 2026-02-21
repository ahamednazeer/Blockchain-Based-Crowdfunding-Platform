'use client';

import React, { useState } from 'react';
import { CurrencyDollar, ArrowRight } from '@phosphor-icons/react';
import { api } from '@/lib/api';

export default function CurrencyConverter() {
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState('usd');
    const [result, setResult] = useState<{ ethAmount: number; rate: number } | null>(null);
    const [loading, setLoading] = useState(false);

    const handleConvert = async () => {
        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return;
        setLoading(true);
        try {
            const data = await api.convertCurrency(Number(amount), currency);
            setResult({ ethAmount: data.ethAmount, rate: data.rate });
        } catch (error) {
            console.error('Conversion failed:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card">
            <h3 className="text-sm font-mono text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <CurrencyDollar size={16} weight="duotone" />
                Currency Converter
            </h3>

            <div className="space-y-3">
                <div className="flex gap-2">
                    <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="Amount"
                        className="input-modern flex-1"
                        min="0"
                        step="any"
                    />
                    <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        className="input-modern w-24"
                    >
                        <option value="usd">USD</option>
                        <option value="eur">EUR</option>
                        <option value="gbp">GBP</option>
                        <option value="inr">INR</option>
                    </select>
                </div>

                <button
                    onClick={handleConvert}
                    disabled={loading || !amount}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                >
                    {loading ? 'Converting...' : (
                        <>
                            Convert <ArrowRight size={16} />
                        </>
                    )}
                </button>

                {result && (
                    <div className="bg-slate-900/50 border border-slate-800 rounded-sm p-4 animate-scale-in">
                        <p className="text-xs text-slate-500 font-mono uppercase tracking-wider mb-1">Equivalent ETH</p>
                        <p className="text-2xl font-bold font-mono text-gradient-eth">
                            {result.ethAmount.toFixed(6)} ETH
                        </p>
                        <p className="text-xs text-slate-600 font-mono mt-1">
                            Rate: 1 ETH = {result.rate.toLocaleString()} {currency.toUpperCase()}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
