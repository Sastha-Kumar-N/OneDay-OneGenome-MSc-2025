"use client";

// Map bits
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

import dynamic from "next/dynamic"; // SSR safety
const ForceGraph2D = dynamic<any>(() => import("react-force-graph-2d"), {
  ssr: false,
});

import React, { useMemo, useState, useEffect } from "react";
import {
  Search,
  Database,
  ShieldCheck,
  MapPinned,
  FlaskConical,
  Download,
  Link as LinkIcon,
  Upload,
  RefreshCw,
  FileUp,
  BookOpenText,
  Activity,
  Github,
} from "lucide-react";

// -------------------------------------------------------------
// Bharat Genome – Resource Portal (Single-file React Component)
// -------------------------------------------------------------

// --------------------- MOCK DATA (replace) --------------------
const MOCK_GENOMES = [
  {
    accession: "PGFR00000000",
    organism: "Bordetella bronchiseptica",
    date: "2025-08-11",
    project: "One Day One Genome",
    ncbi: "https://www.ncbi.nlm.nih.gov/nuccore/PGFR00000000",
    amr: ["aac(3)-IIa", "blaOXA-60", "tetA"],
    amrClasses: ["Aminoglycoside", "Beta-lactam", "Tetracycline"],
    bgc: [
      { type: "NRPS", count: 1 },
      { type: "RiPP", count: 2 },
    ],
    state: "West Bengal",
    district: "Kalyani",
    lat: 22.975,
    lon: 88.434,
  },
  {
    accession: "JABC01000001",
    organism: "Klebsiella pneumoniae",
    date: "2025-08-05",
    project: "Hospital Isolates",
    ncbi: "https://www.ncbi.nlm.nih.gov/nuccore/JABC01000001",
    amr: ["blaNDM-1", "marA", "mgrB"],
    amrClasses: ["Carbapenem", "Multidrug-efflux", "Colistin"],
    bgc: [
      { type: "Siderophore", count: 1 },
      { type: "NRPS", count: 1 },
    ],
    state: "Maharashtra",
    district: "Mumbai",
    lat: 19.076,
    lon: 72.8777,
  },
  {
    accession: "QWER02000001",
    organism: "Escherichia coli",
    date: "2025-08-03",
    project: "River Metagenome",
    ncbi: "https://www.ncbi.nlm.nih.gov/nuccore/QWER02000001",
    amr: ["blaCTX-M-15", "sul1", "qnrS1"],
    amrClasses: ["Cephalosporin", "Sulfonamide", "Quinolone"],
    bgc: [{ type: "Bacteriocin", count: 1 }],
    state: "Kerala",
    district: "Thiruvananthapuram",
    lat: 8.5241,
    lon: 76.9366,
  },
  {
    accession: "LMNO03000012",
    organism: "Streptomyces sp.",
    date: "2025-07-30",
    project: "Soil Actinomycetes",
    ncbi: "https://www.ncbi.nlm.nih.gov/nuccore/LMNO03000012",
    amr: ["vanHAX"],
    amrClasses: ["Glycopeptide"],
    bgc: [
      { type: "PKS", count: 2 },
      { type: "NRPS", count: 1 },
    ],
    state: "Gujarat",
    district: "Ahmedabad",
    lat: 23.0225,
    lon: 72.5714,
  },
];

// ---------- Types / constants ----------
const ALLOWED_TABS = [
  "Genomes",
  "AMR",
  "Phylogeography",
  "JBrowse",
  "QC",
  "ETL",
  "Cases",
] as const; // new tabs for teams A/B/F + JBrowse
type TabKey = (typeof ALLOWED_TABS)[number];
type SortKey = "date" | "organism" | "state" | "accession";
type SortDir = "asc" | "desc";

// ----------------------------- Utils -----------------------------
function uniq(arr: string[]) {
  return Array.from(new Set(arr)).sort();
}
function downloadBlob(text: string, filename: string, type = "text/plain") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
function toCSV(rows: any[]) {
  const cols = [
    "accession",
    "organism",
    "date",
    "project",
    "amr",
    "amrClasses",
    "bgc",
    "state",
    "district",
    "lat",
    "lon",
    "ncbi",
  ];
  const lines = [cols.join(",")].concat(
    rows.map((r) =>
      [
        r.accession,
        r.organism,
        r.date,
        r.project,
        (r.amr || []).join("|"),
        (r.amrClasses || []).join("|"),
        (r.bgc || []).map((b: any) => `${b.type}:${b.count}`).join("|"),
        r.state,
        r.district,
        r.lat,
        r.lon,
        r.ncbi,
      ]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(",")
    )
  );
  return lines.join("\n");
}

// ---------------------- Stats + helpers ----------------------
function computeStats(rows: any[]) {
  const totalGenomes = rows.length;
  const today = new Date("2025-08-12");
  const todays = rows.filter(
    (r) => new Date(r.date).toDateString() === today.toDateString()
  );
  const totalAmr = rows.flatMap((r) => r.amr).length;
  const totalBgc = rows.reduce(
    (acc, r) => acc + r.bgc.reduce((a: number, b: any) => a + b.count, 0),
    0
  );
  return { totalGenomes, todays: todays.length, totalAmr, totalBgc };
}
function amrClassCounts(rows: any[]) {
  const map = new Map<string, number>();
  rows.forEach((r) =>
    (r.amrClasses || []).forEach((c: string) =>
      map.set(c, (map.get(c) || 0) + 1)
    )
  );
  return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
}
function bgcTypeCounts(rows: any[]) {
  const map = new Map<string, number>();
  rows.forEach((r) =>
    (r.bgc || []).forEach(({ type, count }: any) =>
      map.set(type, (map.get(type) || 0) + count)
    )
  );
  return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
}
function stateCounts(rows: any[]) {
  const map = new Map<string, number>();
  rows.forEach((r) => map.set(r.state, (map.get(r.state) || 0) + 1));
  return Array.from(map.entries()).map(([state, value]) => ({ state, value }));
}

// AMR graph + novelty (Team C)
function buildAmrGraph(
  rows: any[],
  mode: "genes" | "classes",
  minShared: number
) {
  const orgToItems = new Map<string, Set<string>>();
  rows.forEach((r) => {
    const items = mode === "genes" ? r.amr || [] : r.amrClasses || [];
    const key = r.organism;
    if (!orgToItems.has(key)) orgToItems.set(key, new Set<string>());
    items.forEach((it: string) => orgToItems.get(key)!.add(it));
  });

  const orgs = Array.from(orgToItems.keys());
  const nodes = orgs.map((o) => ({
    id: o,
    name: o,
    val: orgToItems.get(o)?.size || 1,
  }));

  const links: any[] = [];
  for (let i = 0; i < orgs.length; i++) {
    for (let j = i + 1; j < orgs.length; j++) {
      const A = orgToItems.get(orgs[i])!;
      const B = orgToItems.get(orgs[j])!;
      const shared: string[] = [];
      A.forEach((x) => {
        if (B.has(x)) shared.push(x);
      });
      if (shared.length >= minShared) {
        links.push({
          source: orgs[i],
          target: orgs[j],
          value: shared.length,
          shared,
        });
      }
    }
  }
  return { nodes, links };
}
function computeNovelty(rows: any[]) {
  // rarity-based score: sum(1/freq) over AMR genes + BGC types
  const geneFreq = new Map<string, number>();
  const bgcFreq = new Map<string, number>();
  rows.forEach((r) =>
    (r.amr || []).forEach((g: string) =>
      geneFreq.set(g, (geneFreq.get(g) || 0) + 1)
    )
  );
  rows.forEach((r) =>
    (r.bgc || []).forEach((b: any) =>
      bgcFreq.set(b.type, (bgcFreq.get(b.type) || 0) + b.count)
    )
  );
  return rows
    .map((r) => {
      const gScore = (r.amr || []).reduce(
        (s: number, g: string) => s + 1 / (geneFreq.get(g) || 1),
        0
      );
      const bScore = (r.bgc || []).reduce(
        (s: number, b: any) => s + b.count / (bgcFreq.get(b.type) || b.count),
        0
      );
      return {
        acc: r.accession,
        organism: r.organism,
        score: +(gScore + bScore).toFixed(3),
      };
    })
    .sort((a, b) => b.score - a.score);
}

// ------------------------- UI PARTS (violet theme) --------------------------
function ThemeToggle() {
  const [dark, setDark] = React.useState(true);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  return (
    <button
      onClick={() => setDark((d) => !d)}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-violet-500/30 bg-white/5 text-white hover:bg-white/[0.08] transition"
      title="Toggle theme"
    >
      {dark ? "🌙" : "☀️"} Theme
    </button>
  );
}

function Section({ title, subtitle, children, icon: Icon }: any) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-6 shadow-[0_0_0_1px_rgba(139,92,246,.25),0_10px_30px_-10px_rgba(139,92,246,.4)]">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-violet-500/15 border border-violet-400/20">
          <Icon className="w-5 h-5 text-violet-300" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {subtitle && <p className="text-sm text-zinc-400">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function StatCard({ icon: Icon, label, value, note }: any) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_0_0_1px_rgba(139,92,246,.2),0_10px_30px_-10px_rgba(139,92,246,.35)] hover:border-violet-400/25 transition">
      <div className="flex items-start gap-4">
        <div className="p-2 rounded-xl bg-violet-500/15 border border-violet-400/20">
          <ShieldCheck className="hidden" />
          <Icon className="w-5 h-5 text-violet-300" />
        </div>
        <div className="flex-1">
          <div className="text-sm text-zinc-400">{label}</div>
          <div className="text-2xl font-bold tracking-tight text-white">
            {value}
          </div>
          {note && <div className="text-xs text-zinc-500 mt-1">{note}</div>}
        </div>
      </div>
    </div>
  );
}

function Badge({ children }: any) {
  return (
    <span className="px-2 py-0.5 text-xs rounded-full bg-white/[0.06] text-zinc-200 border border-white/10">
      {children}
    </span>
  );
}

function Pill({ children }: any) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-violet-500/10 text-violet-200 border border-violet-400/20">
      {children}
    </span>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  return (
    <span
      className={`ml-1 inline-block text-[11px] leading-none transition ${
        active ? "opacity-100" : "opacity-30"
      }`}
    >
      {dir === "asc" ? "▲" : "▼"}
    </span>
  );
}

function Table({
  rows,
  sortKey,
  sortDir,
  onSort,
}: {
  rows: any[];
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  const HeaderBtn = ({
    k,
    children,
  }: {
    k: SortKey;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      className="inline-flex items-center gap-1 hover:underline"
      onClick={() => onSort(k)}
      title="Sort"
    >
      {children}
      <SortIcon active={sortKey === k} dir={sortKey === k ? sortDir : "asc"} />
    </button>
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-sm">
        <thead className="text-left text-zinc-400 bg-white/[0.04]">
          <tr>
            <th className="py-2 pr-4">
              <HeaderBtn k="accession">Accession</HeaderBtn>
            </th>
            <th className="py-2 pr-4">
              <HeaderBtn k="organism">Organism</HeaderBtn>
            </th>
            <th className="py-2 pr-4">
              <HeaderBtn k="date">Date</HeaderBtn>
            </th>
            <th className="py-2 pr-4">Project</th>
            <th className="py-2 pr-4">AMR</th>
            <th className="py-2 pr-4">BGC</th>
            <th className="py-2 pr-4">
              <HeaderBtn k="state">Location</HeaderBtn>
            </th>
            <th className="py-2 pr-4">NCBI</th>
          </tr>
        </thead>
        <tbody className="[&>tr]:border-t [&>tr]:border-white/10">
          {rows.map((r) => (
            <tr key={r.accession}>
              <td className="py-2 pr-4 font-mono text-xs text-zinc-200">
                {r.accession}
              </td>
              <td className="py-2 pr-4">{r.organism}</td>
              <td className="py-2 pr-4">{r.date}</td>
              <td className="py-2 pr-4">
                <Badge>{r.project}</Badge>
              </td>
              <td className="py-2 pr-4">
                <div className="flex flex-wrap gap-1">
                  {(r.amr || []).map((g: string) => (
                    <Pill key={g}>{g}</Pill>
                  ))}
                </div>
              </td>
              <td className="py-2 pr-4">
                <div className="flex flex-wrap gap-1">
                  {(r.bgc || []).map((b: any) => (
                    <Pill key={b.type}>
                      {b.type}×{b.count}
                    </Pill>
                  ))}
                </div>
              </td>
              <td className="py-2 pr-4">
                {r.district}, {r.state}
              </td>
              <td className="py-2 pr-4">
                <a
                  className="inline-flex items-center gap-1 text-violet-300 hover:underline"
                  href={r.ncbi}
                  target="_blank"
                  rel="noreferrer"
                >
                  <LinkIcon className="w-4 h-4" /> Open
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Empty({ label }: any) {
  return (
    <div className="text-center py-16 text-zinc-400">
      <div className="mx-auto w-14 h-14 rounded-2xl bg-white/[0.06] grid place-items-center mb-3">
        <Database className="w-6 h-6 text-violet-300" />
      </div>
      <div className="font-medium">{label}</div>
      <div className="text-sm">No data to display yet.</div>
    </div>
  );
}

function FitMapToPoints({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds.pad(0.2));
  }, [points, map]);
  return null;
}

// Simple modal
function Modal({
  open,
  onClose,
  children,
  title,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-zinc-300 hover:text-white">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ------------------------- MAIN VIEW -------------------------
export function BharatGenomeResourcePortal() {
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("All States");
  const [tab, setTab] = useState<TabKey>("Genomes");
  const [amrClassFilter, setAmrClassFilter] = useState("All AMR classes");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [amrGraphMode, setAmrGraphMode] = useState<"classes" | "genes">(
    "classes"
  );
  const [minShared, setMinShared] = useState<number>(1);

  // Admin / student upload
  const [admin, setAdmin] = useState(false);
  const [uOpen, setUOpen] = useState(false);
  const [uFiles, setUFiles] = useState<File[]>([]);
  const [uMessage, setUMessage] = useState<string>("");

  // Filtering + sorting -> rows
  const rows = useMemo(() => {
    const byState = MOCK_GENOMES.filter((r) =>
      stateFilter === "All States" ? true : r.state === stateFilter
    );

    const byAmrClass = byState.filter((r) =>
      amrClassFilter === "All AMR classes"
        ? true
        : (r.amrClasses || []).includes(amrClassFilter)
    );

    const byQuery = byAmrClass.filter((r) => {
      if (!query.trim()) return true;
      const hay = `${r.accession} ${r.organism} ${r.project} ${(
        r.amr || []
      ).join(" ")} ${(r.bgc || []).map((b) => b.type).join(" ")} ${r.state} ${
        r.district
      }`.toLowerCase();
      return hay.includes(query.toLowerCase());
    });

    const sorted = [...byQuery].sort((a, b) => {
      const mult = sortDir === "asc" ? 1 : -1;
      if (sortKey === "date")
        return mult * (new Date(a.date).valueOf() - new Date(b.date).valueOf());
      const av = String(a[sortKey] ?? "");
      const bv = String(b[sortKey] ?? "");
      return mult * av.localeCompare(bv);
    });

    return sorted;
  }, [query, stateFilter, amrClassFilter, sortKey, sortDir]);

  // Derived
  const amrGraph = useMemo(
    () =>
      buildAmrGraph(rows, amrGraphMode, Math.max(1, Number(minShared) || 1)),
    [rows, amrGraphMode, minShared]
  );
  const novelty = useMemo(() => computeNovelty(rows), [rows]);

  const stats = useMemo(() => computeStats(MOCK_GENOMES), []);
  const amrData = useMemo(() => amrClassCounts(rows), [rows]);
  const bgcData = useMemo(() => bgcTypeCounts(rows), [rows]);
  const geoData = useMemo(() => stateCounts(rows), [rows]);

  // Sorting handler
  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  // URL sync + admin flag
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    const q = p.get("q");
    if (q) setQuery(q);
    const st = p.get("state");
    if (st) setStateFilter(st);
    const amrc = p.get("amr_class");
    if (amrc) setAmrClassFilter(amrc);
    const tb = p.get("tab") as TabKey | null;
    if (tb && (ALLOWED_TABS as readonly string[]).includes(tb)) setTab(tb);
    const sk = p.get("sort") as SortKey | null;
    if (sk) setSortKey(sk);
    const sd = p.get("dir") as SortDir | null;
    if (sd) setSortDir(sd);
    setAdmin(p.get("admin") === "1"); // show student upload if ?admin=1
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams();
    if (query) p.set("q", query);
    if (stateFilter !== "All States") p.set("state", stateFilter);
    if (amrClassFilter !== "All AMR classes")
      p.set("amr_class", amrClassFilter);
    if (tab !== "Genomes") p.set("tab", tab);
    if (sortKey !== "date" || sortDir !== "desc") {
      p.set("sort", sortKey);
      p.set("dir", sortDir);
    }
    if (admin) p.set("admin", "1");
    const s = p.toString();
    window.history.replaceState(
      null,
      "",
      s ? `?${s}` : window.location.pathname
    );
  }, [query, stateFilter, amrClassFilter, tab, sortKey, sortDir, admin]);

  // ----- Upload handlers (Team A students) -----
  async function handleStudentUpload() {
    if (!uFiles.length) {
      setUMessage("Please choose at least one file.");
      return;
    }
    try {
      const fd = new FormData();
      uFiles.forEach((f) => fd.append("files", f));
      // Backend endpoint to implement by Team E: POST /api/ingest
      const res = await fetch("/api/ingest", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      setUMessage("Uploaded! ETL will pick this up for validation.");
      setUFiles([]);
    } catch (e: any) {
      setUMessage(`Error: ${e.message}`);
    }
  }

  return (
    <main className="min-h-screen text-white bg-transparent selection:bg-violet-500/30">
      {/* background deco */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(1200px 600px at 90% -10%, rgba(139,92,246,.25), transparent 60%), radial-gradient(800px 400px at 10% 0%, rgba(139,92,246,.15), transparent 55%), #0b0b10",
          }}
        />
      </div>

      {/* Header */}
      <header className="max-w-7xl mx-auto px-6 pt-10 pb-6">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
                Harmonized Microbial Genomes Atlas of One Day One Genome Project
              </h1>
              <p className="text-zinc-400 text-sm mt-1">
                Powered by Bharat Genome Database ODOG-aligned
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {admin && (
              <button
                onClick={() => setUOpen(true)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-violet-500/30 bg-white/5 hover:bg-white/[0.08]"
                title="Student Upload"
              >
                <FileUp className="w-4 h-4" />
                Student Upload
              </button>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Quick Stats */}
      <section className="max-w-7xl mx-auto px-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Database}
          label="Total Genomes"
          value={stats.totalGenomes}
        />
        <StatCard
          icon={ShieldCheck}
          label="Total AMR Markers"
          value={stats.totalAmr}
        />
        <StatCard
          icon={FlaskConical}
          label="Total BGC Loci"
          value={stats.totalBgc}
        />
        <StatCard
          icon={MapPinned}
          label="States Covered"
          value={uniq(MOCK_GENOMES.map((r) => r.state)).length}
          note="Growing daily"
        />
      </section>

      {/* Controls */}
      <section className="max-w-7xl mx-auto px-6 mt-6 flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
          <input
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 ring-1 ring-white/10 outline-none focus:ring-violet-400/60"
            placeholder="Search accession, organism, AMR, BGC, state…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* State */}
        <select
          className="md:w-64 px-3 py-2 rounded-xl bg-white/5 ring-1 ring-white/10"
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
        >
          {["All States", ...uniq(MOCK_GENOMES.map((r) => r.state))].map(
            (s) => (
              <option key={s}>{s}</option>
            )
          )}
        </select>

        {/* AMR Class */}
        <select
          className="md:w-64 px-3 py-2 rounded-xl bg-white/5 ring-1 ring-white/10"
          value={amrClassFilter}
          onChange={(e) => setAmrClassFilter(e.target.value)}
        >
          {[
            "All AMR classes",
            ...uniq(MOCK_GENOMES.flatMap((r) => r.amrClasses || [])),
          ].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </section>

      {/* Tabs */}
      <section className="max-w-7xl mx-auto px-6 mt-6">
        <div className="flex gap-1 flex-wrap border-b border-white/10">
          {ALLOWED_TABS.map((t) => {
            const active = tab === t;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`relative px-3 py-2 text-sm transition ${
                  active ? "text-white" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {t}
                <span
                  className={`absolute left-0 right-0 -bottom-px h-0.5 bg-violet-500 transition-transform ${
                    active ? "scale-x-100" : "scale-x-0"
                  } origin-left`}
                />
              </button>
            );
          })}
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 mt-4 grid grid-cols-1 lg:grid-cols-3 gap-6 pb-16">
        {/* Left: main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Genomes */}
          {tab === "Genomes" && (
            <Section
              icon={Database}
              title="Genomes"
              subtitle="Harmonized metadata of Indian microbial genomes."
            >
              {rows.length ? (
                <Table
                  rows={rows}
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />
              ) : (
                <Empty label="No genomes match your filters" />
              )}
            </Section>
          )}

          {/* AMR (Team C) */}
          {tab === "AMR" && (
            <Section
              icon={ShieldCheck}
              title="Antimicrobial Resistance (AMR)"
              subtitle="Organism-to-organism semantic graph by shared resistance + novelty."
            >
              {rows.length ? (
                <div className="space-y-4">
                  {/* Graph controls */}
                  <div className="flex flex-col md:flex-row gap-3 md:items-center">
                    <div className="text-sm text-zinc-400">
                      {rows.length} genomes · linking organisms that share{" "}
                      <span className="font-medium text-zinc-200">
                        {amrGraphMode === "genes" ? "AMR genes" : "AMR classes"}
                      </span>
                      .
                    </div>

                    <div className="flex gap-3 md:ml-auto">
                      <label className="inline-flex items-center gap-2 text-sm">
                        <span>Mode</span>
                        <select
                          className="px-2 py-1 rounded-lg bg-white/5 ring-1 ring-white/10"
                          value={amrGraphMode}
                          onChange={(e) =>
                            setAmrGraphMode(
                              e.target.value as "genes" | "classes"
                            )
                          }
                        >
                          <option value="classes">AMR classes</option>
                          <option value="genes">AMR genes</option>
                        </select>
                      </label>

                      <label className="inline-flex items-center gap-2 text-sm">
                        <span>Min shared</span>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={minShared}
                          onChange={(e) =>
                            setMinShared(parseInt(e.target.value || "1", 10))
                          }
                          className="w-20 px-2 py-1 rounded-lg bg-white/5 ring-1 ring-white/10"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Graph */}
                  <div className="h-96 rounded-2xl overflow-hidden border border-white/10 bg-white/[0.04]">
                    {amrGraph.nodes.length > 0 ? (
                      <ForceGraph2D
                        graphData={amrGraph as any}
                        nodeRelSize={4}
                        nodeLabel={(n: any) => `${n.id}\nmarkers: ${n.val}`}
                        linkLabel={(l: any) =>
                          `${l.source.id || l.source} ↔ ${
                            l.target.id || l.target
                          }\nshared: ${(l.shared || []).join(", ") || l.value}`
                        }
                        linkDirectionalParticles={2}
                        linkDirectionalParticleWidth={(l: any) =>
                          Math.min(6, l.value || 1)
                        }
                        linkWidth={(l: any) => Math.min(4, 1 + (l.value || 1))}
                        nodeCanvasObject={(
                          node: any,
                          ctx: CanvasRenderingContext2D,
                          scale: number
                        ) => {
                          const label = node.id;
                          const size = 6 + Math.log2((node.val || 1) + 1) * 4;
                          ctx.beginPath();
                          ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
                          ctx.fillStyle = "#8b5cf6"; // violet
                          ctx.fill();
                          const fontSize = Math.max(8, 12 / scale);
                          ctx.font = `${fontSize}px sans-serif`;
                          ctx.fillStyle = "#e5e7eb"; // zinc-200
                          ctx.fillText(label, node.x + size + 3, node.y + 3);
                        }}
                        cooldownTicks={80}
                      />
                    ) : (
                      <div className="h-full grid place-items-center text-sm text-zinc-400">
                        No links at this threshold. Lower “Min shared”.
                      </div>
                    )}
                  </div>

                  {/* Novelty & chips */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="rounded-2xl bg-white/[0.04] p-4 border border-white/10">
                      <div className="font-medium mb-2">
                        Top novelty (AMR+BGC rarity)
                      </div>
                      <ul className="space-y-2 text-sm">
                        {novelty.slice(0, 6).map((n) => (
                          <li key={n.acc} className="flex justify-between">
                            <span className="truncate pr-3">
                              {n.organism} — {n.acc}
                            </span>
                            <Badge>{n.score}</Badge>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-2xl bg-white/[0.04] p-4 border border-white/10">
                      <div className="font-medium mb-2">
                        Recent{" "}
                        {amrGraphMode === "genes" ? "AMR genes" : "AMR classes"}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {uniq(
                          amrGraphMode === "genes"
                            ? rows.flatMap((r) => r.amr || [])
                            : rows.flatMap((r) => r.amrClasses || [])
                        ).map((g) => (
                          <Pill key={g}>{g}</Pill>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <Empty label="No AMR data for current filters" />
              )}
            </Section>
          )}

          {/* Phylogeography */}
          {tab === "Phylogeography" && (
            <Section
              icon={MapPinned}
              title="Phylogeography"
              subtitle="Map view of current results."
            >
              {rows.length ? (
                <div className="space-y-4">
                  <div className="h-80 rounded-2xl overflow-hidden border border-white/10">
                    <MapContainer
                      center={[22.5, 79]}
                      zoom={5}
                      scrollWheelZoom={false}
                      style={{ height: "100%", width: "100%" }}
                    >
                      <TileLayer
                        attribution="&copy; OpenStreetMap contributors"
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <FitMapToPoints
                        points={
                          rows.map((r) => [r.lat, r.lon]) as [number, number][]
                        }
                      />
                      {rows.map((r) => (
                        <CircleMarker
                          key={r.accession}
                          center={[r.lat, r.lon]}
                          radius={6}
                          pathOptions={{ color: "#8b5cf6", fillOpacity: 0.6 }}
                        >
                          <Popup>
                            <div className="text-sm text-zinc-900">
                              <div className="font-medium">{r.organism}</div>
                              <div>Accession: {r.accession}</div>
                              <div>
                                {r.district}, {r.state}
                              </div>
                              <a
                                className="text-violet-700 underline"
                                href={r.ncbi}
                                target="_blank"
                                rel="noreferrer"
                              >
                                View in NCBI
                              </a>
                            </div>
                          </Popup>
                        </CircleMarker>
                      ))}
                    </MapContainer>
                  </div>
                  <div className="text-xs text-zinc-400">
                    Tip: markers reflect the currently filtered rows. Use the
                    search box and state filter above to update the map.
                  </div>
                </div>
              ) : (
                <Empty label="No records for current filters" />
              )}
            </Section>
          )}

          {/* JBrowse (embed now; swap to your instance later) */}
          {tab === "JBrowse" && (
            <Section
              icon={BookOpenText}
              title="Genome Browser (JBrowse)"
              subtitle="Lightweight embed; point to your configured JBrowse session."
            >
              {rows.length ? (
                <div className="space-y-3">
                  <div className="text-sm text-zinc-400">
                    Pick an accession to open in your JBrowse instance
                    (configure the iframe URL to your backend). For demo, this
                    uses a placeholder.
                  </div>
                  <JBrowseEmbed rows={rows} />
                </div>
              ) : (
                <Empty label="No records to browse" />
              )}
            </Section>
          )}

          {/* QC (Team B) */}
          {tab === "QC" && (
            <Section
              icon={Activity}
              title="QC & Re-annotation"
              subtitle="Uniform GFF/GBK/FAA artifacts + assembly metrics."
            >
              {rows.length ? (
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    {rows.map((r) => (
                      <div
                        key={r.accession}
                        className="rounded-2xl border border-white/10 p-4 bg-white/[0.04]"
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{r.organism}</div>
                          <Badge>{r.accession}</Badge>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                          <div className="text-zinc-400">N50</div>
                          <div>—</div>
                          <div className="text-zinc-400">GC%</div>
                          <div>—</div>
                          <div className="text-zinc-400"># Contigs</div>
                          <div>—</div>
                          <div className="text-zinc-400">BUSCO</div>
                          <div>—</div>
                        </div>
                        <div className="mt-3 flex gap-2 flex-wrap">
                          <a
                            className="underline text-violet-300"
                            href={`/api/artifacts/gff?acc=${r.accession}`}
                          >
                            GFF
                          </a>
                          <a
                            className="underline text-violet-300"
                            href={`/api/artifacts/gbk?acc=${r.accession}`}
                          >
                            GBK
                          </a>
                          <a
                            className="underline text-violet-300"
                            href={`/api/artifacts/faa?acc=${r.accession}`}
                          >
                            FAA
                          </a>
                          <a
                            className="underline text-violet-300"
                            href={`/api/artifacts/qc?acc=${r.accession}`}
                          >
                            QC JSON
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-zinc-400">
                    Team B endpoint examples to implement:{" "}
                    <code>/api/artifacts/*</code>
                    returning signed URLs or files. Populate metrics above from
                    your QC JSON.
                  </div>
                </div>
              ) : (
                <Empty label="No QC artifacts yet" />
              )}
            </Section>
          )}

          {/* ETL Monitor (Team A) */}
          {tab === "ETL" && (
            <Section
              icon={RefreshCw}
              title="ETL & Metadata Monitor"
              subtitle="Scraper status, MIxS validation, accession resolver."
            >
              <div className="grid md:grid-cols-3 gap-4">
                <InfoCard k="Last run" v="—" />
                <InfoCard k="New entries today" v="—" />
                <InfoCard k="MIxS validation errors" v="—" />
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 p-4 bg-white/[0.04]">
                <div className="text-sm text-zinc-400 mb-2">
                  Trigger a manual scrape (stub; implement POST{" "}
                  <code>/api/etl/run</code>)
                </div>
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch("/api/etl/run", {
                        method: "POST",
                      });
                      if (!res.ok) throw new Error("Failed");
                      alert("Triggered ETL run!");
                    } catch {
                      alert("This is a stub. Implement /api/etl/run");
                    }
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white hover:bg-violet-500"
                >
                  <RefreshCw className="w-4 h-4" /> Run now
                </button>
                <a
                  className="ml-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 hover:bg-white/[0.06]"
                  href="https://nibmg.ac.in"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Github className="w-4 h-4" /> nibmg.ac.in
                </a>
              </div>

              <div className="mt-4 text-xs text-zinc-400">
                Team A endpoints: <code>GET /api/etl/status</code>,{" "}
                <code>POST /api/etl/run</code>, <code>GET /api/etl/errors</code>
                . MIxS validator: <code>POST /api/etl/validate</code>.
              </div>
            </Section>
          )}

          {/* Case Studies (Team F) */}
          {tab === "Cases" && (
            <Section
              icon={BookOpenText}
              title="Case Studies & Writing"
              subtitle="Curation, figures, and paper prep."
            >
              <div className="space-y-4">
                <CaseCard
                  title="Bordetella bronchiseptica PGFR00000000"
                  body="AMR set includes aac(3)-IIa, blaOXA-60, tetA; see ODOG daily context. Link out to JBrowse and QC."
                  links={[
                    {
                      label: "NCBI",
                      href: "https://www.ncbi.nlm.nih.gov/nuccore/PGFR00000000",
                    },
                    { label: "QC", href: "/api/artifacts/qc?acc=PGFR00000000" },
                  ]}
                />
                <CaseCard
                  title="Aeromonas caviae INS0005101"
                  body="Resolve accession → harmonize MIxS; preliminary AMR screen; local riverine sampling context."
                  links={[
                    { label: "Project page", href: "https://nibmg.ac.in" },
                  ]}
                />
                <div className="text-xs text-zinc-400">
                  Team F endpoint for Markdown cases:{" "}
                  <code>GET /api/cases</code> (list) and{" "}
                  <code>GET /api/cases/{`{id}`}</code> (markdown/HTML).
                </div>
              </div>
            </Section>
          )}
        </div>

        {/* Right: analytics/help */}
        <div className="space-y-6">
          <Section
            icon={Database}
            title="Download"
            subtitle="Get current view as JSON/CSV."
          >
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  const blob = new Blob([JSON.stringify(rows, null, 2)], {
                    type: "application/json",
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "bharatgenome_view.json";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white hover:bg-violet-500"
              >
                <Download className="w-4 h-4" /> JSON
              </button>
              <button
                onClick={() =>
                  downloadBlob(toCSV(rows), "bharatgenome_view.csv", "text/csv")
                }
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white text-zinc-900 hover:opacity-90"
              >
                <Download className="w-4 h-4" /> CSV
              </button>
            </div>
          </Section>

          <Section icon={FlaskConical} title="BGC Types (filtered)">
            {bgcData.length ? (
              <ul className="space-y-2 text-sm">
                {bgcData.map((d) => (
                  <li
                    key={d.name}
                    className="flex items-center justify-between"
                  >
                    <span className="truncate pr-3">{d.name}</span>
                    <Badge>{d.value}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty label="No BGC types" />
            )}
          </Section>

          <Section icon={MapPinned} title="Coverage by State (filtered)">
            {geoData.length ? (
              <ul className="space-y-2 text-sm">
                {geoData.map((d) => (
                  <li
                    key={d.state}
                    className="flex items-center justify-between"
                  >
                    <span className="truncate pr-3">{d.state}</span>
                    <Badge>{d.value}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty label="No states" />
            )}
          </Section>
        </div>
      </div>

      {/* Student Upload Modal (admin only) */}
      <Modal
        open={uOpen}
        onClose={() => setUOpen(false)}
        title="Student Upload Wizard"
      >
        <div className="text-sm text-zinc-300">
          Upload <b>CSV/TSV</b> (metadata in MIxS-like schema) and/or{" "}
          <b>JSON</b> (QC/AMR/BGC results). Team A will validate and queue ETL.
          Use the provided templates.
        </div>
        <div className="mt-3">
          <input
            multiple
            type="file"
            accept=".csv,.tsv,.json"
            onChange={(e) => setUFiles(Array.from(e.target.files || []))}
            className="block w-full text-sm file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-violet-600 file:text-white file:hover:bg-violet-500"
          />
          <div className="text-xs text-zinc-400 mt-2">
            API: <code>POST /api/ingest</code> → returns{" "}
            <code>{`{ jobId }`}</code>. Then Team A ETL moves data → Postgres &
            object storage.
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={handleStudentUpload}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white hover:bg-violet-500"
          >
            <Upload className="w-4 h-4" /> Upload
          </button>
          <button
            onClick={() =>
              downloadBlob(
                `accession,organism,date,project,amr,amrClasses,bgc,state,district,lat,lon,ncbi
PGFR00000000,Bordetella bronchiseptica,2025-08-11,One Day One Genome,"aac(3)-IIa|blaOXA-60|tetA","Aminoglycoside|Beta-lactam|Tetracycline","NRPS:1|RiPP:2",West Bengal,Kalyani,22.975,88.434,https://www.ncbi.nlm.nih.gov/nuccore/PGFR00000000`,
                "template_metadata.csv",
                "text/csv"
              )
            }
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 hover:bg-white/[0.06]"
          >
            Download CSV template
          </button>
        </div>
        {!!uMessage && <div className="mt-3 text-sm">{uMessage}</div>}
      </Modal>

      {/* Footer */}
      <footer className="border-t border-white/10 py-10 text-center text-sm text-zinc-400">
        Built by Bharat Genome Database · BRIC–NIBMG aligned · v0.3
        (Teams-ready)
      </footer>
    </main>
  );
}

// ---------- Small helper components ----------
function InfoCard({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-2xl border border-white/10 p-4 bg-white/[0.04]">
      <div className="text-sm text-zinc-400">{k}</div>
      <div className="text-xl font-semibold text-white">{v}</div>
    </div>
  );
}
function CaseCard({
  title,
  body,
  links,
}: {
  title: string;
  body: string;
  links?: { label: string; href: string }[];
}) {
  return (
    <div className="rounded-2xl border border-white/10 p-4 bg-white/[0.04]">
      <div className="font-medium">{title}</div>
      <p className="text-sm text-zinc-300 mt-1">{body}</p>
      {!!links?.length && (
        <div className="mt-3 flex gap-3 flex-wrap">
          {links.map((l) => (
            <a
              key={l.href}
              className="underline text-violet-300"
              href={l.href}
              target="_blank"
              rel="noreferrer"
            >
              {l.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// Lightweight JBrowse iframe embed
function JBrowseEmbed({ rows }: { rows: any[] }) {
  const [acc, setAcc] = useState(rows[0]?.accession ?? "");
  const selected = rows.find((r) => r.accession === acc);
  // Point this to your hosted JBrowse instance/session config
  const url = selected
    ? `/jbrowse/?assembly=${encodeURIComponent(
        selected.organism
      )}&loc=chr1:1-50000&acc=${encodeURIComponent(selected.accession)}`
    : "/jbrowse/";
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <select
          className="px-3 py-2 rounded-xl bg-white/5 ring-1 ring-white/10"
          value={acc}
          onChange={(e) => setAcc(e.target.value)}
        >
          {rows.map((r) => (
            <option key={r.accession} value={r.accession}>
              {r.organism} — {r.accession}
            </option>
          ))}
        </select>
        <a
          className="text-violet-300 underline"
          href={url}
          target="_blank"
          rel="noreferrer"
        >
          Open in new tab
        </a>
      </div>
      <div className="h-[520px] rounded-2xl overflow-hidden border border-white/10 bg-white/[0.04]">
        <iframe src={url} className="w-full h-full" loading="lazy" />
      </div>
      <div className="text-xs text-zinc-400">
        Backend idea: <code>GET /api/jbrowse/session?acc=...</code> → returns a
        JBrowse session JSON with tracks (FASTA, GFF, BAM/CRAM, BigWig).
      </div>
    </div>
  );
}

export default function Page() {
  return <BharatGenomeResourcePortal />;
}
