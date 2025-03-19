import Chat from '@/components/Chat';

export default function Home() {
  return (
    <div className="min-h-screen p-4">
      <main className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-8 text-center">Hackathon Bot</h1>
        <Chat />
      </main>
    </div>
  );
}
