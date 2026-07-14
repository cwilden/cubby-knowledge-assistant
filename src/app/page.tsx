export default function Home() {
  return (
    <div className="flex min-h-screen bg-[#f7f5ef] text-[#17212b]">
      <main className="mx-auto flex w-full max-w-5xl flex-col justify-center px-6 py-16">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-[#41695c]">
          Supplier portal assistant
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
          Ask Cubby supplier questions and get cited answers from portal
          resources.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-[#52606c]">
          This prototype will retrieve public Cubby supplier content, ground an
          LLM response in those sources, and show Sarah where the answer came
          from.
        </p>
      </main>
    </div>
  );
}
