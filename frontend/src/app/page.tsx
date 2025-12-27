'use client';

import React, { useState } from 'react';
import { Hero } from '@/components/features/Hero';
import { Pricing } from '@/components/features/Pricing';
import {
  TrustedBy,
  FeatureSteps,
  FeatureShowcase,
  StatsBanner,
  AppBenefits,
  FAQ,
  Testimonials,
  Newsletter,
  Footer
} from '@/components/features/LandingContent';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import LandingChatWidget from '@/components/LandingChatWidget';

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <main className="min-h-screen relative overflow-hidden bg-white">
      {/* Ambient Background - World Class Visuals */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-blue-500/10 rounded-full blur-[120px] opacity-60 animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] bg-violet-500/10 rounded-full blur-[120px] opacity-60 animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Navigation - Glassmorphism 2.0 */}
      <nav className="fixed top-0 w-full z-50 px-4 md:px-6 py-4 transition-all duration-300 backdrop-blur-xl bg-white/70 border-b border-white/50 shadow-sm supports-[backdrop-filter]:bg-white/60">
        <div className="container mx-auto flex justify-between items-center relative z-10">
          <div className="flex items-center gap-2 relative z-50">
            <img src="/logo.jpg" alt="ScriptishRx Logo" className="h-16 w-auto object-contain" />
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-primary-start transition-colors">Platform</a>
            <a href="#solutions" className="hover:text-primary-start transition-colors">Solutions</a>
            <a href="#pricing" className="hover:text-primary-start transition-colors">Pricing</a>
            <Link href="/legal" className="hover:text-primary-start transition-colors">Legal</Link>
          </div>

          <div className="hidden md:flex gap-4">
            <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 px-4 py-2">
              Log in
            </Link>
            <Link href="/register" className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium px-5 py-2.5 rounded-full transition-shadow shadow-lg shadow-slate-900/20">
              Get Started
            </Link>
          </div>

          {/* Mobile Hamburger */}
          <button
            className="md:hidden relative z-50 p-2 text-slate-600"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {/* Mobile Menu Overlay */}
        <div className={cn(
          "fixed inset-0 bg-white z-40 flex flex-col items-center justify-center space-y-8 transition-all duration-300 ease-in-out md:hidden",
          mobileMenuOpen ? "opacity-100 translate-x-0" : "opacity-0 translate-x-full pointer-events-none"
        )}>
          <div className="flex flex-col items-center gap-6 text-lg font-medium text-slate-900">
            <a href="#features" onClick={() => setMobileMenuOpen(false)}>Platform</a>
            <a href="#solutions" onClick={() => setMobileMenuOpen(false)}>Solutions</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
            <Link href="/legal" onClick={() => setMobileMenuOpen(false)}>Legal</Link>
            <a href="#contact" onClick={() => setMobileMenuOpen(false)}>Contact</a>
          </div>

          <div className="flex flex-col gap-4 w-full px-8 max-w-sm">
            <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="outline" className="w-full rounded-full h-12 text-lg">Log in</Button>
            </Link>
            <Link href="/register" onClick={() => setMobileMenuOpen(false)}>
              <Button className="w-full rounded-full h-12 text-lg bg-primary-start text-white shadow-lg shadow-primary-start/20">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <Hero />
      <TrustedBy />
      <FeatureSteps />
      <FeatureShowcase />
      <StatsBanner />
      <AppBenefits />
      <FAQ />
      <Testimonials />
      <Pricing />
      <Newsletter />
      <Footer />
      <LandingChatWidget />
    </main>
  );
}
