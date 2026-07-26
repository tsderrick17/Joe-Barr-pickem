export default function Home() {
  return (
    <main className="min-h-screen bg-white text-black p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold">
          Joe Barr Memorial Best Bets Pick&apos;em
        </h1>

        <p className="mt-2 text-gray-600 text-lg">
          Honor the tradition. Eliminate the paperwork.
        </p>

        <hr className="my-8" />

        <section className="mb-8">
          <h2 className="text-2xl font-semibold">Standings</h2>
          <p className="text-gray-500 mt-2">
            No season loaded.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold">Current Week Picks</h2>
          <p className="text-gray-500 mt-2">
            No games available.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold">Survivor</h2>
          <p className="text-gray-500 mt-2">
            No survivor entries.
          </p>
        </section>
      </div>
    </main>
  );
}