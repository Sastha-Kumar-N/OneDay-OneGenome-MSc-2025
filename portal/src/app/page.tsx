"use client";

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
import Link from "next/link";
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
  Users,
  Menu,
  X,
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
] as const;
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

// AMR graph + novelty
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

// ------------------------- UI PARTS (light violet theme) --------------------------
function Section({ title, subtitle, children, icon: Icon }: any) {
  return (
    <section className="rounded-3xl border border-[#d0d9f5] bg-white p-6 shadow-md">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-[#e4effe] border border-transparent">
          <Icon className="w-5 h-5 text-[#5d2ab7]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[#111111]">{title}</h2>
          {subtitle && (
            <p className="text-sm text-gray-600 leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

function StatCard({ icon: Icon, label, value, note }: any) {
  return (
    <div className="rounded-2xl border border-[#d0d9f5] bg-white p-5 shadow-sm hover:shadow-md transition">
      <div className="flex items-start gap-4">
        <div className="p-2 rounded-xl bg-[#e4effe]">
          <ShieldCheck className="hidden" />
          <Icon className="w-5 h-5 text-[#5d2ab7]" />
        </div>
        <div className="flex-1">
          <div className="text-xs font-medium tracking-wide text-gray-500 uppercase">
            {label}
          </div>
          <div className="text-2xl font-bold tracking-tight text-[#111111] mt-1">
            {value}
          </div>
          {note && (
            <div className="text-xs text-gray-500 mt-1 leading-relaxed">
              {note}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Badge({ children }: any) {
  return (
    <span className="px-2 py-0.5 text-xs rounded-full bg-[#e4effe] text-[#111111]">
      {children}
    </span>
  );
}

function Pill({ children }: any) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-[#5d2ab7]/10 text-[#5d2ab7] border border-[#5d2ab7]/40">
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
      className="inline-flex items-center gap-1 hover:text-[#5d2ab7] transition text-sm font-medium"
      onClick={() => onSort(k)}
      title="Sort"
    >
      {children}
      <SortIcon active={sortKey === k} dir={sortKey === k ? sortDir : "asc"} />
    </button>
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-[#d0d9f5]">
      <table className="w-full text-sm">
        <thead className="text-left text-gray-600 bg-[#e4effe]">
          <tr>
            <th className="py-2 pr-4 pl-3">
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
        <tbody className="[&>tr]:border-t [&>tr]:border-[#eef1ff] bg-white">
          {rows.map((r) => (
            <tr key={r.accession} className="hover:bg-[#f5f6ff]">
              <td className="py-2 pr-4 pl-3 font-mono text-xs text-gray-800">
                {r.accession}
              </td>
              <td className="py-2 pr-4 text-[#111111]">{r.organism}</td>
              <td className="py-2 pr-4 text-gray-700">{r.date}</td>
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
              <td className="py-2 pr-4 text-gray-700">
                {r.district}, {r.state}
              </td>
              <td className="py-2 pr-4">
                <a
                  className="inline-flex items-center gap-1 text-[#5d2ab7] hover:underline"
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
    <div className="text-center py-16 text-gray-500">
      <div className="mx-auto w-14 h-14 rounded-2xl bg-[#e4effe] grid place-items-center mb-3">
        <Database className="w-6 h-6 text-[#5d2ab7]" />
      </div>
      <div className="font-medium text-[#111111] mb-1">{label}</div>
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-[#d0d9f5] bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-[#111111]">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-[#111111]"
          >
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

  // Navbar (mobile)
  const [navOpen, setNavOpen] = useState(false);

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

  // ----- Upload handlers -----
  async function handleStudentUpload() {
    if (!uFiles.length) {
      setUMessage("Please choose at least one file.");
      return;
    }
    try {
      const fd = new FormData();
      uFiles.forEach((f) => fd.append("files", f));
      const res = await fetch("/api/ingest", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      setUMessage("Uploaded! ETL will pick this up for validation.");
      setUFiles([]);
    } catch (e: any) {
      setUMessage(`Error: ${e.message}`);
    }
  }

  return (
    <main className="min-h-screen bg-[#e4effe] text-[#111111] selection:bg-[#5d2ab7]/20">
      {/* NAVBAR */}
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-[#d0d9f5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Left: logo + name */}
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-2">
                {/* Update src to your actual BGDB logo path */}
                <img
                  src="/BGDB-index-files/Logo/BGDBlogovertical.png"
                  alt="Bharat Genome Database"
                  className="h-9 w-auto"
                />
                <div className="leading-tight">
                  <span className="block text-sm font-semibold tracking-tight">
                    Bharat Genome Database
                  </span>
                  <span className="block text-xs text-gray-500">
                    Harmonized Genome & Microbiome Portal
                  </span>
                </div>
              </Link>
            </div>

            {/* Desktop links */}
            <div className="hidden md:flex items-center gap-6 text-sm font-medium">
              <a
                href="#about"
                className="text-gray-700 hover:text-[#5d2ab7] transition"
              >
                About
              </a>
              <a
                href="#team"
                className="text-gray-700 hover:text-[#5d2ab7] transition"
              >
                Team
              </a>
              <a
                href="#research"
                className="text-gray-700 hover:text-[#5d2ab7] transition"
              >
                Research
              </a>
              <a
                href="#portal"
                className="text-gray-700 hover:text-[#5d2ab7] transition"
              >
                Resource Portal
              </a>
              {admin && (
                <button
                  onClick={() => setUOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#5d2ab7] text-white text-xs font-medium shadow-sm hover:bg-[#4a1f96] transition"
                >
                  <FileUp className="w-4 h-4" />
                  Student Upload
                </button>
              )}
            </div>

            {/* Mobile toggle */}
            <button
              className="md:hidden inline-flex items-center justify-center rounded-md p-2 text-gray-600 hover:text-[#111111] hover:bg-[#e4effe] transition"
              onClick={() => setNavOpen((o) => !o)}
              aria-label="Toggle navigation"
            >
              {navOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {navOpen && (
          <div className="md:hidden border-t border-[#d0d9f5] bg-white">
            <div className="px-4 py-3 space-y-2 text-sm font-medium">
              <a
                href="#about"
                className="block text-gray-700 hover:text-[#5d2ab7] transition"
                onClick={() => setNavOpen(false)}
              >
                About
              </a>
              <a
                href="#team"
                className="block text-gray-700 hover:text-[#5d2ab7] transition"
                onClick={() => setNavOpen(false)}
              >
                Team
              </a>
              <a
                href="#research"
                className="block text-gray-700 hover:text-[#5d2ab7] transition"
                onClick={() => setNavOpen(false)}
              >
                Research
              </a>
              <a
                href="#portal"
                className="block text-gray-700 hover:text-[#5d2ab7] transition"
                onClick={() => setNavOpen(false)}
              >
                Resource Portal
              </a>
              {admin && (
                <button
                  onClick={() => {
                    setNavOpen(false);
                    setUOpen(true);
                  }}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#5d2ab7] text-white text-xs font-medium shadow-sm hover:bg-[#4a1f96] transition"
                >
                  <FileUp className="w-4 h-4" />
                  Student Upload
                </button>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Hero / About */}
      <header
        id="about"
        className="max-w-7xl mx-auto px-6 pt-10 pb-8 flex flex-col lg:flex-row gap-8 items-start lg:items-center"
      >
        <div className="flex-1 space-y-3">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white text-xs font-medium text-[#5d2ab7] border border-[#d0d9f5] shadow-sm">
            <Database className="w-3 h-3" />
            One Day One Genome · Microbial Atlas
          </span>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-semibold tracking-tight text-[#111111]">
            Harmonized Microbial Genomes Atlas for the One Day One Genome
            Initiative
          </h1>
          <p className="text-sm md:text-base text-gray-600 leading-relaxed max-w-2xl">
            Explore curated assemblies, AMR markers, biosynthetic gene clusters
            and phylogeography from Indian microbial genomes, powered by the
            Bharat Genome Database.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <a
              href="#portal"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-[#5d2ab7] text-white text-sm font-medium shadow hover:bg-[#4a1f96] transition"
            >
              <Search className="w-4 h-4" />
              Explore genomes
            </a>
            <a
              href="#research"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-white text-[#111111] text-sm font-medium border border-[#d0d9f5] hover:bg-[#f4f6ff] transition"
            >
              <BookOpenText className="w-4 h-4" />
              View research context
            </a>
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
          note="Expanding across the Indian microbial landscape"
        />
      </section>

      {/* Filters / Controls */}
      <section
        id="portal"
        className="max-w-7xl mx-auto px-6 mt-6 flex flex-col md:flex-row gap-3"
      >
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-[#d0d9f5] outline-none focus:ring-2 focus:ring-[#5d2ab7] focus:border-transparent text-sm"
            placeholder="Search accession, organism, AMR, BGC, state…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* State */}
        <select
          className="md:w-64 px-3 py-2 rounded-xl bg-white border border-[#d0d9f5] text-sm focus:ring-2 focus:ring-[#5d2ab7] focus:border-transparent"
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
          className="md:w-64 px-3 py-2 rounded-xl bg-white border border-[#d0d9f5] text-sm focus:ring-2 focus:ring-[#5d2ab7] focus:border-transparent"
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
        <div className="flex gap-1 flex-wrap border-b border-[#d0d9f5]">
          {ALLOWED_TABS.map((t) => {
            const active = tab === t;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`relative px-3 py-2 text-sm transition font-medium ${
                  active
                    ? "text-[#5d2ab7]"
                    : "text-gray-500 hover:text-[#111111]"
                }`}
              >
                {t}
                <span
                  className={`absolute left-0 right-0 -bottom-[1px] h-0.5 bg-[#5d2ab7] transition-transform ${
                    active ? "scale-x-100" : "scale-x-0"
                  } origin-left`}
                />
              </button>
            );
          })}
        </div>
      </section>

      {/* Main content grid */}
      <div className="max-w-7xl mx-auto px-6 mt-4 grid grid-cols-1 lg:grid-cols-3 gap-6 pb-16">
        {/* Left: main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Genomes */}
          {tab === "Genomes" && (
            <Section
              icon={Database}
              title="Genomes"
              subtitle="Harmonized metadata of Indian microbial genomes from ODOG and related projects."
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

          {/* AMR */}
          {tab === "AMR" && (
            <Section
              icon={ShieldCheck}
              title="Antimicrobial Resistance (AMR)"
              subtitle="Organism-to-organism graph of shared resistance markers, with rarity-driven novelty scores."
            >
              {rows.length ? (
                <div className="space-y-4">
                  {/* Graph controls */}
                  <div className="flex flex-col md:flex-row gap-3 md:items-center">
                    <div className="text-sm text-gray-600">
                      {rows.length} genomes, linking organisms that share{" "}
                      <span className="font-medium text-[#111111]">
                        {amrGraphMode === "genes" ? "AMR genes" : "AMR classes"}
                      </span>
                      .
                    </div>

                    <div className="flex gap-3 md:ml-auto">
                      <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                        <span>Mode</span>
                        <select
                          className="px-2 py-1 rounded-lg bg-white border border-[#d0d9f5] text-xs"
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

                      <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                        <span>Min shared</span>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={minShared}
                          onChange={(e) =>
                            setMinShared(parseInt(e.target.value || "1", 10))
                          }
                          className="w-20 px-2 py-1 rounded-lg bg-white border border-[#d0d9f5] text-xs"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Graph */}
                  <div className="h-96 rounded-2xl overflow-hidden border border-[#d0d9f5] bg-white">
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
                          ctx.fillStyle = "#5d2ab7";
                          ctx.fill();
                          const fontSize = Math.max(8, 12 / scale);
                          ctx.font = `${fontSize}px sans-serif`;
                          ctx.fillStyle = "#111111";
                          ctx.fillText(label, node.x + size + 3, node.y + 3);
                        }}
                        cooldownTicks={80}
                      />
                    ) : (
                      <div className="h-full grid place-items-center text-sm text-gray-500">
                        No links at this threshold. Lower “Min shared”.
                      </div>
                    )}
                  </div>

                  {/* Novelty & chips */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="rounded-2xl bg-white p-4 border border-[#d0d9f5]">
                      <div className="font-medium mb-2 text-[#111111]">
                        Top novelty (AMR + BGC rarity)
                      </div>
                      <ul className="space-y-2 text-sm text-gray-700">
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
                    <div className="rounded-2xl bg-white p-4 border border-[#d0d9f5]">
                      <div className="font-medium mb-2 text-[#111111]">
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
              subtitle="Map view of the filtered genomes across India."
            >
              {rows.length ? (
                <div className="space-y-4">
                  <div className="h-80 rounded-2xl overflow-hidden border border-[#d0d9f5] bg-white">
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
                          pathOptions={{ color: "#5d2ab7", fillOpacity: 0.6 }}
                        >
                          <Popup>
                            <div className="text-sm text-[#111111]">
                              <div className="font-medium">{r.organism}</div>
                              <div>Accession: {r.accession}</div>
                              <div>
                                {r.district}, {r.state}
                              </div>
                              <a
                                className="text-[#5d2ab7] underline"
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
                  <div className="text-xs text-gray-600">
                    Markers reflect the currently filtered rows. Use the search
                    box and state filter above to refine the map.
                  </div>
                </div>
              ) : (
                <Empty label="No records for current filters" />
              )}
            </Section>
          )}

          {/* JBrowse */}
          {tab === "JBrowse" && (
            <Section
              icon={BookOpenText}
              title="Genome Browser (JBrowse)"
              subtitle="Embed your curated JBrowse sessions for genome-scale exploration."
            >
              {rows.length ? (
                <div className="space-y-3">
                  <div className="text-sm text-gray-600">
                    Pick an accession to open in your JBrowse instance (configure
                    the iframe URL in the backend). A placeholder URL is used
                    here for the demo.
                  </div>
                  <JBrowseEmbed rows={rows} />
                </div>
              ) : (
                <Empty label="No records to browse" />
              )}
            </Section>
          )}

          {/* QC */}
          {tab === "QC" && (
            <Section
              icon={Activity}
              title="QC & Re-annotation"
              subtitle="Uniform GFF/GBK/FAA artifacts and assembly metrics."
            >
              {rows.length ? (
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    {rows.map((r) => (
                      <div
                        key={r.accession}
                        className="rounded-2xl border border-[#d0d9f5] p-4 bg-white"
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-[#111111]">
                            {r.organism}
                          </div>
                          <Badge>{r.accession}</Badge>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                          <div className="text-gray-500">N50</div>
                          <div>—</div>
                          <div className="text-gray-500">GC%</div>
                          <div>—</div>
                          <div className="text-gray-500"># Contigs</div>
                          <div>—</div>
                          <div className="text-gray-500">BUSCO</div>
                          <div>—</div>
                        </div>
                        <div className="mt-3 flex gap-2 flex-wrap text-sm">
                          <a
                            className="underline text-[#5d2ab7]"
                            href={`/api/artifacts/gff?acc=${r.accession}`}
                          >
                            GFF
                          </a>
                          <a
                            className="underline text-[#5d2ab7]"
                            href={`/api/artifacts/gbk?acc=${r.accession}`}
                          >
                            GBK
                          </a>
                          <a
                            className="underline text-[#5d2ab7]"
                            href={`/api/artifacts/faa?acc=${r.accession}`}
                          >
                            FAA
                          </a>
                          <a
                            className="underline text-[#5d2ab7]"
                            href={`/api/artifacts/qc?acc=${r.accession}`}
                          >
                            QC JSON
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-gray-600">
                    Backend suggestion: <code>/api/artifacts/*</code> endpoints
                    returning signed URLs or files. Populate the metrics above
                    from your QC JSON.
                  </div>
                </div>
              ) : (
                <Empty label="No QC artifacts yet" />
              )}
            </Section>
          )}

          {/* ETL */}
          {tab === "ETL" && (
            <Section
              icon={RefreshCw}
              title="ETL & Metadata Monitor"
              subtitle="Scraper status, MIxS validation and accession resolution."
            >
              <div className="grid md:grid-cols-3 gap-4">
                <InfoCard k="Last run" v="—" />
                <InfoCard k="New entries today" v="—" />
                <InfoCard k="MIxS validation errors" v="—" />
              </div>

              <div className="mt-4 rounded-2xl border border-[#d0d9f5] p-4 bg-white">
                <div className="text-sm text-gray-600 mb-2">
                  Trigger a manual scrape (stub; implement POST{" "}
                  <code>/api/etl/run</code> in the backend).
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
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#5d2ab7] text-white text-sm font-medium hover:bg-[#4a1f96] transition"
                >
                  <RefreshCw className="w-4 h-4" /> Run now
                </button>
                <a
                  className="ml-3 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#d0d9f5] text-sm text-[#111111] hover:bg-[#f4f6ff] transition"
                  href="https://nibmg.ac.in"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Github className="w-4 h-4" /> nibmg.ac.in
                </a>
              </div>

              <div className="mt-4 text-xs text-gray-600">
                Suggested endpoints: <code>GET /api/etl/status</code>,{" "}
                <code>POST /api/etl/run</code>, <code>GET /api/etl/errors</code>
                . MIxS validator: <code>POST /api/etl/validate</code>.
              </div>
            </Section>
          )}

          {/* Cases */}
          {tab === "Cases" && (
            <Section
              icon={BookOpenText}
              title="Case Studies & Writing"
              subtitle="Curated stories, figures and paper-ready snippets from the Atlas."
            >
              <div className="space-y-4">
                <CaseCard
                  title="Bordetella bronchiseptica PGFR00000000"
                  body="AMR set includes aac(3)-IIa, blaOXA-60, tetA. Link out to QC and your JBrowse tracks for ODOG daily reporting."
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
                  body="Resolve accession, harmonize MIxS metadata and integrate preliminary AMR screening in a riverine context."
                  links={[
                    { label: "Project page", href: "https://nibmg.ac.in" },
                  ]}
                />
                <div className="text-xs text-gray-600">
                  Backend idea for Team F:{" "}
                  <code>GET /api/cases</code> (list of cases) and{" "}
                  <code>GET /api/cases/{"{id}"}</code> (Markdown/HTML).
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
            subtitle="Export the current filtered view as JSON or CSV."
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
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-[#5d2ab7] text-white text-sm font-medium hover:bg-[#4a1f96] transition"
              >
                <Download className="w-4 h-4" /> JSON
              </button>
              <button
                onClick={() =>
                  downloadBlob(toCSV(rows), "bharatgenome_view.csv", "text/csv")
                }
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-white text-[#111111] text-sm font-medium border border-[#d0d9f5] hover:bg-[#f4f6ff] transition"
              >
                <Download className="w-4 h-4" /> CSV
              </button>
            </div>
          </Section>

          <Section icon={FlaskConical} title="BGC Types (filtered)">
            {bgcData.length ? (
              <ul className="space-y-2 text-sm text-gray-700">
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
              <ul className="space-y-2 text-sm text-gray-700">
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

      {/* About Team & Research sections for nav anchors */}
      <section
        id="team"
        className="max-w-7xl mx-auto px-6 pb-10 grid md:grid-cols-2 gap-6"
      >
        <Section
          icon={Users}
          title="The BGDB Team"
          subtitle="Interdisciplinary microbiologists, bioinformaticians and engineers building a national-scale microbial atlas."
        >
          <p className="text-sm text-gray-700 leading-relaxed">
            The Bharat Genome Database team brings together expertise from
            clinical microbiology, environmental microbiology, genomics, data
            engineering and AI. The ODOG initiative is co-developed with
            partner institutes and hospital networks across India.
          </p>
        </Section>
        <Section
          id="research"
          icon={FlaskConical}
          title="Research & Collaborations"
          subtitle="Built for comparative genomics, AMR surveillance and discovery of novel biosynthetic pathways."
        >
          <p className="text-sm text-gray-700 leading-relaxed">
            Use this portal to seed cohort-level analyses, generate figures for
            manuscripts and rapidly discover interesting genomes for follow-up
            wet-lab work. Collaborations are welcome for joint projects on AMR,
            One Health surveillance and microbiome-based interventions.
          </p>
        </Section>
      </section>

      {/* Student Upload Modal (admin only) */}
      <Modal
        open={uOpen}
        onClose={() => setUOpen(false)}
        title="Student Upload Wizard"
      >
        <div className="text-sm text-gray-700">
          Upload <b>CSV/TSV</b> (metadata in a MIxS-like schema) and/or{" "}
          <b>JSON</b> (QC/AMR/BGC results). The ETL pipeline will validate and
          queue these records. Use the template as a starting point.
        </div>
        <div className="mt-3">
          <input
            multiple
            type="file"
            accept=".csv,.tsv,.json"
            onChange={(e) => setUFiles(Array.from(e.target.files || []))}
            className="block w-full text-sm file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-[#5d2ab7] file:text-white file:hover:bg-[#4a1f96] file:cursor-pointer"
          />
          <div className="text-xs text-gray-600 mt-2">
            API: <code>POST /api/ingest</code> → returns{" "}
            <code>{"{ jobId }"}</code>. ETL then moves data into Postgres and
            object storage.
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <button
            onClick={handleStudentUpload}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#5d2ab7] text-white text-sm font-medium hover:bg-[#4a1f96] transition"
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
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#d0d9f5] bg-white text-sm text-[#111111] hover:bg-[#f4f6ff] transition"
          >
            Download CSV template
          </button>
        </div>
        {!!uMessage && (
          <div className="mt-3 text-sm text-gray-700">{uMessage}</div>
        )}
      </Modal>

      {/* Footer */}
      <footer className="border-t border-[#d0d9f5] py-8 text-center text-sm text-gray-500">
        Built by Bharat Genome Database · BRIC–NIBMG aligned · v0.3 (Teams-ready)
      </footer>
    </main>
  );
}

// ---------- Small helper components ----------
function InfoCard({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-2xl border border-[#d0d9f5] p-4 bg-white">
      <div className="text-xs text-gray-500 uppercase tracking-wide">{k}</div>
      <div className="text-xl font-semibold text-[#111111] mt-1">{v}</div>
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
    <div className="rounded-2xl border border-[#d0d9f5] p-4 bg-white">
      <div className="font-medium text-[#111111]">{title}</div>
      <p className="text-sm text-gray-700 mt-1 leading-relaxed">{body}</p>
      {!!links?.length && (
        <div className="mt-3 flex gap-3 flex-wrap text-sm">
          {links.map((l) => (
            <a
              key={l.href}
              className="underline text-[#5d2ab7]"
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
  const url = selected
    ? `/jbrowse/?assembly=${encodeURIComponent(
        selected.organism
      )}&loc=chr1:1-50000&acc=${encodeURIComponent(selected.accession)}`
    : "/jbrowse/";
  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <select
          className="px-3 py-2 rounded-xl bg-white border border-[#d0d9f5] text-sm"
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
          className="text-sm text-[#5d2ab7] underline"
          href={url}
          target="_blank"
          rel="noreferrer"
        >
          Open in new tab
        </a>
      </div>
      <div className="h-[520px] rounded-2xl overflow-hidden border border-[#d0d9f5] bg-white">
        <iframe src={url} className="w-full h-full" loading="lazy" />
      </div>
      <div className="text-xs text-gray-600">
        Backend idea:{" "}
        <code>GET /api/jbrowse/session?acc=...</code> → returns a JBrowse
        session JSON with tracks (FASTA, GFF, BAM/CRAM, BigWig).
      </div>
    </div>
  );
}

export default function Page() {
  return <BharatGenomeResourcePortal />;
}
