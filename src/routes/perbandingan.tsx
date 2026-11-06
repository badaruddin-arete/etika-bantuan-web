import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/perbandingan")({
  head: () => ({
    meta: [
      { title: "Perbandingan Etika — Etika Bantuan" },
      { name: "description", content: "Bandingkan lensa Bentham dan Kant dalam seleksi bantuan sosial." },
      { property: "og:title", content: "Perbandingan Etika — Etika Bantuan" },
      { property: "og:description", content: "Bandingkan lensa Bentham dan Kant dalam seleksi bantuan sosial." },
    ],
  }),
  component: () => (
    <div className="mx-auto max-w-6xl">
      <h1 className="font-serif text-3xl">Perbandingan Etika</h1>
      <p className="mt-2 text-sm text-muted-foreground">Halaman ini akan tersedia pada tahap berikutnya.</p>
    </div>
  ),
});
