import ScriptGenerator from "@/components/ScriptGenerator";

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">VocalGym</h1>
        <p className="mt-2 text-slate-600">
          Describe a conversation you need to have. Get a short, tailored script
          and talking points to practice with.
        </p>
      </header>
      <ScriptGenerator />
    </main>
  );
}
