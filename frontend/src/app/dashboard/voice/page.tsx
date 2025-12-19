'use client';

import { useState, useEffect } from 'react';
import { Phone, Mic, Activity, Save, Play, PhoneOutgoing, Settings, MessageSquare, Bot } from 'lucide-react';
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
            // Update Organization with new AI Config
            const res = await fetch(`${API_URL}/api/organization/info`, {
                method: 'PATCH',
                headers: getHeaders(),
                body: JSON.stringify({
                    // Update legacy fields for compatibility
                    aiName: aiConfig.aiName,
                    aiWelcomeMessage: aiConfig.welcomeMessage,
                    customSystemPrompt: aiConfig.customSystemPrompt,
                    // Update new JSON config for advanced features
                    aiConfig: {
                        aiName: aiConfig.aiName,
                        welcomeMessage: aiConfig.welcomeMessage,
                        systemPrompt: aiConfig.customSystemPrompt,
                        model: aiConfig.model
                    }
                })
            });

            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    alert('AI Agent configuration saved successfully!');
                }
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

            // Refresh logs
            setTimeout(fetchLogs, 2000);
        } catch (error: any) {
            console.error('Call error:', error);
            setCallStatus('error');
            setFeedbackMessage(error.message);
        } finally {
            setIsCalling(false);
        }
    };

    return (
        <div className="space-y-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Voice Agent Studio</h1>
                    <p className="text-gray-500 mt-2">Customize your business's unique AI voice personality and behavior.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* Left Column: AI Configuration */}
                <div className="lg:col-span-7 space-y-6">
                    <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-8 border-b border-gray-100 bg-slate-50/50">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                                    <Bot className="w-6 h-6" />
                                </div>
                                <h2 className="text-xl font-bold text-gray-900">AI Personality & Logic</h2>
                            </div>
                            <p className="text-gray-500 text-sm">Define how your AI represents your business.</p>
                        </div>

                        <div className="p-8 space-y-6">
                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700">Agent Name</label>
                                    <Input
                                        value={aiConfig.aiName}
                                        onChange={(e) => setAiConfig({ ...aiConfig, aiName: e.target.value })}
                                        placeholder="e.g. Sarah from Front Desk"
                                        className="bg-gray-50 border-gray-200"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700">AI Model</label>
                                    <select
                                        value={aiConfig.model}
                                        onChange={(e) => setAiConfig({ ...aiConfig, model: e.target.value })}
                                        className="w-full h-10 px-3 rounded-md border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="gpt-4">GPT-4 (Recommended)</option>
                                        <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Fastest)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">Welcome Message</label>
                                <Input
                                    value={aiConfig.welcomeMessage}
                                    onChange={(e) => setAiConfig({ ...aiConfig, welcomeMessage: e.target.value })}
                                    placeholder="e.g. Thanks for calling Dr. Smith's office. How can I help?"
                                    className="bg-gray-50 border-gray-200"
                                />
                                <p className="text-xs text-gray-400">The first thing the AI says when answering the phone.</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">System Instructions (Prompt)</label>
                                <textarea
                                    value={aiConfig.customSystemPrompt}
                                    onChange={(e) => setAiConfig({ ...aiConfig, customSystemPrompt: e.target.value })}
                                    placeholder="You are a helpful receptionist. Your goal is to schedule appointments..."
                                    className="w-full min-h-[200px] p-4 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                                />
                                <p className="text-xs text-gray-400">
                                    Be specific! Describe your business hours, services, tone of voice, and how to handle objections.
                                </p>
                            </div>

                            <Button
                                onClick={handleSaveConfig}
                                disabled={isSaving}
                                className="w-full h-12 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-medium shadow-lg shadow-gray-200 transition-all active:scale-95"
                            >
                                {isSaving ? 'Saving Changes...' : 'Save AI Configuration'}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Right Column: Testing & Status */}
                <div className="lg:col-span-5 space-y-6">

                    {/* Test Call Card */}
                    <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-green-100 text-green-600 rounded-xl">
                                <PhoneOutgoing className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900">Test Your Agent</h3>
                                <p className="text-sm text-gray-500">Call yourself to hear the changes.</p>
                            </div>
                        </div>

                        <form onSubmit={handleCall} className="space-y-4">
                            <Input
                                placeholder="+1 (555) 000-0000"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                className="h-12 text-lg bg-gray-50 border-gray-200"
                            />
                            <Button
                                type="submit"
                                className="w-full h-12 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold shadow-lg shadow-green-100"
                                disabled={isCalling || !phoneNumber}
                            >
                                {isCalling ? 'Initiating Call...' : 'Call Me Now'}
                            </Button>

                            {callStatus === 'success' && (
                                <p className="text-sm text-green-600 text-center bg-green-50 py-2 rounded-lg font-medium">
                                    {feedbackMessage}
                                </p>
                            )}
                            {callStatus === 'error' && (
                                <p className="text-sm text-red-600 text-center bg-red-50 py-2 rounded-lg">
                                    {feedbackMessage}
                                </p>
                            )}
                        </form>
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
                            <div className="text-3xl font-bold text-gray-900 mb-1">{logs.length}</div>
                            <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Total Calls</div>
                        </div>
                        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
                            <div className="text-3xl font-bold text-green-600 mb-1">Active</div>
                            <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">System Status</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Call Logs (Full Width) */}
            <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-8 border-b border-gray-100 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <Activity className="w-5 h-5 text-gray-400" />
                        <h3 className="font-bold text-gray-900 text-lg">Call History</h3>
                    </div>
                    <Button variant="ghost" onClick={fetchLogs} className="text-blue-600 hover:text-blue-700">
                        Refresh Logs
                    </Button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50/50">
                            <tr>
                                <th className="px-8 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                                <th className="px-8 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Number</th>
                                <th className="px-8 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Summary / Response</th>
                                <th className="px-8 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">Time</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-8 py-12 text-center text-gray-500">
                                        No calls recorded yet. Try the test dialer above!
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log, i) => (
                                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-8 py-4">
                                            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${log.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                    'bg-gray-100 text-gray-600'
                                                }`}>
                                                {log.status || 'Completed'}
                                            </span>
                                        </td>
                                        <td className="px-8 py-4 font-medium text-gray-900">
                                            {log.phoneNumber || log.to || 'Unknown'}
                                        </td>
                                        <td className="px-8 py-4 text-gray-600 max-w-md truncate">
                                            {log.summary || 'Start of conversation...'}
                                        </td>
                                        <td className="px-8 py-4 text-right text-gray-500 text-sm">
                                            {new Date(log.timestamp || log.createdAt).toLocaleString()}
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