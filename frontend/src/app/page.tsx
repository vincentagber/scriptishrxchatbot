import ChatInterface from '@/components/ChatInterface';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-100 pb-20">
      <div className="container mx-auto p-4">
        <h1 className="text-4xl font-bold text-center mt-20 text-scriptish-purple">ScriptishRx</h1>
        <p className="text-center text-gray-600 mt-4">Your Wellness Journey Starts Here!</p>
      </div>
      <ChatInterface />
    </main>
  );
}
