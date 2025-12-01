'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, MapPin, Info, MessageSquare, Home, HelpCircle, FileText, ChevronRight, User, Phone, Mail } from 'lucide-react';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

interface LeadInfo {
    name: string;
    email: string;
    phone: string;
}

export default function ChatInterface() {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content: "Hello! I'm your ScriptishRx Concierge. How can I help you with your wellness or travel plans today?",
            timestamp: new Date(),
        },
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [activeTab, setActiveTab] = useState<'home' | 'conversation' | 'faqs' | 'articles'>('home');
    const [leadInfo, setLeadInfo] = useState<LeadInfo | null>(null);
    const [leadForm, setLeadForm] = useState<LeadInfo>({ name: '', email: '', phone: '' });
    const [isSubmittingLead, setIsSubmittingLead] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const quickQuestions = [
        "How do I get to the office from O'Hare?",
        "What wellness services do you offer?",
        "Tell me about Chicago sightseeing."
    ];

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        setMounted(true);
        if (activeTab === 'conversation' && leadInfo) {
            scrollToBottom();
        }
    }, [messages, isOpen, activeTab, leadInfo]);

    const handleLeadSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!leadForm.name || !leadForm.email || !leadForm.phone) return;

        setIsSubmittingLead(true);
        try {
            const response = await fetch('/api/leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(leadForm),
            });

            if (response.ok) {
                setLeadInfo(leadForm);
                // Stay on conversation tab, which will now show the chat
            } else {
                console.error('Failed to submit lead');
            }
        } catch (error) {
            console.error('Error submitting lead:', error);
        } finally {
            setIsSubmittingLead(false);
        }
    };

    const handleSend = async (text: string = input) => {
        if (!text.trim()) return;

        // Ensure we switch to conversation view when sending
        setActiveTab('conversation');

        // If lead info is not captured yet, we stop here. 
        // The renderContent will show the form because activeTab is 'conversation' and leadInfo is null.
        if (!leadInfo) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: text,
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        // Backend API call
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: text }),
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();

            const botResponse: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: data.content,
                timestamp: new Date(),
            };

            setMessages((prev) => [...prev, botResponse]);
        } catch (error) {
            console.error('Error sending message:', error);
            const errorResponse: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: "I'm sorry, I'm having trouble connecting to the server right now. Please try again later.",
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorResponse]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (!mounted) return null;

    const renderContent = () => {
        switch (activeTab) {
            case 'home':
                return (
                    <div className="flex flex-col h-full p-6 space-y-6 overflow-y-auto bg-white">
                        <div className="text-center space-y-2 mt-4">
                            <h2 className="text-2xl font-bold text-gray-800">Hi there 👋</h2>
                            <p className="text-gray-500 text-sm">How can we help you today?</p>
                        </div>

                        <div className="space-y-3">
                            <div className="bg-scriptish-purple/5 p-4 rounded-xl border border-scriptish-purple/10">
                                <h3 className="font-semibold text-scriptish-purple text-sm mb-2">Start a conversation</h3>
                                <p className="text-xs text-gray-500 mb-3">The usual reply time is a few minutes.</p>
                                <button
                                    onClick={() => setActiveTab('conversation')}
                                    className="w-full bg-scriptish-purple text-white py-2.5 rounded-lg text-sm font-medium flex items-center justify-center space-x-2 hover:bg-scriptish-purple/90 transition-colors"
                                >
                                    <Send size={16} />
                                    <span>Send us a message</span>
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Suggested</p>
                            {quickQuestions.map((q, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleSend(q)}
                                    className="w-full text-left p-3 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md hover:border-scriptish-teal/30 transition-all flex justify-between items-center group"
                                >
                                    <span className="text-sm text-gray-700">{q}</span>
                                    <ChevronRight size={16} className="text-gray-300 group-hover:text-scriptish-teal" />
                                </button>
                            ))}
                        </div>
                    </div>
                );
            case 'conversation':
                if (!leadInfo) {
                    return (
                        <div className="flex flex-col h-full p-6 bg-white overflow-y-auto">
                            <div className="text-center mb-6">
                                <h3 className="text-xl font-bold text-gray-800">Let's get started</h3>
                                <p className="text-sm text-gray-500 mt-1">Please fill in your details to start chatting.</p>
                            </div>
                            <form onSubmit={handleLeadSubmit} className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-700 ml-1">Name</label>
                                    <div className="relative">
                                        <User size={16} className="absolute left-3 top-3 text-gray-400" />
                                        <input
                                            type="text"
                                            required
                                            placeholder="Your Name"
                                            value={leadForm.name}
                                            onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-scriptish-purple focus:ring-1 focus:ring-scriptish-purple outline-none transition-all"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-700 ml-1">Email</label>
                                    <div className="relative">
                                        <Mail size={16} className="absolute left-3 top-3 text-gray-400" />
                                        <input
                                            type="email"
                                            required
                                            placeholder="name@example.com"
                                            value={leadForm.email}
                                            onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-scriptish-purple focus:ring-1 focus:ring-scriptish-purple outline-none transition-all"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-700 ml-1">Phone</label>
                                    <div className="relative">
                                        <Phone size={16} className="absolute left-3 top-3 text-gray-400" />
                                        <input
                                            type="tel"
                                            required
                                            placeholder="+1 (555) 000-0000"
                                            value={leadForm.phone}
                                            onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-scriptish-purple focus:ring-1 focus:ring-scriptish-purple outline-none transition-all"
                                        />
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    disabled={isSubmittingLead}
                                    className="w-full bg-scriptish-purple text-white py-3 rounded-xl font-medium shadow-md hover:bg-scriptish-purple/90 transition-all flex items-center justify-center space-x-2 mt-4"
                                >
                                    {isSubmittingLead ? <Loader2 size={18} className="animate-spin" /> : <span>Start Chat</span>}
                                </button>
                            </form>
                        </div>
                    );
                }

                return (
                    <div className="flex flex-col h-full">
                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-[85%] p-3 rounded-2xl shadow-sm text-sm leading-relaxed ${msg.role === 'user'
                                            ? 'bg-scriptish-purple text-white rounded-tr-none'
                                            : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
                                            }`}
                                    >
                                        {msg.content}
                                        <div className={`text-[10px] mt-1 text-right ${msg.role === 'user' ? 'text-white/70' : 'text-gray-400'}`}>
                                            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 shadow-sm flex items-center space-x-2">
                                        <div className="w-2 h-2 bg-scriptish-teal rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <div className="w-2 h-2 bg-scriptish-teal rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <div className="w-2 h-2 bg-scriptish-teal rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-4 bg-white border-t border-gray-100">
                            <div className="flex items-center space-x-2 bg-gray-50 p-2 rounded-full border border-gray-200 focus-within:border-scriptish-teal focus-within:ring-1 focus-within:ring-scriptish-teal transition-all shadow-sm">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Type your message..."
                                    className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-gray-700 placeholder-gray-400 px-2 outline-none"
                                    disabled={isLoading}
                                />
                                <button
                                    onClick={() => handleSend()}
                                    disabled={!input.trim() || isLoading}
                                    className={`p-2 rounded-full transition-all duration-200 ${input.trim() && !isLoading
                                        ? 'bg-scriptish-teal text-white shadow-md hover:bg-scriptish-green transform hover:scale-105'
                                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                        }`}
                                >
                                    {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                                </button>
                            </div>
                            <div className="text-center mt-2">
                                <p className="text-[10px] text-gray-400">Powered by ScriptishRx AI</p>
                            </div>
                        </div>
                    </div>
                );
            case 'faqs':
                return (
                    <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
                        <h3 className="font-bold text-lg mb-4 text-gray-800">Frequently Asked Questions</h3>
                        <div className="space-y-3">
                            {[
                                { q: "Wellness Lounge Pricing", a: "Our Wellness Lounge is $49.99 for 2 hours." },
                                { q: "Luggage Storage Pricing", a: "Luggage Storage is $4.99 per hour." },
                                { q: "Hourly Workspace Pricing", a: "Our Hourly Workspace is $24.99 per hour." },
                                { q: "WiFi Amenities", a: "Yes, we offer high-speed WiFi." },
                            ].map((item, i) => (
                                <div key={i} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                                    <h4 className="font-medium text-scriptish-purple text-sm mb-1">{item.q}</h4>
                                    <p className="text-xs text-gray-600">{item.a}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 'articles':
                return (
                    <div className="flex-1 flex items-center justify-center bg-gray-50/50 p-6 text-center">
                        <div>
                            <FileText size={48} className="mx-auto text-gray-300 mb-3" />
                            <h3 className="font-bold text-gray-800">Articles</h3>
                            <p className="text-sm text-gray-500 mt-1">Helpful wellness tips and travel guides coming soon.</p>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="fixed bottom-0 right-0 z-50 flex flex-col items-end p-4">
            {/* Chat Window */}
            {isOpen && (
                <div className="bg-scriptish-white w-[350px] h-[600px] shadow-2xl rounded-2xl overflow-hidden border border-gray-100 flex flex-col mb-20 mr-2 animate-in slide-in-from-bottom-10 fade-in duration-300">
                    {/* Header */}
                    <header className="bg-scriptish-purple text-white p-4 flex items-center justify-between shadow-md shrink-0">
                        <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-scriptish-purple font-bold text-sm shadow-sm">
                                Rx
                            </div>
                            <div>
                                <h1 className="font-semibold text-sm">ScriptishRx Concierge</h1>
                                <p className="text-[10px] text-white/80 opacity-90">Always here for you</p>
                            </div>
                        </div>
                        <div className="flex space-x-1">
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 hover:bg-white/10 rounded-full transition-colors"
                                title="Close"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                    </header>

                    {/* Content Area */}
                    <div className="flex-1 overflow-hidden relative">
                        {renderContent()}
                    </div>

                    {/* Bottom Nav inside Chat Window */}
                    <div className="bg-white border-t border-gray-100 p-2 flex justify-around items-center shrink-0">
                        <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center p-2 rounded-lg transition-colors ${activeTab === 'home' ? 'text-scriptish-teal bg-scriptish-teal/5' : 'text-gray-400 hover:text-gray-600'}`}>
                            <Home size={20} />
                            <span className="text-[10px] font-medium mt-1">Home</span>
                        </button>
                        <button onClick={() => setActiveTab('conversation')} className={`flex flex-col items-center p-2 rounded-lg transition-colors ${activeTab === 'conversation' ? 'text-scriptish-teal bg-scriptish-teal/5' : 'text-gray-400 hover:text-gray-600'}`}>
                            <MessageSquare size={20} />
                            <span className="text-[10px] font-medium mt-1">Chat</span>
                        </button>
                        <button onClick={() => setActiveTab('faqs')} className={`flex flex-col items-center p-2 rounded-lg transition-colors ${activeTab === 'faqs' ? 'text-scriptish-teal bg-scriptish-teal/5' : 'text-gray-400 hover:text-gray-600'}`}>
                            <HelpCircle size={20} />
                            <span className="text-[10px] font-medium mt-1">FAQs</span>
                        </button>
                        <button onClick={() => setActiveTab('articles')} className={`flex flex-col items-center p-2 rounded-lg transition-colors ${activeTab === 'articles' ? 'text-scriptish-teal bg-scriptish-teal/5' : 'text-gray-400 hover:text-gray-600'}`}>
                            <FileText size={20} />
                            <span className="text-[10px] font-medium mt-1">Articles</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Launcher Button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="bg-white text-gray-800 px-6 py-4 rounded-2xl shadow-lg hover:shadow-xl border border-gray-100 transition-all duration-300 flex items-center justify-between w-[300px] group mb-16 mr-2"
                >
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-scriptish-teal/10 rounded-full flex items-center justify-center text-scriptish-teal">
                            <MessageSquare size={20} />
                        </div>
                        <span className="font-medium text-sm">Chat with us now</span>
                    </div>
                    <div className="text-gray-400 group-hover:translate-x-1 transition-transform">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </div>
                </button>
            )}
        </div>
    );
}
