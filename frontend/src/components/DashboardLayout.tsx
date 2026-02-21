'use client';

import React, { useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useWallet } from '@/contexts/WalletContext';
import {
    Cube,
    SignOut,
    Gauge,
    MagnifyingGlass,
    PlusCircle,
    CurrencyEth,
    Wallet,
    ShieldCheck,
    List,
    House,
} from '@phosphor-icons/react';

interface MenuItem {
    icon: React.ElementType;
    label: string;
    path: string;
}

interface DashboardLayoutProps {
    children: ReactNode;
}

const MIN_WIDTH = 60;
const COLLAPSED_WIDTH = 64;
const DEFAULT_WIDTH = 64;
const MAX_WIDTH = 320;

const menuItemsByRole: Record<string, MenuItem[]> = {
    admin: [
        { icon: Gauge, label: 'Admin Dashboard', path: '/admin' },
        { icon: MagnifyingGlass, label: 'Browse Campaigns', path: '/campaigns' },
        { icon: PlusCircle, label: 'Create Campaign', path: '/create' },
    ],
    user: [
        { icon: Gauge, label: 'Dashboard', path: '/dashboard' },
        { icon: MagnifyingGlass, label: 'Browse Campaigns', path: '/campaigns' },
        { icon: CurrencyEth, label: 'My Contributions', path: '/contributions' },
        { icon: PlusCircle, label: 'Create Campaign', path: '/create' },
    ],
};

export default function DashboardLayout({ children }: DashboardLayoutProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { account, role, isAdmin, walletName, disconnectWallet } = useWallet();

    const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);
    const [isResizing, setIsResizing] = useState(false);
    const [isHidden, setIsHidden] = useState(false);
    const sidebarRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const savedWidth = localStorage.getItem('sidebarWidth');
        const savedHidden = localStorage.getItem('sidebarHidden');
        if (savedWidth) setSidebarWidth(parseInt(savedWidth));
        if (savedHidden === 'true') setIsHidden(true);
    }, []);

    useEffect(() => {
        if (!isResizing) {
            localStorage.setItem('sidebarWidth', sidebarWidth.toString());
            localStorage.setItem('sidebarHidden', isHidden.toString());
        }
    }, [sidebarWidth, isHidden, isResizing]);

    const startResizing = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
    }, []);

    const stopResizing = useCallback(() => {
        setIsResizing(false);
    }, []);

    const resize = useCallback((e: MouseEvent) => {
        if (isResizing && sidebarRef.current) {
            const newWidth = e.clientX;
            if (newWidth < MIN_WIDTH) {
                setIsHidden(true);
                setSidebarWidth(COLLAPSED_WIDTH);
            } else {
                setIsHidden(false);
                const clampedWidth = Math.min(MAX_WIDTH, Math.max(COLLAPSED_WIDTH, newWidth));
                setSidebarWidth(clampedWidth);
            }
        }
    }, [isResizing]);

    useEffect(() => {
        window.addEventListener('mousemove', resize);
        window.addEventListener('mouseup', stopResizing);
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [resize, stopResizing]);

    const handleDisconnect = () => {
        disconnectWallet();
        router.push('/');
    };

    const menuItems = menuItemsByRole[role] || menuItemsByRole.user;
    const isCollapsed = sidebarWidth < 150;
    const showLabels = sidebarWidth >= 150 && !isHidden;

    const truncatedAddress = account
        ? `${account.slice(0, 6)}...${account.slice(-4)}`
        : '';

    return (
        <div className="min-h-screen bg-slate-950 flex">
            <div className="scanlines" />

            {/* Sidebar */}
            <aside
                ref={sidebarRef}
                className={`print:hidden bg-slate-900 border-r border-slate-800 h-screen sticky top-0 flex flex-col z-50 transition-all ${isResizing ? 'transition-none' : 'duration-200'
                    } ${isHidden ? 'w-0 overflow-hidden border-0' : ''}`}
                style={{ width: isHidden ? 0 : sidebarWidth }}
            >
                {/* Header */}
                <div className={`p-4 border-b border-slate-800 flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
                    <Cube size={28} weight="duotone" className="text-blue-400 flex-shrink-0" />
                    {showLabels && (
                        <div className="overflow-hidden">
                            <h1 className="font-chivo font-bold text-sm uppercase tracking-wider whitespace-nowrap">CrowdChain</h1>
                            <p className="text-xs text-slate-500 font-mono">{role.toUpperCase()}</p>
                        </div>
                    )}
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-2 overflow-y-auto overflow-x-hidden">
                    <ul className="space-y-1">
                        {menuItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = pathname === item.path
                                || (item.path !== '/' && pathname.startsWith(`${item.path}/`));
                            return (
                                <li key={item.path}>
                                    <button
                                        onClick={() => router.push(item.path)}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-sm transition-all duration-150 text-sm font-medium ${isCollapsed ? 'justify-center' : ''
                                            } ${isActive
                                                ? 'text-blue-400 bg-blue-950/50 border-l-2 border-blue-400'
                                                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                                            }`}
                                        title={isCollapsed ? item.label : undefined}
                                    >
                                        <Icon size={20} weight="duotone" className="flex-shrink-0" />
                                        {showLabels && <span className="truncate">{item.label}</span>}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </nav>

                {/* Wallet Info & Disconnect */}
                <div className="p-2 border-t border-slate-800">
                    {showLabels && (
                        <div className="px-3 py-2 mb-1">
                            <p className="text-xs text-slate-600 font-mono uppercase tracking-wider">Wallet</p>
                            <p className="text-xs text-blue-400 font-medium truncate">{walletName}</p>
                            <p className="text-xs text-slate-400 font-mono truncate">{truncatedAddress}</p>
                        </div>
                    )}
                    <button
                        onClick={handleDisconnect}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-red-400 hover:text-red-300 hover:bg-slate-800 rounded-sm transition-all duration-150 text-sm font-medium ${isCollapsed ? 'justify-center' : ''}`}
                        title={isCollapsed ? 'Disconnect' : undefined}
                    >
                        <SignOut size={20} className="flex-shrink-0" />
                        {showLabels && 'Disconnect'}
                    </button>
                </div>

                {/* Resize Handle */}
                <div
                    className="absolute right-0 top-0 h-full w-1 cursor-ew-resize hover:bg-blue-500/50 active:bg-blue-500 transition-colors z-50"
                    onMouseDown={startResizing}
                    style={{ transform: 'translateX(50%)' }}
                />
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto relative z-10">
                {/* Header */}
                <div className="print:hidden backdrop-blur-md bg-slate-950/80 border-b border-slate-700 sticky top-0 z-40">
                    <div className="flex items-center justify-between px-6 py-4">
                        <div className="flex items-center gap-4">
                            {isHidden && (
                                <button
                                    onClick={() => { setIsHidden(false); setSidebarWidth(DEFAULT_WIDTH); }}
                                    className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
                                    title="Show Sidebar"
                                >
                                    <List size={24} />
                                </button>
                            )}
                            <div>
                                <h2 className="font-chivo font-bold text-xl uppercase tracking-wider">
                                    {isAdmin ? 'Admin Panel' : 'Dashboard'}
                                </h2>
                                <p className="text-xs text-slate-400 font-mono mt-1">
                                    {truncatedAddress}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-right hidden sm:block">
                                <p className="text-xs text-slate-500 uppercase tracking-wider font-mono">Connected via {walletName || 'Wallet'}</p>
                                <p className="text-sm font-mono text-slate-300 flex items-center justify-end gap-1">
                                    {isAdmin && <ShieldCheck size={14} className="text-purple-400" />}
                                    {truncatedAddress}
                                </p>
                            </div>
                            <button
                                onClick={() => router.push('/')}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-sm border border-slate-700 text-slate-300 hover:text-slate-100 hover:bg-slate-800 transition-colors text-xs font-mono uppercase tracking-wider"
                                title="Go to Home"
                            >
                                <House size={16} weight="duotone" />
                                <span className="hidden lg:inline">Home</span>
                            </button>
                            <div className="h-9 w-9 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-600 to-blue-800 text-white font-bold text-sm shadow-lg">
                                <Wallet size={18} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Page Content */}
                <div className="p-6">
                    {children}
                </div>
            </main>

            {/* Overlay when resizing to prevent capturing mouse */}
            {isResizing && (
                <div className="fixed inset-0 z-[100] cursor-ew-resize" />
            )}
        </div>
    );
}
