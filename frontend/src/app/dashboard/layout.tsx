'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard, Users, Calendar, Settings, Phone, MessageSquare, Search,
    Bell, Menu, FileText, LogOut, User, Zap, PieChart, X, ChevronRight
} from 'lucide-react';

interface UserPayload {
    name: string;
    email: string;
    avatarUrl?: string;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    const [user, setUser] = useState<UserPayload | null>(null);
    const [openProfile, setOpenProfile] = useState(false);
    const [showMobileMenu, setShowMobileMenu] = useState(false);

    const dropdownRef = useRef<HTMLDivElement>(null);
    const sidebarRef = useRef<HTMLElement>(null);

    // Fetch user
    useEffect(() => {
        (async () => {
            try {
                const token = localStorage.getItem('token');
                const storedName = localStorage.getItem('userName'); // Attempt to get from cache first

                if (storedName) {
                    setUser({ name: storedName, email: '', avatarUrl: '' });
                }

                if (!token) {
                    setUser({ name: 'Guest User', email: '', avatarUrl: '' });
                    return;
                }

                // Use configured API client
                const { data } = await import('@/lib/api').then(m => m.default.get('/settings'));

                if (data.success && data.user) {
                    setUser(data.user);
                    // Cache it for next time
                    if (data.user.name) localStorage.setItem('userName', data.user.name);
                }
            } catch (err) {
                console.error('User fetch failed:', err);
                setUser(prev => prev || { name: 'Admin', email: 'admin@scriptishrx.com', avatarUrl: '' });
            }
        })();
    }, []);

    // Auto-close mobile nav when route changes
    useEffect(() => setShowMobileMenu(false), [pathname]);

    // Click outside for dropdown + mobile sidebar
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
                setOpenProfile(false);

            if (showMobileMenu && sidebarRef.current && !sidebarRef.current.contains(e.target as Node))
                setShowMobileMenu(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showMobileMenu]);

    // Search State
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);

    // Debounced Search
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchTerm.length < 2) {
                setSearchResults([]);
                setShowResults(false);
                return;
            }

            setIsSearching(true);
            try {
                const token = localStorage.getItem('token');
                if (!token) return;

                const res = await fetch(`/api/clients?search=${encodeURIComponent(searchTerm)}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (res.ok) {
                    const data = await res.json();
                    setSearchResults(data);
                    setShowResults(true);
                }
            } catch (error) {
                console.error('Search error:', error);
            } finally {
                setIsSearching(false);
            }
        }, 300); // 300ms debounce

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm]);

    // Real-time Notifications
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;

        // 1. Fetch initial count
        if (token) {
            import('@/lib/api').then(m => {
                m.default.get('/notifications')
                    .then(({ data }) => {
                        if (Array.isArray(data)) {
                            setUnreadCount(data.filter((n: any) => !n.isRead).length);
                        }
                    })
                    .catch(console.error);
            });
        }

        // 2. Connect Socket
        // Dynamic import to avoid SSR issues if any, though 'use client' handles it usually
        import('socket.io-client').then(({ io }) => {
            const socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000', {
                auth: { token }
            });

            socket.on('notification:new', (newNotification) => {
                console.log('New notification received:', newNotification);
                setUnreadCount(prev => prev + 1);
                // Can add Toast here
            });

            return () => socket.disconnect();
        });
    }, []);


    const logout = () => {
        localStorage.removeItem('token');
        window.location.href = '/login';
    };

    return (
        <div className="flex h-screen bg-[#F3F4F6] overflow-hidden text-gray-900 font-sans">

            {/* Mobile Dim Overlay */}
            {showMobileMenu && (
                <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"></div>
            )}

            {/* === SIDEBAR === */}
            <aside
                ref={sidebarRef}
                className={`fixed lg:static top-0 left-0 h-full lg:h-auto w-64 bg-blue-600 z-50
                transition-transform duration-300 flex flex-col shadow-xl
                ${showMobileMenu ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
            >
                {/* Brand */}
                <div className="h-20 flex items-center px-6">
                    <div className="flex items-center gap-3 text-white">
                        <img src="/logo.jpg" alt="ScriptishRx" className="h-14 w-auto rounded-lg" />
                    </div>

                    <button
                        onClick={() => setShowMobileMenu(false)}
                        className="lg:hidden ml-auto text-white"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-4 py-4 space-y-8 overflow-y-auto scrollbar-hide">

                    <Section title="MENU">
                        <NavItem href="/dashboard" label="Dashboard" icon={<LayoutDashboard />} active={pathname === '/dashboard'} />
                        <NavItem href="/dashboard/clients" label="Customers" icon={<Users />} active={pathname === '/dashboard/clients'} />
                        <NavItem href="/dashboard/bookings" label="Bookings" icon={<Calendar />} active={pathname === '/dashboard/bookings'} />
                        <NavItem href="/dashboard/minutes" label="Meeting Minutes" icon={<FileText />} active={pathname === '/dashboard/minutes'} />
                        <NavItem href="/dashboard/insights" label="Analytics" icon={<PieChart />} active={pathname === '/dashboard/insights'} />
                    </Section>

                    <Section title="AI CONCIERGE">
                        <NavItem href="/dashboard/voice" label="Voice Agent" icon={<Phone />} active={pathname === '/dashboard/voice'} />
                        <NavItem href="/dashboard/chat" label="Chatbot" icon={<MessageSquare />} active={pathname === '/dashboard/chat'} />
                        <NavItem href="/dashboard/workflows" label="Workflows" icon={<Zap />} active={pathname === '/dashboard/workflows'} />
                    </Section>

                    <Section title="GENERAL">
                        <NavItem href="/dashboard/settings" label="My Profile" icon={<User />} active={pathname === '/dashboard/settings'} />
                        <NavItem href="/dashboard/settings/subscription" label="Subscription" icon={<Zap />} active={pathname.includes('subscription')} badge="Pro" />
                    </Section>

                    {/* Visible Logout */}
                    <div className="mt-8 pt-4 border-t border-blue-500/30">
                        <button
                            onClick={logout}
                            className="flex items-center gap-3 px-4 py-3 w-full text-blue-100 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-200"
                        >
                            <LogOut className="w-5 h-5" />
                            <span className="font-medium text-sm">Logout</span>
                        </button>
                    </div>
                </nav>
            </aside>

            {/* === MAIN === */}
            <main className="flex-1 flex flex-col overflow-hidden bg-gray-50">

                {/* HEADER */}
                <header className="h-20 px-8 flex items-center justify-between bg-white border-b border-gray-100 sticky top-0 z-30 shadow-sm relative">

                    {/* Left: Mobile Menu + Search */}
                    <div className="flex-1 flex items-center gap-6">
                        <button
                            onClick={() => setShowMobileMenu(true)}
                            className="lg:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                            <Menu className="h-6 w-6" />
                        </button>

                        {/* Search Bar (Centered layout style) */}
                        <div className="relative z-50">
                            <div className="hidden md:flex items-center bg-gray-100 rounded-full px-5 py-2.5 w-96 max-w-lg transition-all focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:bg-white border border-transparent focus-within:border-blue-100">
                                <Search className={`h-4 w-4 ${isSearching ? 'text-blue-500 animate-pulse' : 'text-gray-400'}`} />
                                <input
                                    className="ml-3 bg-transparent outline-none w-full text-sm placeholder-gray-400 text-gray-700"
                                    placeholder="Search clients..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onFocus={() => { if (searchResults.length > 0) setShowResults(true); }}
                                    onBlur={() => setTimeout(() => setShowResults(false), 200)}
                                />
                            </div>

                            {/* Live Results Dropdown */}
                            {showResults && (
                                <div className="absolute top-full left-0 mt-2 w-96 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 overflow-hidden animate-in fade-in slide-in-from-top-2">
                                    <div className="px-4 py-2 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
                                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Clients Found ({searchResults.length})</span>
                                        {isSearching && <span className="text-xs text-blue-500">Updating...</span>}
                                    </div>
                                    <div className="max-h-64 overflow-y-auto">
                                        {searchResults.length > 0 ? (
                                            searchResults.map(client => (
                                                <Link
                                                    key={client.id}
                                                    href="/dashboard/clients"
                                                    className="block px-4 py-3 hover:bg-blue-50 transition-colors group"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <p className="text-sm font-bold text-gray-900 group-hover:text-blue-700">{client.name}</p>
                                                            <p className="text-xs text-gray-500">{client.email}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="text-xs font-mono text-gray-400 group-hover:text-blue-500">{client.phone}</span>
                                                        </div>
                                                    </div>
                                                </Link>
                                            ))
                                        ) : (
                                            <div className="p-4 text-center text-sm text-gray-400">No clients found.</div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Actions + Profile */}
                    <div className="flex items-center gap-6">

                        <div className="flex items-center gap-2">
                            <button className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
                                <Bell className="w-5 h-5" />
                                {unreadCount > 0 && (
                                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
                                )}
                            </button>
                        </div>

                        {/* Profile Section (Visible Info) */}
                        <div className="flex items-center gap-3 pl-6 border-l border-gray-100">
                            <div className="text-right hidden md:block">
                                <p className="text-sm font-bold text-gray-900">{user?.name || 'Loading...'}</p>
                                <p className="text-xs text-blue-600 font-medium cursor-pointer hover:underline">View Profile</p>
                            </div>
                            <Avatar url={user?.avatarUrl} name={user?.name} size="lg" />
                        </div>

                    </div>
                </header>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8">
                    {children}
                </div>
            </main>
        </div>
    );
}

/* ----------------- COMPONENTS ----------------- */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="mb-2">
            <p className="px-4 text-[10px] font-bold text-blue-200/60 uppercase tracking-widest mb-2">{title}</p>
            <div className="space-y-1">{children}</div>
        </div>
    );
}

function NavItem({
    href,
    label,
    icon,
    active,
    badge
}: {
    href: string;
    label: string;
    icon: React.ReactNode;
    active: boolean;
    badge?: string;
}) {
    return (
        <Link
            href={href}
            className={`flex items-center justify-between px-4 py-3 mx-2 rounded-xl transition-all duration-200 group relative
            ${active
                    ? 'bg-white text-blue-600 shadow-lg' // Active: White pill, blue text
                    : 'text-blue-100 hover:bg-white/10 hover:text-white' // Inactive: Light blue text
                }`}
        >
            <div className="flex items-center gap-3">
                <span className={`${active ? 'text-blue-800' : 'text-blue-200 group-hover:text-white'} transition-colors`}>
                    {icon}
                </span>
                <span className="font-medium text-sm">{label}</span>
            </div>

            {badge && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm ${active ? 'bg-blue-100 text-blue-600' : 'bg-blue-500 text-white'}`}>
                    {badge}
                </span>
            )}
        </Link>
    );
}

function Avatar({ url, name, size = 'md' }: { url?: string; name?: string; size?: 'md' | 'lg' }) {
    const dims = size === 'lg' ? 'w-10 h-10' : 'w-9 h-9';
    return (
        <div className={`${dims} rounded-full overflow-hidden ring-4 ring-gray-50 flex items-center justify-center font-bold bg-white text-blue-600 shadow-sm border border-gray-100`}>
            {url ? (
                <img
                    src={url.startsWith('http') ? url : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}${url}`}
                    className="w-full h-full object-cover"
                    alt={name || 'User'}
                />
            ) : (
                <span>{name?.charAt(0).toUpperCase()}</span>
            )}
        </div>
    );
}

function IconBtn({ children }: { children: React.ReactNode }) {
    return (
        <button className="p-2.5 bg-white border border-zinc-100 rounded-full hover:bg-zinc-50 shadow-sm text-zinc-500 transition">
            {children}
        </button>
    );
}
