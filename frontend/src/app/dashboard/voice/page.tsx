'use client';

import { useState, useEffect } from 'react';
import { Phone, Mic, Activity, Clock, Play, PhoneOutgoing, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function VoicePage() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [isCalling, setIsCalling] = useState(false);
    const [callStatus, setCallStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [feedbackMessage, setFeedbackMessage] = useState('');
    const [agentConfigured, setAgentConfigured] = useState(true);
    const [isMockMode, setIsMockMode] = useState(false);

    // Get token from localStorage
    const getToken = () => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('token');
        }
        return null;
    };

    // Create headers with authentication
    const getHeaders = () => {
        const headers: HeadersInit = {
            'Content-Type': 'application/json'
        };

        const token = getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        return headers;
    };

    useEffect(() => {
        fetchLogs();
        checkMockMode();
    }, []);

    const checkMockMode = async () => {
        try {
            const res = await fetch(`${API_URL}/api/voicecake/tenant/agent`, {
                headers: getHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                setIsMockMode(data.mockMode === true);
            }
        } catch (error) {
            console.error('Error checking mock mode:', error);
        }
    };

    const fetchLogs = async () => {
        try {
            const res = await fetch(`${API_URL}/api/voice/logs`, {
                headers: getHeaders()
            });
            if (res.ok) {
                const contentType = res.headers.get("content-type");
                if (contentType && contentType.indexOf("application/json") !== -1) {
                    const data = await res.json();

                    // Handle different response structures
                    let logsArray = [];
                    if (Array.isArray(data)) {
                        logsArray = data;
                    } else if (data.logs && Array.isArray(data.logs)) {
                        logsArray = data.logs;
                    } else if (data.success && data.logs) {
                        logsArray = data.logs;
                    }

                    setLogs(logsArray);
                    console.log('Fetched logs:', logsArray.length, 'entries');
                }
            }
        } catch (error) {
            console.error('Error fetching voice logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCall = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate phone number before making request
        const cleanPhone = phoneNumber.trim();
        if (!cleanPhone) {
            setCallStatus('error');
            setFeedbackMessage('Please enter a phone number');
            setTimeout(() => setCallStatus('idle'), 3000);
            return;
        }

        // Basic phone validation (must start with + and contain digits)
        const phoneRegex = /^\+?[1-9]\d{1,14}$/;
        if (!phoneRegex.test(cleanPhone.replace(/[\s()-]/g, ''))) {
            setCallStatus('error');
            setFeedbackMessage('Invalid phone format. Use: +1234567890');
            setTimeout(() => setCallStatus('idle'), 3000);
            return;
        }

        setIsCalling(true);
        setCallStatus('idle');
        setFeedbackMessage('');

        try {
            const res = await fetch(`${API_URL}/api/voice/outbound`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    to: cleanPhone,
                    context: { source: 'dashboard_test' }
                }),
            });

            let data;
            const contentType = res.headers.get('content-type');

            try {
                // Only parse as JSON if response is actually JSON
                if (contentType && contentType.includes('application/json')) {
                    data = await res.json();
                } else {
                    const text = await res.text();
                    console.error('Non-JSON response:', text);
                    throw new Error('Server returned non-JSON response. Check backend logs.');
                }
            } catch (jsonError) {
                console.error('Failed to parse response:', jsonError);
                throw new Error('Invalid server response. Is the backend running?');
            }

            // Log the actual response structure for debugging
            console.log('API Response:', {
                ok: res.ok,
                status: res.status,
                statusText: res.statusText,
                data: data
            });

            if (!res.ok) {
                // Handle authentication errors
                if (res.status === 401) {
                    throw new Error('Authentication required. Please login to make calls.');
                }
                if (res.status === 403) {
                    throw new Error('Access denied. Please check your permissions.');
                }
                if (res.status === 404) {
                    throw new Error('API endpoint not found. Check backend routes.');
                }

                // Extract error message from various possible response structures
                let errorMsg = 'Request failed';

                if (typeof data === 'string') {
                    errorMsg = data;
                } else if (data && typeof data === 'object') {
                    // Check multiple possible error fields
                    errorMsg = data.error ||
                        data.message ||
                        data.details ||
                        data.errorMessage ||
                        JSON.stringify(data);
                }

                // Check for specific error messages
                if (errorMsg.includes('No voice agent configured') ||
                    errorMsg.includes('agent')) {
                    setAgentConfigured(false);
                }

                // Add status code to message if not already included
                if (!errorMsg.includes(res.status.toString())) {
                    errorMsg = `${errorMsg} (Status: ${res.status})`;
                }

                console.error('API Error Details:', {
                    status: res.status,
                    statusText: res.statusText,
                    responseData: data,
                    extractedError: errorMsg
                });

                throw new Error(errorMsg);
            }

            // Success
            setCallStatus('success');
            setFeedbackMessage(data.message || 'Call initiated successfully!');
            setAgentConfigured(true);
            setPhoneNumber('');

            // Refresh logs after successful call
            setTimeout(() => {
                fetchLogs();
            }, 2000);

            setTimeout(() => {
                setCallStatus('idle');
                setFeedbackMessage('');
            }, 5000);
        } catch (error: any) {
            console.error('Call initiation error:', error);
            setCallStatus('error');

            // Provide more specific error messages
            let userMessage = error.message;
            if (error.message.includes('fetch')) {
                userMessage = 'Cannot connect to server. Is the backend running?';
            }

            setFeedbackMessage(userMessage || 'Failed to initiate call. Check console.');

            setTimeout(() => {
                setCallStatus('idle');
            }, 5000);
        } finally {
            setIsCalling(false);
        }
    };


    const [inboundPhone, setInboundPhone] = useState('');
    const [inboundLoading, setInboundLoading] = useState(false);

    const handleInboundConfig = async () => {
        if (!inboundPhone) return;
        setInboundLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/voicecake/inbound-config`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ phoneNumber: inboundPhone })
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message);
                setInboundPhone('');
            } else {
                alert('Failed: ' + data.error);
            }
        } catch (e) {
            console.error(e);
            alert('Error configuring inbound number');
        } finally {
            setInboundLoading(false);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Voice Agent</h1>
                    <p className="text-gray-500">Monitor active calls and review call history.</p>
                </div>
            </div>

            {/* Mock Mode Banner */}
            {isMockMode && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 flex items-start gap-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <CheckCircle className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold text-blue-900 mb-2">Mock Mode Active</h3>
                        <p className="text-sm text-blue-800">
                            Running in development mode with simulated calls. Authentication not required for testing.
                        </p>
                    </div>
                </div>
            )}

            {/* Agent Configuration Warning */}
            {!agentConfigured && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-4">
                    <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <AlertCircle className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold text-amber-900 mb-2">Voice Agent Setup Required</h3>
                        <p className="text-sm text-amber-800 mb-4">
                            Your VoiceCake account doesn't have a voice agent configured yet. You need to set this up before making calls.
                        </p>
                        <div className="space-y-2 text-sm text-amber-900">
                            <p className="font-medium">To configure your voice agent:</p>
                            <ol className="list-decimal list-inside space-y-1 ml-2">
                                <li>Log in to your <a href="https://voicecake.io" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-700">VoiceCake dashboard</a></li>
                                <li>Navigate to "Agents" or "Voice Configuration"</li>
                                <li>Create a new voice agent with your desired settings</li>
                                <li>Configure the agent's personality, voice, and prompts</li>
                                <li>Return here to test your agent</li>
                            </ol>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Status Card */}
                <div className="lg:col-span-2 bg-black text-white p-8 rounded-3xl shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full blur-3xl opacity-20 -mr-16 -mt-16"></div>
                    <div className="relative z-10 flex items-center justify-between">
                        <div>
                            <div className="flex items-center space-x-2 mb-2">
                                <span className={`w-2 h-2 rounded-full ${agentConfigured ? 'bg-green-400 animate-pulse' : 'bg-amber-400'}`}></span>
                                <span className="text-sm font-medium text-gray-300">
                                    {agentConfigured ? 'System Online' : 'Setup Required'}
                                </span>
                            </div>
                            <h2 className="text-3xl font-bold mb-2">AI Voice Concierge</h2>
                            <p className="text-gray-400 max-w-md">
                                Handling inbound calls for booking, inquiries, and support using VoiceCake API.
                            </p>
                        </div>
                        <div className="hidden md:flex items-center justify-center w-16 h-16 bg-white/10 rounded-2xl backdrop-blur-sm">
                            <Mic className="w-8 h-8 text-white" />
                        </div>
                    </div>
                    <div className="mt-8 flex gap-4">
                        <div className="bg-white/10 px-4 py-3 rounded-xl backdrop-blur-sm">
                            <p className="text-xs text-gray-400 uppercase tracking-wider">Total Calls</p>
                            <p className="text-2xl font-bold mt-1">{logs.length}</p>
                        </div>
                        <div className="bg-white/10 px-4 py-3 rounded-xl backdrop-blur-sm">
                            <p className="text-xs text-gray-400 uppercase tracking-wider">Status</p>
                            <p className="text-2xl font-bold mt-1">{agentConfigured ? 'Ready' : 'Setup'}</p>
                        </div>
                    </div>
                </div>

                {/* Test Call Card */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-center">
                    <div className="mb-4">
                        <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mb-3">
                            <PhoneOutgoing className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-gray-900 text-lg">Test Voice System</h3>
                        <p className="text-sm text-gray-500">
                            {isMockMode
                                ? 'Simulate a test call (no auth required in mock mode)'
                                : 'Initiate a test call to verify the agent'
                            }
                        </p>
                    </div>

                    <form onSubmit={handleCall} className="space-y-4">
                        <div>
                            <Input
                                placeholder="+1 (555) 000-0000"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus-visible:ring-blue-500"
                            />
                            <p className="text-xs text-gray-500 mt-1">Include country code (e.g., +1 for US)</p>
                        </div>
                        <Button
                            type="submit"
                            className="w-full"
                            disabled={isCalling || !phoneNumber}
                        >
                            {isCalling ? 'Calling...' : 'Call Now'}
                        </Button>

                        {callStatus === 'success' && (
                            <p className="text-sm text-green-600 text-center bg-green-50 py-2 rounded-lg px-2">
                                {feedbackMessage}
                            </p>
                        )}
                        {callStatus === 'error' && (
                            <div className="text-sm text-red-600 bg-red-50 py-3 px-3 rounded-lg">
                                <p className="font-medium mb-1">Call Failed</p>
                                <p className="text-xs">{feedbackMessage}</p>
                            </div>
                        )}
                    </form>
                </div>
                {/* Inbound Configuration Card */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col">
                    <div className="mb-4">
                        <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center text-green-600 mb-3">
                            <Phone className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-gray-900 text-lg">Inbound Configuration</h3>
                        <p className="text-sm text-gray-500">
                            Configure a number for your agent to answer incoming calls.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <Input
                                placeholder="+1 (555) 000-0000"
                                value={inboundPhone}
                                onChange={(e) => setInboundPhone(e.target.value)}
                                className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus-visible:ring-green-500"
                            />
                            <p className="text-xs text-gray-500 mt-1">Number to assign to this agent</p>
                        </div>
                        <Button
                            className="w-full bg-green-600 hover:bg-green-700"
                            onClick={handleInboundConfig}
                            disabled={inboundLoading || !inboundPhone}
                        >
                            {inboundLoading ? 'Saving...' : 'Save & Configure Inbound'}
                        </Button>
                        <p className="text-xs text-center text-gray-400">
                            Webhook: {API_URL}/api/webhooks/voice
                        </p>
                    </div>
                </div>
            </div>

            {/* Call Logs */}
            <div className="bg-white rounded-3xl shadow-sm overflow-hidden border border-gray-100">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="font-bold text-gray-900">Recent Calls</h3>
                    <button
                        onClick={async () => {
                            setLoading(true);
                            await fetchLogs();
                        }}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                        Refresh
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Caller</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Summary</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Recording</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">Loading logs...</td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center">
                                        <div className="flex flex-col items-center justify-center text-gray-500">
                                            <Phone className="w-12 h-12 mb-3 text-gray-300" />
                                            <p className="font-medium">No call logs yet</p>
                                            <p className="text-sm mt-1">Test calls will appear here</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id || log.callId} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center">
                                                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                                                    <Phone className="w-4 h-4" />
                                                </div>
                                                <div className="ml-3">
                                                    <p className="text-sm font-medium text-gray-900">
                                                        {log.lead?.name || log.name || 'Test Call'}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        {log.phoneNumber || log.lead?.phone || 'No Number'}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${log.status === 'completed' ? 'bg-green-50 text-green-700' :
                                                log.status === 'initiated' ? 'bg-blue-50 text-blue-700' :
                                                    log.status === 'failed' ? 'bg-red-50 text-red-700' :
                                                        'bg-gray-50 text-gray-700'
                                                }`}>
                                                {log.status || 'Completed'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm text-gray-600 max-w-xs truncate">
                                                {log.summary || log.transcript ||
                                                    (log.mockMode ? 'Mock call - simulated in development' : 'No summary available')}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {log.timestamp
                                                ? new Date(log.timestamp).toLocaleString()
                                                : log.createdAt
                                                    ? new Date(log.createdAt).toLocaleString()
                                                    : 'Just now'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {log.recordingUrl ? (
                                                <a
                                                    href={log.recordingUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-900 inline-flex"
                                                >
                                                    <Play className="w-4 h-4" />
                                                </a>
                                            ) : (
                                                <span className="text-xs text-gray-400">
                                                    {log.mockMode ? 'Mock' : 'No recording'}
                                                </span>
                                            )}
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