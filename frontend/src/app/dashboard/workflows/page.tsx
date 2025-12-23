'use client';
import { useState, useEffect } from 'react';
import { Zap, Activity, Trash2, Plus, Clock, MessageSquare, ArrowRight, Layout } from 'lucide-react';

export default function WorkflowsPage() {
    const [workflows, setWorkflows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch workflows
        const fetchWorkflows = async () => {
            try {
                const res = await fetch('http://localhost:5000/api/workflows', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                const data = await res.json();
                if (res.ok) {
                    setWorkflows(data.workflows || []);
                }
            } catch (error) {
                console.error("Failed to fetch workflows", error);
            } finally {
                setLoading(false);
            }
        };
        fetchWorkflows();
    }, []);

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this workflow?')) return;
        try {
            const res = await fetch(`http://localhost:5000/api/workflows/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
                setWorkflows(prev => prev.filter(w => w.id !== id));
            }
        } catch (error) {
            console.error('Failed to delete', error);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Workflows</h1>
                    <p className="text-gray-500 mt-1">Automate tasks and communications.</p>
                </div>
                <button className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-md shadow-blue-200 transition-all">
                    <Plus className="w-5 h-5" />
                    New Workflow
                </button>
            </div>

            {loading ? (
                <div className="p-12 text-center text-gray-400">Loading workflows...</div>
            ) : workflows.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
                    <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-500">
                        <Activity className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">No workflows active</h3>
                    <p className="text-gray-500 mb-6">Create your first automation to save time.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {workflows.map(wf => (
                        <div key={wf.id} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow group relative">
                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleDelete(wf.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                                    <Zap className="w-5 h-5" />
                                </div>
                                <h3 className="font-bold text-gray-900">{wf.name}</h3>
                            </div>

                            <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                                <span className="font-medium capitalize">{wf.trigger.replace(/_/g, ' ')}</span>
                                <ArrowRight className="w-4 h-4 text-gray-400" />
                                <span className="font-medium capitalize">{wf.action.replace(/_/g, ' ')}</span>
                            </div>

                            <div className="mt-4 pt-4 border-t border-gray-50 flex justify-between items-center text-xs text-gray-400 font-medium">
                                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Auto-runs</span>
                                <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Active</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
