import { API_BASE_URL, DEMO_KONFIGURASI } from "./config";

export type Mode = "demo" | "live";

export interface Pemohon {
  nama: string;
  pendapatan_bulanan: number;
  jumlah_tanggungan: number;
  kondisi_kesehatan_kronis: boolean;
  skor_kelayakan_ml: number;
}

export interface AnalisisBatchRequest {
  kuota_anggaran_maksimal: number;
  besaran_bantuan_per_pemohon?: number;
  pemohon: Pemohon[];
}

export type StatusAlokasi = "DITERIMA" | "TIDAK_LAYAK" | "ANGGARAN_HABIS";
export type LevelBias = "RENDAH" | "SEDANG" | "TINGGI";

export interface Alokasi {
  peringkat: number;
  indeks_input: number;
  nama: string;
  wajib_kant: boolean;
  skor_gabungan: number;
  status_alokasi: StatusAlokasi;
  dana_dialokasikan: number;
  level_bias: LevelBias;
  penjelasan_alokasi: string;
}

export interface Ringkasan {
  total_pemohon: number;
  kuota_anggaran_maksimal: number;
  besaran_bantuan_per_pemohon: number;
  kapasitas_penerima: number;
  jumlah_diterima: number;
  total_dialokasikan: number;
  sisa_anggaran: number;
  jumlah_wajib_kant: number;
  wajib_kant_diterima: number;
  wajib_kant_tidak_terdanai: number;
  peringatan: string[];
}

export interface AnalisisBatchResponse {
  ringkasan: Ringkasan;
  alokasi: Alokasi[];
}

export interface Konfigurasi {
  ambang_kuota: number;
  nilai_bantuan_per_pemohon: number;
  [key: string]: unknown;
}

export class ApiError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError(
      `Server audit tidak dapat dihubungi di ${API_BASE_URL}. Pastikan server berjalan, atau kembali ke mode Demo.`,
    );
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(`Server mengembalikan galat ${res.status}. ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export async function getKonfigurasi(mode: Mode): Promise<Konfigurasi> {
  if (mode === "demo") return { ...DEMO_KONFIGURASI };
  return request<Konfigurasi>("/konfigurasi");
}

export async function analisisBatch(
  mode: Mode,
  body: AnalisisBatchRequest,
): Promise<AnalisisBatchResponse> {
  if (mode === "demo") {
    await new Promise((r) => setTimeout(r, 600));
    return mockAnalisisBatch(body);
  }
  return request<AnalisisBatchResponse>("/analisis-batch", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/* ---------------- Demo mock (illustrative only) ---------------- */

const r1 = (n: number) => Math.round(n * 10) / 10;

const KNOWN: Record<string, { skor: number; bias: LevelBias }> = {
  "Pemohon A (kaya, ML keliru)": { skor: 39.6, bias: "SEDANG" },
  "Pemohon B (miskin, kronis, lajang)": { skor: 40.3, bias: "TINGGI" },
  "Pemohon C (5 anak)": { skor: 58.8, bias: "RENDAH" },
  "Pemohon D": { skor: 53.4, bias: "RENDAH" },
  "Pemohon E": { skor: 35.6, bias: "RENDAH" },
};

function mockScore(p: Pemohon): { skor: number; bias: LevelBias } {
  const known = KNOWN[p.nama];
  if (known) return known;
  const perKapita = p.pendapatan_bulanan / (p.jumlah_tanggungan + 1);
  const kebutuhan = Math.max(0, 100 - (perKapita / 2_000_000) * 50);
  const benthamRaw =
    0.55 * kebutuhan + 6 * Math.min(p.jumlah_tanggungan, 5) + (p.kondisi_kesehatan_kronis ? 10 : 0);
  const skor = r1(Math.min(100, Math.max(0, 0.7 * benthamRaw + 0.3 * p.skor_kelayakan_ml)));
  const gap = Math.abs(p.skor_kelayakan_ml - benthamRaw);
  const bias: LevelBias = gap > 50 ? "TINGGI" : gap > 25 ? "SEDANG" : "RENDAH";
  return { skor, bias };
}

const isWajibKant = (p: Pemohon) =>
  p.kondisi_kesehatan_kronis && p.pendapatan_bulanan < 500_000;

export function mockAnalisisBatch(req: AnalisisBatchRequest): AnalisisBatchResponse {
  const ambang = DEMO_KONFIGURASI.ambang_kuota;
  const besaran = req.besaran_bantuan_per_pemohon ?? DEMO_KONFIGURASI.nilai_bantuan_per_pemohon;
  const kapasitas = besaran > 0 ? Math.floor(req.kuota_anggaran_maksimal / besaran) : 0;

  const scored = req.pemohon.map((p, i) => ({ p, i, kant: isWajibKant(p), ...mockScore(p) }));
  scored.sort((a, b) => {
    if (a.kant !== b.kant) return a.kant ? -1 : 1;
    const al = a.skor >= ambang, bl = b.skor >= ambang;
    if (al !== bl) return al ? -1 : 1;
    return b.skor - a.skor;
  });

  let terisi = 0;
  const alokasi: Alokasi[] = scored.map((s, idx) => {
    const peringkat = idx + 1;
    const fmt = s.skor.toFixed(1);
    let status: StatusAlokasi;
    let penjelasan: string;
    if (s.kant) {
      if (terisi < kapasitas) {
        status = "DITERIMA";
        terisi++;
        penjelasan = `Prioritas mutlak Kant: didanai lebih dulu terlepas dari skor gabungan ${fmt}.`;
      } else {
        status = "ANGGARAN_HABIS";
        penjelasan = `Wajib Kant, tetapi anggaran tidak mencukupi untuk mendanai pemohon ini.`;
      }
    } else if (s.skor < ambang) {
      status = "TIDAK_LAYAK";
      penjelasan = `Skor gabungan ${fmt} di bawah ambang ${ambang.toFixed(1)} dan tidak memenuhi syarat absolut Kant.`;
    } else if (terisi < kapasitas) {
      status = "DITERIMA";
      terisi++;
      penjelasan = `Skor gabungan ${fmt} >= ambang ${ambang.toFixed(1)} dan masuk kapasitas anggaran pada peringkat ${peringkat}.`;
    } else {
      status = "ANGGARAN_HABIS";
      penjelasan = `Skor gabungan ${fmt} lolos ambang, tetapi anggaran habis.`;
    }
    return {
      peringkat,
      indeks_input: s.i,
      nama: s.p.nama,
      wajib_kant: s.kant,
      skor_gabungan: s.skor,
      status_alokasi: status,
      dana_dialokasikan: status === "DITERIMA" ? besaran : 0,
      level_bias: s.bias,
      penjelasan_alokasi: penjelasan,
    };
  });

  const diterima = alokasi.filter((a) => a.status_alokasi === "DITERIMA").length;
  const total = diterima * besaran;
  const kantAll = alokasi.filter((a) => a.wajib_kant);
  const kantOk = kantAll.filter((a) => a.status_alokasi === "DITERIMA").length;
  const habisNonKant = alokasi.filter((a) => a.status_alokasi === "ANGGARAN_HABIS" && !a.wajib_kant).length;
  const peringatan: string[] = [];
  if (kantAll.length - kantOk > 0)
    peringatan.push(
      `${kantAll.length - kantOk} pemohon wajib Kant tidak terdanai. Kewajiban kategoris dilanggar; tambah anggaran.`,
    );
  if (habisNonKant > 0)
    peringatan.push(`${habisNonKant} pemohon lolos ambang kuota tetapi tidak terdanai karena anggaran habis.`);

  return {
    ringkasan: {
      total_pemohon: req.pemohon.length,
      kuota_anggaran_maksimal: req.kuota_anggaran_maksimal,
      besaran_bantuan_per_pemohon: besaran,
      kapasitas_penerima: kapasitas,
      jumlah_diterima: diterima,
      total_dialokasikan: total,
      sisa_anggaran: req.kuota_anggaran_maksimal - total,
      jumlah_wajib_kant: kantAll.length,
      wajib_kant_diterima: kantOk,
      wajib_kant_tidak_terdanai: kantAll.length - kantOk,
      peringatan,
    },
    alokasi,
  };
}

export const KASUS_UJI: Pemohon[] = [
  { nama: "Pemohon A (kaya, ML keliru)", pendapatan_bulanan: 75_000_000, jumlah_tanggungan: 1, kondisi_kesehatan_kronis: false, skor_kelayakan_ml: 99 },
  { nama: "Pemohon B (miskin, kronis, lajang)", pendapatan_bulanan: 150_000, jumlah_tanggungan: 0, kondisi_kesehatan_kronis: true, skor_kelayakan_ml: 10 },
  { nama: "Pemohon C (5 anak)", pendapatan_bulanan: 3_000_000, jumlah_tanggungan: 5, kondisi_kesehatan_kronis: false, skor_kelayakan_ml: 45 },
  { nama: "Pemohon D", pendapatan_bulanan: 2_500_000, jumlah_tanggungan: 2, kondisi_kesehatan_kronis: false, skor_kelayakan_ml: 60 },
  { nama: "Pemohon E", pendapatan_bulanan: 4_000_000, jumlah_tanggungan: 1, kondisi_kesehatan_kronis: false, skor_kelayakan_ml: 50 },
];

export const formatRupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
