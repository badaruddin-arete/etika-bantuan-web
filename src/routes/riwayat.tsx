import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/riwayat")({
  head: () => ({
    meta: [
      { title: "Riwayat Audit — Etika Bantuan" },
      { name: "description", content: "Riwayat audit etika batch bantuan sosial." },
      { property: "og:title", content: "Riwayat Audit — Etika Bantuan" },
      { property: "og:description", content: "Riwayat audit etika batch bantuan sosial." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <div className="mx-auto max-w-6xl">
      <h1 className="font-serif text-3xl">Riwayat Audit</h1>
      <p className="mt-2 text-sm text-muted-foreground">Halaman ini akan tersedia pada tahap berikutnya.</p>
    </div>
  ),
});
