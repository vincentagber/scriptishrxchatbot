'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, Loader2, Sparkles, Mic, MicOff, Trash2, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    mockMode?: boolean;
    error?: boolean;
}

interface ChatInterfaceProps {
    token?: string;
    tenantId?: string;
    isDashboard?: boolean;
}

export default function ChatInterface({ tenantId: propTenantId, token, isDashboard = false }: ChatInterfaceProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [isMockMode, setIsMockMode] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isOnline, setIsOnline] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when messages change
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Fetch chat history and status on mount
    useEffect(() => {
        checkChatStatus();
        fetchChatHistory();
    }, []);

    const checkChatStatus = async () => {
        try {
            const headers: HeadersInit = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`${API_URL}/api/chat/status`, { headers });
            const data = await res.json();

            if (data.success) {
                setIsMockMode(data.mockMode === true);
                setIsOnline(data.status === 'online');
            }
        } catch (error) {
            console.error('Error checking chat status:', error);
            setIsOnline(false);
        }
    };

    const fetchChatHistory = async () => {
        try {
            const headers: HeadersInit = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`${API_URL}/api/chat/history`, { headers });

            if (res.ok) {
                const data = await res.json();
                if (data.success && data.messages && Array.isArray(data.messages)) {
                    setMessages(data.messages);
                }
            }
        } catch (error) {
            console.error('Error fetching chat history:', error);
        }
    };

    const handleSend = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        if (!input.trim() || loading) return;

        const userMessage = input.trim();
        setInput('');
        setLoading(true);

        const tempUserMsg: Message = {
            id: `temp_${Date.now()}`,
            role: 'user',
            content: userMessage,
            timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, tempUserMsg]);

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            const tenantId = propTenantId || process.env.NEXT_PUBLIC_LANDING_TENANT_ID;

            const headers: any = { 'Content-Type': 'application/json' };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const res = await fetch(`${apiUrl}/api/chat/message`, { // Updated endpoint to match dashboard
                method: 'POST',
                headers,
                body: JSON.stringify({
                    message: userMessage,
                    tenantId: tenantId || 'default'
                })
            });

            const data = await res.json();

            if (data.success && data.response) {
                const assistantMsg: Message = {
                    id: `assistant_${Date.now()}`,
                    role: 'assistant',
                    content: data.response,
                    timestamp: new Date().toISOString(),
                    mockMode: data.mockMode
                };
                setMessages(prev => [...prev, assistantMsg]);
            } else {
                throw new Error(data.error || 'Failed to get response');
            }
        } catch (error: any) {
            console.error('Error sending message:', error);
            const errorMsg: Message = {
                id: `error_${Date.now()}`,
                role: 'assistant',
                content: 'Hello! I am your AI Business Concierge. I can help with bookings, client management, or analytics. How can I assist you today?',
                timestamp: new Date().toISOString(),
                error: true
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setLoading(false);
        }
    };

    const clearHistory = async () => {
        if (!confirm('Are you sure you want to clear the chat history?')) return;

        try {
            const headers: HeadersInit = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`${API_URL}/api/chat/history`, {
                method: 'DELETE',
                headers
            });

            const data = await res.json();

            if (res.ok && data.success) {
                setMessages([]);
            }
        } catch (error) {
            console.error('Error clearing history:', error);
        }
    };

    const toggleVoiceRecording = () => {
        if (isRecording) {
            setIsRecording(false);
        } else {
            setIsRecording(true);
            setTimeout(() => {
                setIsRecording(false);
                alert('Voice recording feature coming soon!');
            }, 1000);
        }
    };

    return (
        <div className={cn(
            "flex flex-col w-full bg-white md:rounded-3xl shadow-sm border border-slate-100 overflow-hidden font-sans",
            isDashboard ? "h-[calc(100vh-8rem)]" : "h-[500px]"
        )}>
            {/* Header */}
            <div className={cn(
                "p-4 border-b border-slate-100 flex items-center justify-between",
                isDashboard ? "bg-white/50 backdrop-blur-sm px-6 py-4" : "bg-slate-900 border-slate-800"
            )}>
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "rounded-xl flex items-center justify-center shadow-lg",
                        isDashboard ? "w-12 h-12 bg-slate-900 shadow-slate-900/10" : "w-10 h-10 bg-gradient-to-br from-primary-start to-primary-end shadow-primary-start/20"
                    )}>
                        <Sparkles className={cn("w-5 h-5", isDashboard ? "text-white" : "text-white")} />
                    </div>
                    <div>
                        <h3 className={cn("font-bold text-sm", isDashboard ? "text-slate-900 text-lg" : "text-white")}>
                            {isDashboard ? "AI Concierge" : "AI Assistant"}
                        </h3>
                        <div className="flex items-center gap-1.5">
                            <span className={cn("w-2 h-2 rounded-full animate-pulse", isOnline ? "bg-green-500" : "bg-red-400")}></span>
                            <p className={cn("text-xs font-medium", isDashboard ? "text-slate-500" : "text-slate-400")}>
                                {isOnline ? (isDashboard ? 'Active & Ready' : 'Online Now') : 'Connecting...'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {isMockMode && isDashboard && (
                        <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full border border-slate-200 hidden md:inline-block">
                            Dev Mode
                        </span>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={clearHistory}
                        className={cn("rounded-full", isDashboard ? "text-slate-400 hover:text-red-500 hover:bg-red-50" : "text-slate-400 hover:text-white hover:bg-white/10")}
                        title="Clear history"
                    >
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
                {messages.length === 0 ? (
                    <div className={cn("flex flex-col items-center justify-center h-full text-center p-6 opacity-0 animate-in fade-in zoom-in duration-500 fill-mode-forwards", { "opacity-100": true })}>
                        <div className="w-16 h-16 bg-white rounded-3xl shadow-xl flex items-center justify-center mb-4 border border-slate-100">
                            <Bot className="w-8 h-8 text-primary-start" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">
                            How can I help you?
                        </h3>
                        <p className="text-slate-500 text-sm max-w-[250px] mx-auto leading-relaxed mb-6">
                            I can check bookings, answer questions, or help you navigate.
                        </p>

                        <div className={cn("grid gap-2 w-full", isDashboard ? "grid-cols-1 sm:grid-cols-2 max-w-lg" : "grid-cols-1")}>
                            {["Check pricing", "How does it work?", "Book a demo"].map((suggestion) => (
                                <button
                                    key={suggestion}
                                    onClick={() => {
                                        setInput(suggestion);
                                        // Optional: auto-send could go here
                                    }}
                                    className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-600 hover:border-primary-start hover:text-primary-start hover:shadow-md transition-all text-left truncate"
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    messages.map((msg, index) => (
                        <div
                            key={index}
                            className={cn(
                                "flex w-full animate-in fade-in slide-in-from-bottom-2 duration-300",
                                msg.role === 'user' ? "justify-end" : "justify-start"
                            )}
                        >
                            <div className={cn(
                                "flex max-w-[85%] gap-2",
                                msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                            )}>
                                <div className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm mt-1",
                                    msg.role === 'user' ? "bg-slate-200" : "bg-white border border-slate-100 text-primary-start"
                                )}>
                                    {msg.role === 'user' ? <div className="w-full h-full rounded-full bg-slate-200" /> : <Bot className="w-5 h-5" />}
                                </div>

                                <div className={cn(
                                    "p-3 rounded-2xl text-sm leading-relaxed shadow-sm",
                                    msg.role === 'user'
                                        ? "bg-slate-900 text-white rounded-tr-none"
                                        : "bg-white text-slate-700 border border-slate-100 rounded-tl-none",
                                    msg.error && "bg-red-50 text-red-600 border-red-200"
                                )}>
                                    {msg.content}
                                    <div className={cn(
                                        "text-[10px] mt-1 opacity-50",
                                        msg.role === 'user' ? "text-slate-300" : "text-slate-400"
                                    )}>
                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
                {loading && (
                    <div className="flex justify-start animate-in fade-in">
                        <div className="flex gap-2">
                            <div className="w-8 h-8 rounded-full bg-white border border-slate-100 flex items-center justify-center flex-shrink-0 shadow-sm text-primary-start mt-1">
                                <Bot className="w-5 h-5" />
                            </div>
                            <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-slate-100 shadow-sm">
                                <div className="flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className={cn("p-3 bg-white border-t border-slate-100", isDashboard ? "p-4" : "p-3")}>
                <form onSubmit={handleSend} className="flex items-end gap-2 p-1 bg-slate-50 border border-slate-200 rounded-[1.5rem] focus-within:ring-2 focus-within:ring-primary-start/20 focus-within:border-primary-start transition-all shadow-sm">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={toggleVoiceRecording}
                        className={cn(
                            "rounded-full w-9 h-9 flex-shrink-0 hover:bg-slate-200 text-slate-500 transition-colors",
                            isRecording && "bg-red-100 text-red-500 hover:bg-red-200"
                        )}
                        title="Voice Input (Coming Soon)"
                    >
                        {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </Button>

                    <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type a message..."
                        disabled={loading}
                        className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-2 py-2 h-auto max-h-24 min-h-[40px] text-sm text-slate-900 placeholder:text-slate-400"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                    />

                    <Button
                        type="submit"
                        disabled={loading || !input.trim()}
                        className={cn(
                            "rounded-full w-9 h-9 p-0 flex items-center justify-center transition-all flex-shrink-0",
                            input.trim() ? "bg-primary-start hover:bg-primary-end shadow-md scale-100" : "bg-slate-300 scale-90 opacity-70"
                        )}
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Send className="w-4 h-4 text-white ml-0.5" />}
                    </Button>
                </form>
                <div className="text-center mt-2">
                    <p className="text-[10px] text-slate-400">Powered by ScriptishRx AI</p>
                </div>
            </div>
        </div>
    );
}
