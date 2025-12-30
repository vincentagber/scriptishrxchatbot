import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Providers from './providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
    title: {
        default: 'ScriptishRx | Modern Business CRM & Enterprise Management',
        template: '%s | ScriptishRx'
    },
    description: 'Transform your business operations with ScriptishRx. The all-in-one Business CRM featuring AI-powered client management, automated scheduling, secure communications, and smart workflows. Built for modern enterprises and service providers.',
    keywords: [
        'Business CRM',
        'Client Management Software',
        'Customer Relationship Management',
        'Enterprise Resource Planning',
        'AI Business Assistant',
        'Automated Scheduling',
        'SaaS Platform',
        'Workflow Automation',
        'Billing Software',
        'Business Intelligence',
        'ScriptishRx',
        'Digital Transformation',
        'SOC2 Compliant CRM',
        'AI Chatbot for Business',
        'Service Management',
        'Customer Engagement',
        'White Label SaaS',
        'Small Business Software'
    ],
    authors: [{ name: 'ScriptishRx Team' }],
    creator: 'ScriptishRx',
    publisher: 'ScriptishRx',
    formatDetection: {
        email: false,
        address: false,
        telephone: false,
    },
    icons: {
        icon: '/logo.jpg',
        apple: '/logo.jpg',
    },
    openGraph: {
        title: 'ScriptishRx | Intelligent Business Management Platform',
        description: 'Streamline your business operations with ScriptishRx. From AI-driven client interactions to seamless booking and comprehensive CRM features.',
        url: 'https://scriptish-rx.com',
        siteName: 'ScriptishRx',
        locale: 'en_US',
        type: 'website',
        images: [
            {
                url: '/logo.jpg',
                width: 800,
                height: 600,
                alt: 'ScriptishRx Business Platform',
            },
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'ScriptishRx | AI-Powered Business CRM',
        description: 'Revolutionize your business management with ScriptishRx. AI scheduling, client CRM, and more.',
        images: ['/logo.jpg'],
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
        },
    },
};

export const viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body className={`${inter.variable} antialiased font-sans`}>
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
