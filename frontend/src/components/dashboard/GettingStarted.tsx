'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Circle, X, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface Step {
    id: string;
    label: string;
    href: string;
    completed: boolean;
}

export function GettingStarted() {
    const [isVisible, setIsVisible] = useState(true);
    const [steps, setSteps] = useState<Step[]>([
        { id: 'profile', label: 'Complete your profile', href: '/settings', completed: false },
        { id: 'voice', label: 'Test the AI Voice Agent', href: '/dashboard/voice', completed: false },
        { id: 'invite', label: 'Invite a team member', href: '/settings/team', completed: false },
    ]);

    // Mock completion toggle for demo (in real app, check user data)
    const toggleStep = (id: string) => {
        setSteps(steps.map(s => s.id === id ? { ...s, completed: !s.completed } : s));
    };

    const progress = Math.round((steps.filter(s => s.completed).length / steps.length) * 100);

    if (!isVisible) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-3xl p-1 shadow-xl mb-8 relative overflow-hidden group"
            >
                {/* Glassy Overlay */}
                <div className="bg-white/10 backdrop-blur-md rounded-[22px] p-6 sm:p-8 text-white relative z-10">

                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h2 className="text-2xl font-bold mb-2">Welcome to your Command Center</h2>
                            <p className="text-blue-100 max-w-xl">
                                Let's get your workspace ready. Follow these steps to experience the full power of ScriptishRx.
                            </p>
                        </div>
                        <button
                            onClick={() => setIsVisible(false)}
                            className="p-2 hover:bg-white/20 rounded-full transition-colors"
                        >
                            <X className="w-5 h-5 opacity-80" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                        <div className="space-y-4 col-span-2">
                            {steps.map((step) => (
                                <div
                                    key={step.id}
                                    className={cn(
                                        "flex items-center gap-4 p-4 rounded-xl transition-all cursor-pointer border border-transparent",
                                        step.completed ? "bg-emerald-500/20 border-emerald-500/30" : "bg-white/5 hover:bg-white/10 border-white/10"
                                    )}
                                    onClick={() => toggleStep(step.id)}
                                >
                                    {step.completed ? (
                                        <CheckCircle2 className="w-6 h-6 text-emerald-300 flex-shrink-0" />
                                    ) : (
                                        <Circle className="w-6 h-6 text-blue-200 flex-shrink-0" />
                                    )}
                                    <div className="flex-1">
                                        <span className={cn("font-medium block", step.completed && "text-emerald-100 line-through")}>
                                            {step.label}
                                        </span>
                                    </div>
                                    <Link href={step.href} className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors" onClick={(e) => e.stopPropagation()}>
                                        <ArrowRight className="w-4 h-4" />
                                    </Link>
                                </div>
                            ))}
                        </div>

                        {/* Progress Circle */}
                        <div className="flex flex-col items-center justify-center p-4">
                            <div className="relative w-32 h-32 flex items-center justify-center">
                                <svg className="w-full h-full transform -rotate-90">
                                    <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-blue-900/30" />
                                    <circle
                                        cx="64" cy="64" r="56"
                                        stroke="currentColor" strokeWidth="12"
                                        fill="transparent"
                                        strokeDasharray={351.86}
                                        strokeDashoffset={351.86 - (351.86 * progress) / 100}
                                        className="text-white transition-all duration-1000 ease-out"
                                        strokeLinecap="round"
                                    />
                                </svg>
                                <span className="absolute text-2xl font-bold">{progress}%</span>
                            </div>
                            <p className="mt-4 text-sm font-medium text-blue-200 uppercase tracking-widest">Setup Progress</p>
                        </div>
                    </div>

                </div>

                {/* Ambient blob */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />

            </motion.div>
        </AnimatePresence>
    );
}
