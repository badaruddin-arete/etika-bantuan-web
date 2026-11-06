import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type * as React from "react";
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
type Field = keyof Pemohon;
let nextId = 1;
const emptyRow = (): Row => ({
  id: nextId++, nama: "", pendapatan_bulanan: 0, jumlah_tanggungan: 0,
  kondisi_kesehatan_kronis: false, skor_kelayakan_ml: 50,
});

const FIELD_LABEL: Record<Field, string> = {
  nama: "nama", pendapatan_bulanan: "pendapatan", jumlah_tanggungan: "tanggungan",
  kondisi_kesehatan_kronis: "kronis", skor_kelayakan_ml: "skor ML",
};

function rowErrors(r: Row) {
  const e: Partial<Record<Field, string>> = {};
  if (!r.nama.trim()) e.nama = "Nama wajib diisi";
  if (!Number.isFinite(r.pendapatan_bulanan) || r.pendapatan_bulanan < 0) e.pendapatan_bulanan = "Harus ≥ 0";
  if (!Number.isInteger(r.jumlah_tanggungan) || r.jumlah_tanggungan < 0) e.jumlah_tanggungan = "Bilangan bulat ≥ 0";
  if (!Number.isFinite(r.skor_kelayakan_ml) || r.skor_kelayakan_ml < 0 || r.skor_kelayakan_ml > 100) e.skor_kelayakan_ml = "0–100";
  return e;
}

const fieldCls = (err?: string) => (err ? "border-destructive focus-visible:ring-destructive" : "");
const idFmt = new Intl.NumberFormat("id-ID");

/** Text input that shows id-ID thousand separators but emits a plain number. */
function RupiahInput({ value, onValue, allowEmpty, className, ...rest }: {
  value: number | ""; onValue: (v: number | "") => void; allowEmpty?: boolean; className?: string;
} & Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type">) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp</span>
      <Input {...rest} type="text" inputMode="numeric" className={`num pl-9 ${className ?? ""}`}
        value={value === "" ? "" : idFmt.format(value)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "");
          onValue(digits === "" ? (allowEmpty ? "" : 0) : Number(digits));
        }} />
    </div>
  );
}

function BatchAudit() {
  const { mode } = useMode();
  const [kuota, setKuota] = useState(4_000_000);
  const [besaran, setBesaran] = useState<number | "">(DEMO_KONFIGURASI.nilai_bantuan_per_pemohon);
  const [ambang, setAmbang] = useState(DEMO_KONFIGURASI.ambang_kuota);
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ data: AnalisisBatchResponse; mode: typeof mode } | null>(null);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const focusRowId = useRef<number | null>(null);

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

  useEffect(() => {
    if (focusRowId.current == null) return;
    const el = document.querySelector<HTMLInputElement>(`[data-row-name="${focusRowId.current}"]`);
    focusRowId.current = null;
    el?.focus();
  }, [rows]);

  const besaranEff = besaran === "" ? DEMO_KONFIGURASI.nilai_bantuan_per_pemohon : besaran;
  const kapasitas = besaranEff > 0 ? Math.floor(kuota / besaranEff) : 0;
  const errors = useMemo(() => rows.map(rowErrors), [rows]);
  const kuotaErr = kuota > 0 ? undefined : "Harus > 0";
  const besaranErr = besaran === "" || besaran > 0 ? undefined : "Harus > 0";

  const missing = useMemo(() => {
    const out: string[] = [];
    const budget = [kuotaErr && "kuota anggaran", besaranErr && "besaran bantuan"].filter(Boolean);
    if (budget.length) out.push(`Anggaran: ${budget.join(", ")}`);
    if (rows.length === 0) out.push("Tambahkan minimal satu pemohon");
    errors.forEach((e, i) => {
      const keys = Object.keys(e) as Field[];
      if (keys.length) out.push(`Baris ${i + 1}: ${keys.map((k) => FIELD_LABEL[k]).join(", ")}`);
    });
    return out;
  }, [errors, rows.length, kuotaErr, besaranErr]);
  const valid = missing.length === 0;

  const touch = (key: string) => setTouched((s) => (s.has(key) ? s : new Set(s).add(key)));
  const shown = (key: string, err?: string) => (err && (submitted || touched.has(key)) ? err : undefined);

  const update = (id: number, patch: Partial<Pemohon>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const addRow = () => {
    const r = emptyRow();
    focusRowId.current = r.id;
    setRows((rs) => [...rs, r]);
  };

  const onRowKeyDown = (idx: number) => (ev: React.KeyboardEvent) => {
    if (ev.key === "Enter" && idx === rows.length - 1 && (ev.target as HTMLElement).tagName === "INPUT") {
      ev.preventDefault();
      addRow();
    }
  };

  async function run() {
    setSubmitted(true);
    if (!valid) return;
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

  const fieldsFor = (r: Row, i: number) => {
    const e = errors[i] ?? {};
    const k = (f: Field) => `${r.id}.${f}`;
    const err = {
      nama: shown(k("nama"), e.nama),
      pendapatan_bulanan: shown(k("pendapatan_bulanan"), e.pendapatan_bulanan),
      jumlah_tanggungan: shown(k("jumlah_tanggungan"), e.jumlah_tanggungan),
      skor_kelayakan_ml: shown(k("skor_kelayakan_ml"), e.skor_kelayakan_ml),
    };
    const msg = (m?: string) => m && <p className="mt-1 text-xs text-bad">{m}</p>;
    return {
      nama: (<>
        <Input data-row-name={r.id} value={r.nama} className={fieldCls(err.nama)} aria-invalid={!!err.nama}
          aria-label={`Nama pemohon baris ${i + 1}`} onBlur={() => touch(k("nama"))}
          onChange={(ev) => update(r.id, { nama: ev.target.value })} placeholder="Nama pemohon" />
        {msg(err.nama)}
      </>),
      pendapatan: (<>
        <RupiahInput value={r.pendapatan_bulanan} className={fieldCls(err.pendapatan_bulanan)}
          aria-label={`Pendapatan bulanan baris ${i + 1}`} aria-invalid={!!err.pendapatan_bulanan}
          onBlur={() => touch(k("pendapatan_bulanan"))}
          onValue={(v) => update(r.id, { pendapatan_bulanan: v === "" ? 0 : v })} />
        {msg(err.pendapatan_bulanan)}
      </>),
      tanggungan: (<>
        <Input type="number" min={0} step={1} className={`num ${fieldCls(err.jumlah_tanggungan)}`} value={r.jumlah_tanggungan}
          aria-label={`Jumlah tanggungan baris ${i + 1}`} aria-invalid={!!err.jumlah_tanggungan}
          onBlur={() => touch(k("jumlah_tanggungan"))}
          onChange={(ev) => update(r.id, { jumlah_tanggungan: Number(ev.target.value) })} />
        {msg(err.jumlah_tanggungan)}
      </>),
      kronis: (
        <Switch checked={r.kondisi_kesehatan_kronis} aria-label={`Kondisi kesehatan kronis baris ${i + 1}`}
          onCheckedChange={(v) => update(r.id, { kondisi_kesehatan_kronis: v })} />
      ),
      skor: (<>
        <div className="flex items-center gap-2">
          <Slider min={0} max={100} step={1} value={[r.skor_kelayakan_ml || 0]} className="flex-1"
            aria-label={`Skor kelayakan ML baris ${i + 1}`}
            onValueChange={([v]) => update(r.id, { skor_kelayakan_ml: v ?? 0 })} />
          <Input type="number" min={0} max={100} className={`num w-16 px-2 ${fieldCls(err.skor_kelayakan_ml)}`}
            aria-label={`Skor kelayakan ML angka baris ${i + 1}`} aria-invalid={!!err.skor_kelayakan_ml}
            onBlur={() => touch(k("skor_kelayakan_ml"))}
            value={r.skor_kelayakan_ml} onChange={(ev) => update(r.id, { skor_kelayakan_ml: Number(ev.target.value) })} />
        </div>
        {msg(err.skor_kelayakan_ml)}
      </>),
      hapus: (
        <Button variant="ghost" size="icon" aria-label={`Hapus pemohon baris ${i + 1}`}
          onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}>
          <Trash2 className="h-4 w-4" />
        </Button>
      ),
    };
  };

  const kuotaShown = shown("kuota", kuotaErr);
  const besaranShown = shown("besaran", besaranErr);

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
            <span className="text-muted-foreground">Kuota anggaran maksimal</span>
            <RupiahInput value={kuota} className={fieldCls(kuotaShown)} aria-invalid={!!kuotaShown}
              onBlur={() => touch("kuota")} onValue={(v) => setKuota(v === "" ? 0 : v)} />
            {kuotaShown && <span className="text-xs text-bad">{kuotaShown}</span>}
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="text-muted-foreground">Besaran bantuan per pemohon (opsional)</span>
            <RupiahInput value={besaran} allowEmpty className={fieldCls(besaranShown)} aria-invalid={!!besaranShown}
              placeholder={idFmt.format(DEMO_KONFIGURASI.nilai_bantuan_per_pemohon)}
              onBlur={() => touch("besaran")} onValue={setBesaran} />
            {besaranShown && <span className="text-xs text-bad">{besaranShown}</span>}
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
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setRows(KASUS_UJI.map((p) => ({ ...p, id: nextId++ })))}>
              <FlaskConical className="h-4 w-4" />Muat 5 kasus uji
            </Button>
            <Button variant="outline" size="sm" onClick={addRow}>
              <Plus className="h-4 w-4" />Tambah pemohon
            </Button>
          </div>
        </div>

        {/* Desktop / tablet table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col /><col className="w-40" /><col className="w-24" /><col className="w-16" /><col className="w-52" /><col className="w-12" />
            </colgroup>
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="p-2 pl-4 font-normal">Nama</th>
                <th className="p-2 font-normal">Pendapatan bulanan</th>
                <th className="p-2 font-normal">Tanggungan</th>
                <th className="p-2 font-normal">Kronis</th>
                <th className="p-2 font-normal">Skor kelayakan ML</th>
                <th className="p-2"><span className="sr-only">Aksi</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const f = fieldsFor(r, i);
                return (
                  <tr key={r.id} className="border-b align-top last:border-0" onKeyDown={onRowKeyDown(i)}>
                    <td className="p-2 pl-4">{f.nama}</td>
                    <td className="p-2">{f.pendapatan}</td>
                    <td className="p-2">{f.tanggungan}</td>
                    <td className="p-2 pt-4">{f.kronis}</td>
                    <td className="p-2">{f.skor}</td>
                    <td className="p-2 pr-3">{f.hapus}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Belum ada pemohon.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <ul className="divide-y md:hidden">
          {rows.map((r, i) => {
            const f = fieldsFor(r, i);
            return (
              <li key={r.id} className="space-y-3 p-4" onKeyDown={onRowKeyDown(i)}>
                <div className="flex items-center justify-between">
                  <span className="num text-xs text-muted-foreground">Baris {i + 1}</span>
                  {f.hapus}
                </div>
                <div className="space-y-1 text-sm"><span className="text-xs text-muted-foreground">Nama</span>{f.nama}</div>
                <div className="space-y-1 text-sm"><span className="text-xs text-muted-foreground">Pendapatan bulanan</span>{f.pendapatan}</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1 text-sm"><span className="text-xs text-muted-foreground">Tanggungan</span>{f.tanggungan}</div>
                  <div className="space-y-1 text-sm"><span className="block text-xs text-muted-foreground">Kronis</span><div className="pt-2">{f.kronis}</div></div>
                </div>
                <div className="space-y-1 text-sm"><span className="text-xs text-muted-foreground">Skor kelayakan ML</span>{f.skor}</div>
              </li>
            );
          })}
          {rows.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">Belum ada pemohon.</li>}
        </ul>
      </section>

      <div className="space-y-2">
        <Button size="lg" disabled={!valid || loading} onClick={run} aria-describedby={!valid ? "audit-missing" : undefined}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {loading ? "Menjalankan audit…" : "Jalankan Audit Etika"}
        </Button>
        {!valid && (
          <div id="audit-missing" className="text-xs text-muted-foreground">
            <span>Lengkapi dulu:</span>
            <ul className="mt-1 list-disc pl-5">
              {missing.map((m) => <li key={m}>{m}</li>)}
            </ul>
          </div>
        )}
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
