import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, CircleSlash, Loader2, Plus, Play,
  Trash2, Wallet, XCircle, FlaskConical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  analisisBatch, ApiError, formatRupiah, getKonfigurasi, KASUS_UJI,
  type AnalisisBatchResponse, type LevelBias, type Pemohon, type StatusAlokasi,
} from "@/lib/api";
import { DEMO_KONFIGURASI } from "@/lib/config";
import { useMode } from "@/lib/mode";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Audit Batch — Etika Bantuan" },
      { name: "description", content: "Audit etika alokasi bantuan sosial: skor Bentham dan kewajiban Kant dalam satu batch." },
      { property: "og:title", content: "Audit Batch — Etika Bantuan" },
      { property: "og:description", content: "Audit etika alokasi bantuan sosial: skor Bentham dan kewajiban Kant dalam satu batch." },
    ],
  }),
  component: BatchAudit,
});

type Row = Pemohon & { id: number };
let nextId = 1;
const emptyRow = (): Row => ({
  id: nextId++, nama: "", pendapatan_bulanan: 0, jumlah_tanggungan: 0,
  kondisi_kesehatan_kronis: false, skor_kelayakan_ml: 50,
});

function rowErrors(r: Row) {
  const e: Partial<Record<keyof Pemohon, string>> = {};
  if (!r.nama.trim()) e.nama = "Nama wajib diisi";
  if (!Number.isFinite(r.pendapatan_bulanan) || r.pendapatan_bulanan < 0) e.pendapatan_bulanan = "Harus ≥ 0";
  if (!Number.isInteger(r.jumlah_tanggungan) || r.jumlah_tanggungan < 0) e.jumlah_tanggungan = "Bilangan bulat ≥ 0";
  if (!Number.isFinite(r.skor_kelayakan_ml) || r.skor_kelayakan_ml < 0 || r.skor_kelayakan_ml > 100) e.skor_kelayakan_ml = "0–100";
  return e;
}

const fieldCls = (err?: string) => (err ? "border-destructive focus-visible:ring-destructive" : "");

function BatchAudit() {
  const { mode } = useMode();
  const [kuota, setKuota] = useState(4_000_000);
  const [besaran, setBesaran] = useState<number | "">(DEMO_KONFIGURASI.nilai_bantuan_per_pemohon);
  const [ambang, setAmbang] = useState(DEMO_KONFIGURASI.ambang_kuota);
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ data: AnalisisBatchResponse; mode: typeof mode } | null>(null);
  const [open, setOpen] = useState<Set<number>>(new Set());

  useEffect(() => {
    setResult(null);
    setError(null);
    getKonfigurasi(mode)
      .then((k) => {
        setAmbang(k.ambang_kuota);
        setBesaran(k.nilai_bantuan_per_pemohon);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Gagal memuat konfigurasi."));
  }, [mode]);

  const besaranEff = besaran === "" ? DEMO_KONFIGURASI.nilai_bantuan_per_pemohon : besaran;
  const kapasitas = besaranEff > 0 ? Math.floor(kuota / besaranEff) : 0;
  const errors = useMemo(() => rows.map(rowErrors), [rows]);
  const budgetValid = kuota > 0 && (besaran === "" || besaran > 0);
  const valid = budgetValid && rows.length > 0 && errors.every((e) => Object.keys(e).length === 0);

  const update = (id: number, patch: Partial<Pemohon>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const data = await analisisBatch(mode, {
        kuota_anggaran_maksimal: kuota,
        ...(besaran === "" ? {} : { besaran_bantuan_per_pemohon: besaran }),
        pemohon: rows.map(({ id: _id, ...p }) => p),
      });
      setResult({ data, mode });
      setOpen(new Set());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Terjadi galat tak terduga.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="font-serif text-3xl tracking-tight">Audit Batch</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Uji alokasi bantuan terhadap dua lensa:{" "}
          <span className="text-bentham">kalkulasi utilitarian Bentham</span> dan{" "}
          <span className="text-kant">kewajiban kategoris Kant</span>.
        </p>
      </div>

      {/* Budget */}
      <section className="rounded-md border bg-card p-6">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-medium"><Wallet className="h-4 w-4" />Anggaran</h2>
        <div className="grid gap-6 md:grid-cols-3">
          <label className="space-y-1.5 text-sm">
            <span className="text-muted-foreground">Kuota anggaran maksimal (Rp)</span>
            <Input type="number" min={0} className={`num ${fieldCls(kuota > 0 ? undefined : "x")}`} value={kuota}
              onChange={(e) => setKuota(Number(e.target.value))} />
            <span className="num text-xs text-muted-foreground">{formatRupiah(kuota || 0)}</span>
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="text-muted-foreground">Besaran bantuan per pemohon (opsional)</span>
            <Input type="number" min={0} className="num" value={besaran}
              onChange={(e) => setBesaran(e.target.value === "" ? "" : Number(e.target.value))} />
            <span className="num text-xs text-muted-foreground">{formatRupiah(besaranEff)}</span>
          </label>
          <div className="rounded border bg-background/40 p-4">
            <div className="text-xs text-muted-foreground">Kapasitas penerima</div>
            <div className="num mt-1 text-3xl font-medium">{kapasitas}</div>
            <div className="text-xs text-muted-foreground">pemohon · ambang kuota <span className="num">{ambang}</span></div>
          </div>
        </div>
      </section>

      {/* Applicants */}
      <section className="rounded-md border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
          <h2 className="text-sm font-medium">Pemohon <span className="num text-muted-foreground">({rows.length})</span></h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setRows(KASUS_UJI.map((p) => ({ ...p, id: nextId++ })))}>
              <FlaskConical className="h-4 w-4" />Muat 5 kasus uji
            </Button>
            <Button variant="outline" size="sm" onClick={() => setRows((r) => [...r, emptyRow()])}>
              <Plus className="h-4 w-4" />Tambah pemohon
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="p-3 font-normal">Nama</th>
                <th className="p-3 font-normal">Pendapatan bulanan</th>
                <th className="p-3 font-normal">Tanggungan</th>
                <th className="p-3 font-normal">Kronis</th>
                <th className="p-3 font-normal">Skor kelayakan ML</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const e = errors[i] ?? {};
                return (
                  <tr key={r.id} className="border-b align-top last:border-0">
                    <td className="p-3 min-w-48">
                      <Input value={r.nama} className={fieldCls(e.nama)} aria-invalid={!!e.nama}
                        onChange={(ev) => update(r.id, { nama: ev.target.value })} placeholder="Nama pemohon" />
                      {e.nama && <p className="mt-1 text-xs text-bad">{e.nama}</p>}
                    </td>
                    <td className="p-3 min-w-40">
                      <Input type="number" min={0} className={`num ${fieldCls(e.pendapatan_bulanan)}`} value={r.pendapatan_bulanan}
                        onChange={(ev) => update(r.id, { pendapatan_bulanan: Number(ev.target.value) })} />
                      {e.pendapatan_bulanan && <p className="mt-1 text-xs text-bad">{e.pendapatan_bulanan}</p>}
                    </td>
                    <td className="p-3 w-28">
                      <Input type="number" min={0} step={1} className={`num ${fieldCls(e.jumlah_tanggungan)}`} value={r.jumlah_tanggungan}
                        onChange={(ev) => update(r.id, { jumlah_tanggungan: Number(ev.target.value) })} />
                      {e.jumlah_tanggungan && <p className="mt-1 text-xs text-bad">{e.jumlah_tanggungan}</p>}
                    </td>
                    <td className="p-3 pt-5">
                      <Switch checked={r.kondisi_kesehatan_kronis} aria-label="Kondisi kesehatan kronis"
                        onCheckedChange={(v) => update(r.id, { kondisi_kesehatan_kronis: v })} />
                    </td>
                    <td className="p-3 min-w-56">
                      <div className="flex items-center gap-3">
                        <Slider min={0} max={100} step={1} value={[r.skor_kelayakan_ml || 0]} className="flex-1"
                          onValueChange={([v]) => update(r.id, { skor_kelayakan_ml: v ?? 0 })} />
                        <Input type="number" min={0} max={100} className={`num w-20 ${fieldCls(e.skor_kelayakan_ml)}`}
                          value={r.skor_kelayakan_ml} onChange={(ev) => update(r.id, { skor_kelayakan_ml: Number(ev.target.value) })} />
                      </div>
                      {e.skor_kelayakan_ml && <p className="mt-1 text-xs text-bad">{e.skor_kelayakan_ml}</p>}
                    </td>
                    <td className="p-3">
                      <Button variant="ghost" size="icon" aria-label="Hapus pemohon"
                        onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Belum ada pemohon.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex items-center gap-4">
        <Button size="lg" disabled={!valid || loading} onClick={run}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {loading ? "Menjalankan audit…" : "Jalankan Audit Etika"}
        </Button>
        {!valid && <span className="text-xs text-muted-foreground">Lengkapi isian yang ditandai sebelum menjalankan audit.</span>}
      </div>

      {error && (
        <div role="alert" className="flex gap-3 rounded-md border border-bad/40 bg-bad-soft p-4 text-sm text-bad">
          <XCircle className="h-4 w-4 shrink-0 mt-0.5" />{error}
        </div>
      )}

      {result && (
        <Results data={result.data} isDemo={result.mode === "demo"} ambang={ambang} open={open}
          toggle={(i) => setOpen((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; })} />
      )}
    </div>
  );
}

const STATUS: Record<StatusAlokasi, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  DITERIMA: { label: "DITERIMA", cls: "border-ok/40 bg-ok-soft text-ok", Icon: CheckCircle2 },
  TIDAK_LAYAK: { label: "TIDAK LAYAK", cls: "border-bad/40 bg-bad-soft text-bad", Icon: XCircle },
  ANGGARAN_HABIS: { label: "ANGGARAN HABIS", cls: "border-warn/40 bg-warn-soft text-warn", Icon: CircleSlash },
};
const BIAS: Record<LevelBias, string> = {
  RENDAH: "border-border text-muted-foreground",
  SEDANG: "border-warn/40 text-warn",
  TINGGI: "border-bad/40 text-bad",
};

function Results({ data, isDemo, ambang, open, toggle }: {
  data: AnalisisBatchResponse; isDemo: boolean; ambang: number; open: Set<number>; toggle: (i: number) => void;
}) {
  const r = data.ringkasan;
  const kantUnfunded = r.wajib_kant_tidak_terdanai > 0;
  const cards = [
    { label: "Diterima / kapasitas", value: `${r.jumlah_diterima} / ${r.kapasitas_penerima}` },
    { label: "Total dialokasikan", value: formatRupiah(r.total_dialokasikan) },
    { label: "Sisa anggaran", value: formatRupiah(r.sisa_anggaran) },
    { label: "Wajib Kant terdanai", value: `${r.wajib_kant_diterima} / ${r.jumlah_wajib_kant}`, kant: true },
  ];
  return (
    <section className="space-y-6 animate-in fade-in duration-200">
      <div className="flex items-baseline justify-between">
        <h2 className="font-serif text-2xl">Hasil audit</h2>
        {isDemo && (
          <span className="rounded border border-warn/40 bg-warn-soft px-2 py-0.5 text-xs text-warn">
            Data demo — bukan keluaran server
          </span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className={`rounded-md border bg-card p-4 ${c.kant ? "border-l-2 border-l-kant" : ""}`}>
            <div className="text-xs text-muted-foreground">{c.label}</div>
            <div className="num mt-1 text-xl font-medium">{c.value}</div>
          </div>
        ))}
      </div>

      {r.peringatan.map((p, i) => {
        const strong = kantUnfunded && /kant/i.test(p);
        return (
          <div key={i} role="alert" className={`flex gap-3 rounded-md border p-4 text-sm ${
            strong ? "border-bad bg-bad-soft text-bad font-medium" : "border-warn/40 bg-warn-soft text-warn"}`}>
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />{p}
          </div>
        );
      })}

      <div className="overflow-x-auto rounded-md border bg-card">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="p-3 w-8" /><th className="p-3 font-normal">#</th>
              <th className="p-3 font-normal">Nama</th><th className="p-3 font-normal">Status</th>
              <th className="p-3 font-normal">Dasar</th><th className="p-3 font-normal">Skor gabungan</th>
              <th className="p-3 font-normal">Bias</th><th className="p-3 font-normal text-right">Dana</th>
            </tr>
          </thead>
          <tbody>
            {data.alokasi.map((a) => {
              const s = STATUS[a.status_alokasi];
              const isOpen = open.has(a.indeks_input);
              return (
                <Fragment key={a.indeks_input}>
                  <tr className="cursor-pointer border-b hover:bg-accent/40" onClick={() => toggle(a.indeks_input)}>
                    <td className="p-3 text-muted-foreground">
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </td>
                    <td className="num p-3">{a.peringkat}</td>
                    <td className="p-3">{a.nama}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded border px-2 py-0.5 text-xs font-medium ${s.cls}`}>
                        <s.Icon className="h-3.5 w-3.5" />{s.label}
                      </span>
                    </td>
                    <td className="p-3">
                      {a.wajib_kant
                        ? <span className="whitespace-nowrap rounded border border-kant/40 bg-kant-soft px-2 py-0.5 text-xs text-kant">Kewajiban Kant</span>
                        : <span className="whitespace-nowrap rounded border border-bentham/40 bg-bentham-soft px-2 py-0.5 text-xs text-bentham">Skor Bentham</span>}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="relative h-1.5 w-24 rounded-full bg-muted" aria-hidden>
                          <div className={`h-full rounded-full ${a.wajib_kant ? "bg-kant" : "bg-bentham"}`}
                            style={{ width: `${Math.min(100, a.skor_gabungan)}%` }} />
                          <div className="absolute -top-1 h-3.5 w-px bg-foreground" style={{ left: `${ambang}%` }} title={`Ambang ${ambang}`} />
                        </div>
                        <span className="num text-xs">{a.skor_gabungan.toFixed(1)}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={`rounded border px-2 py-0.5 text-xs ${BIAS[a.level_bias]}`}>{a.level_bias}</span>
                    </td>
                    <td className="num p-3 text-right">{formatRupiah(a.dana_dialokasikan)}</td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b bg-background/40">
                      <td />
                      <td colSpan={7} className="p-4">
                        <div className="text-xs text-muted-foreground">Penjelasan alokasi</div>
                        <p className="mt-1 max-w-3xl font-serif text-base leading-relaxed">{a.penjelasan_alokasi}</p>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Garis tegak pada bar skor menandai ambang kuota ({ambang}).</p>
    </section>
  );
}
