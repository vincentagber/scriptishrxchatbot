'use client';

import { useState, useEffect } from 'react';
import { Phone, Mic, Activity, Save, Play, PhoneOutgoing, Settings, MessageSquare, Bot, PhoneIncoming, Globe, Copy } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface AIConfig {
    aiName: string;
    welcomeMessage: string;
    customSystemPrompt: string;
    model?: string;
}

export default function VoicePage() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [inboundPhone, setInboundPhone] = useState('');
    const [webhookUrl, setWebhookUrl] = useState(`${API_URL}/api/webhooks/voice`);
    const [isCalling, setIsCalling] = useState(false);
    const [callStatus, setCallStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [feedbackMessage, setFeedbackMessage] = useState('');

    // AI Configuration State
    const [aiConfig, setAiConfig] = useState<AIConfig>({
        aiName: '',
        welcomeMessage: '',
        customSystemPrompt: '',
        model: 'gpt-4'
    });
    const [isSaving, setIsSaving] = useState(false);
    const [inboundSaving, setInboundSaving] = useState(false);

    // Get token from localStorage
    const getToken = () => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('token');
        }
        return null;
    };

    const getHeaders = () => {
        const headers: HeadersInit = {
            'Content-Type': 'application/json'
        };
        const token = getToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
        return headers;
    };

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        await Promise.all([fetchOrgInfo(), fetchLogs()]);
        setLoading(false);
    };

    const fetchOrgInfo = async () => {
        try {
            const res = await fetch(`${API_URL}/api/organization/info`, {
                headers: getHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.organization) {
                    const org = data.organization;
                    // Merge legacy fields and new JSON config if present
                    setAiConfig({
                        aiName: org.aiConfig?.aiName || org.aiName || 'ScriptishRx Assistant',
                        welcomeMessage: org.aiConfig?.welcomeMessage || org.aiWelcomeMessage || 'Hello, how can I help you today?',
                        customSystemPrompt: org.aiConfig?.systemPrompt || org.customSystemPrompt || 'You are a helpful assistant.',
                        model: org.aiConfig?.model || 'gpt-4'
                    });

                    // Set inbound phone if available (assuming it might be stored in future updates)
                    if (org.twilioConfig?.phoneNumber) {
                        setInboundPhone(org.twilioConfig.phoneNumber);
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching org info:', error);
        }
    };

    const fetchLogs = async () => {
        try {
            const res = await fetch(`${API_URL}/api/voice/logs`, {
                headers: getHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                let logsArray = [];
                if (Array.isArray(data)) logsArray = data;
                else if (data.logs) logsArray = data.logs;

                setLogs(logsArray);
            }
        } catch (error) {
            console.error('Error fetching logs:', error);
        }
    };

    const handleSaveConfig = async () => {
        setIsSaving(true);
        try {
            const res = await fetch(`${API_URL}/api/organization/info`, {
                method: 'PATCH',
                headers: getHeaders(),
                body: JSON.stringify({
                    aiName: aiConfig.aiName,
                    aiWelcomeMessage: aiConfig.welcomeMessage,
                    customSystemPrompt: aiConfig.customSystemPrompt,
                    aiConfig: {
                        aiName: aiConfig.aiName,
                        welcomeMessage: aiConfig.welcomeMessage,
                        systemPrompt: aiConfig.customSystemPrompt,
                        model: aiConfig.model
                    }
                })
            });

            if (res.ok) {
                alert('AI Agent configuration saved successfully!');
            } else {
                alert('Failed to save configuration');
            }
        } catch (error) {
            console.error('Error saving config:', error);
            alert('Error saving configuration');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveInbound = async () => {
        if (!inboundPhone) return;
        setInboundSaving(true);
        try {
            // We update the organization's twilioConfig to store this number association
            const res = await fetch(`${API_URL}/api/organization/info`, {
                method: 'PATCH',
                headers: getHeaders(),
                body: JSON.stringify({
                    twilioConfig: {
                        phoneNumber: inboundPhone
                    }
                })
            });

            if (res.ok) {
                alert('Inbound number updated! Please ensure your Twilio webhook is set pointing to this server.');
            } else {
                alert('Failed to save inbound number');
            }
        } catch (error) {
            console.error('Error saving inbound:', error);
        } finally {
            setInboundSaving(false);
        }
    };

    const handleCall = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanPhone = phoneNumber.trim();
        if (!cleanPhone) return;

        setIsCalling(true);
        setCallStatus('idle');

        try {
            const res = await fetch(`${API_URL}/api/voice/outbound`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ to: cleanPhone }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || data.error || 'Call failed');
            }

            setCallStatus('success');
            setFeedbackMessage('Call initiated! Your AI agent will answer.');
            setPhoneNumber('');
            setTimeout(fetchLogs, 2000);
        } catch (error: any) {
            console.error('Call error:', error);
            setCallStatus('error');
            setFeedbackMessage(error.message);
        } finally {
            setIsCalling(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert('Copied to clipboard!');
    };

    return (
        <div className="space-y-8 max-w-7xl mx-auto pb-12">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Voice Agent Studio</h1>
                    <p className="text-gray-500 mt-2">Design, train, and manage your business's dedicated AI voice concierge.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* Left Column: AI Logic Configuration */}
                <div className="lg:col-span-7 space-y-6">
                    <div className="bg-white rounded-[1.5rem] shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
                            <div className="p-2 bg-blue-600 text-white rounded-lg shadow-sm">
                                <Bot className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">AI Personality & Logic</h2>
                                <p className="text-gray-500 text-xs mt-0.5">Customize how the AI thinks and speaks.</p>
                            </div>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-800">Agent Name</label>
                                    <Input
                                        value={aiConfig.aiName}
                                        onChange={(e) => setAiConfig({ ...aiConfig, aiName: e.target.value })}
                                        placeholder="e.g. Sarah from Front Desk"
                                        className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-800">AI Model</label>
                                    <div className="relative">
                                        <select
                                            value={aiConfig.model}
                                            onChange={(e) => setAiConfig({ ...aiConfig, model: e.target.value })}
                                            className="w-full h-10 px-3 pr-8 rounded-md border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                                        >
                                            <option value="gpt-4">GPT-4 (Recommended)</option>
                                            <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Fastest)</option>
                                        </select>
                                        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-500">
                                            <Settings className="w-4 h-4" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-800">Welcome Message</label>
                                <Input
                                    value={aiConfig.welcomeMessage}
                                    onChange={(e) => setAiConfig({ ...aiConfig, welcomeMessage: e.target.value })}
                                    placeholder="e.g. Thanks for calling ScriptishRx. How can I help?"
                                    className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500"
                                />
                                <p className="text-xs text-gray-500">The first sentence the AI speaks when answering a call.</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-800">System Instructions (Prompt)</label>
                                <textarea
                                    value={aiConfig.customSystemPrompt}
                                    onChange={(e) => setAiConfig({ ...aiConfig, customSystemPrompt: e.target.value })}
                                    placeholder="Describe your business, operating hours, and how the AI should handle different scenarios..."
                                    className="w-full min-h-[240px] p-4 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y leading-relaxed"
                                />
                                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex items-start gap-2">
                                    <Settings className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                    <p className="text-xs text-blue-800">
                                        <strong>Pro Tip:</strong> Be explicit about your business hours, cancellation policies, and services. The AI will use this "brain" to answer questions intelligently.
                                    </p>
                                </div>
                            </div>

                            <Button
                                onClick={handleSaveConfig}
                                disabled={isSaving}
                                className="w-full h-12 bg-gray-900 hover:bg-black text-white rounded-xl font-semibold shadow-lg shadow-gray-200 transition-all hover:-translate-y-0.5"
                            >
                                {isSaving ? <Activity className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                                {isSaving ? 'Saving Changes...' : 'Save AI Configuration'}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Right Column: Inbound, Testing & Status */}
                <div className="lg:col-span-5 space-y-6">

                    {/* Inbound Configuration Card */}
                    <div className="bg-white rounded-[1.5rem] shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
                            <div className="p-2 bg-purple-600 text-white rounded-lg shadow-sm">
                                <PhoneIncoming className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Inbound Configuration</h2>
                                <p className="text-gray-500 text-xs mt-0.5">Set up your business phone line.</p>
                            </div>
                        </div>
                        <div className="p-6 space-y-5">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-800">Your Twilio Phone Number</label>
                                <Input
                                    value={inboundPhone}
                                    onChange={(e) => setInboundPhone(e.target.value)}
                                    placeholder="+1 (555) 123-4567"
                                    className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-800">Webhook URL</label>
                                <div className="flex gap-2">
                                    <Input
                                        readOnly
                                        value={webhookUrl}
                                        className="bg-gray-50 border-gray-300 text-gray-500 text-xs font-mono"
                                    />
                                    <Button variant="outline" onClick={() => copyToClipboard(webhookUrl)} className="px-3">
                                        <Copy className="w-4 h-4" />
                                    </Button>
                                </div>
                                <p className="text-xs text-gray-500">Paste this URL into the "Voice Webhook" field in your Twilio Console.</p>
                            </div>

                            <Button
                                onClick={handleSaveInbound}
                                disabled={inboundSaving || !inboundPhone}
                                className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-xl"
                            >
                                {inboundSaving ? 'Saving...' : 'Link Inbound Number'}
                            </Button>
                        </div>
                    </div>

                    {/* Test Call Card */}
                    <div className="bg-white rounded-[1.5rem] shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
                            <div className="p-2 bg-green-600 text-white rounded-lg shadow-sm">
                                <PhoneOutgoing className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Outbound Call Console</h2>
                                <p className="text-gray-500 text-xs mt-0.5">Reach clients directly through your AI Agent.</p>
                            </div>
                        </div>

                        <div className="p-6 space-y-5">
                            <form onSubmit={handleCall} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-800">Destination Number</label>
                                    <Input
                                        placeholder="+1 (555) 000-0000"
                                        value={phoneNumber}
                                        onChange={(e) => setPhoneNumber(e.target.value)}
                                        className="h-11 text-base bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-green-500 focus:ring-green-500"
                                    />
                                </div>
                                <Button
                                    type="submit"
                                    className="w-full h-11 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold shadow-md shadow-green-100 transition-all active:scale-95"
                                    disabled={isCalling || !phoneNumber}
                                >
                                    {isCalling ? (
                                        <span className="flex items-center gap-2">
                                            <Activity className="w-4 h-4 animate-spin" /> Dialing...
                                        </span>
                                    ) : 'Dial Number'}
                                </Button>

                                {callStatus === 'success' && (
                                    <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm font-medium text-center border border-green-100 animate-in fade-in slide-in-from-top-2">
                                        {feedbackMessage}
                                    </div>
                                )}
                                {callStatus === 'error' && (
                                    <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm text-center border border-red-100 animate-in fade-in slide-in-from-top-2">
                                        {feedbackMessage}
                                    </div>
                                )}
                            </form>
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col items-center justify-center text-center">
                            <div className="text-3xl font-bold text-gray-900 mb-1 tracking-tight">{logs.length}</div>
                            <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Calls Logged</div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col items-center justify-center text-center">
                            <div className="text-3xl font-bold text-green-600 mb-1 tracking-tight">Active</div>
                            <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">System Status</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Call Logs */}
            <div className="bg-white rounded-[1.5rem] shadow-sm border border-gray-200 overflow-hidden mt-8">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/30">
                    <div className="flex items-center gap-3">
                        <Activity className="w-5 h-5 text-gray-400" />
                        <h3 className="font-bold text-gray-900 text-lg">Call History</h3>
                    </div>
                    <Button variant="ghost" onClick={fetchLogs} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                        Refresh Logs
                    </Button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Number</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Summary / Response</th>
                                <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Time</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-8 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                                                <Phone className="w-6 h-6 text-gray-400" />
                                            </div>
                                            <p className="font-medium">No call activity recorded yet.</p>
                                            <p className="text-sm text-gray-400">Initiate a verification call to activate the log history.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log, i) => (
                                    <tr key={i} className="hover:bg-blue-50/30 transition-colors group">
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider border ${log.status === 'completed' ? 'bg-green-50 text-green-700 border-green-100' :
                                                'bg-gray-50 text-gray-600 border-gray-100'
                                                }`}>
                                                {log.status || 'Completed'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                                            {log.phoneNumber || log.to || 'Unknown'}
                                        </td>
                                        <td className="px-6 py-4 text-gray-600 max-w-md truncate">
                                            {log.summary || 'Start of conversation...'}
                                        </td>
                                        <td className="px-6 py-4 text-right text-gray-500 text-sm font-mono">
                                            {new Date(log.timestamp || log.createdAt).toLocaleString(undefined, {
                                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                            })}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}