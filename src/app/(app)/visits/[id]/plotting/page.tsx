"use client";
import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Crosshair, MousePointer2, Trash2 } from "lucide-react";
import { Alert, Badge, Button, EmptyState, Field, Input, Panel, PanelHeader, Segmented, Select, Skeleton, Textarea } from "@/components/ui";
import { FaceCanvas } from "@/components/app/plot";
import { useUI } from "@/components/app/ui-state";
import { useAction, useRefs, useVisits } from "@/lib/hooks";
import { api, fmtDate, pname, TODAY } from "@/lib/db";
import type { PlotPoint } from "@/lib/types";
import { cn } from "@/lib/utils";

const PRODUCTS = ["Botulinum toxin A", "Hyaluronic acid filler", "Biostimulator", "Other"];
type Mode = "current" | "previous" | "overlay";

export default function PlottingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: visits, isLoading } = useVisits();
  const { data: refs } = useRefs();
  const ui = useUI();
  const update = useAction(api.updateVisit);
  const v = visits?.find((x) => x.id === id);
  const [pts, setPts] = useState<PlotPoint[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [tool, setTool] = useState<"add" | "select">("add");
  const [mode, setMode] = useState<Mode>("overlay");
  const [loaded, setLoaded] = useState<string | null>(null);
  const dirty = useRef(false);

  useEffect(() => { if (v && loaded !== v.id) { setPts(v.plot); setLoaded(v.id); setMode((visits ?? []).some((x) => x.patientId === v.patientId && x.id !== v.id && x.plot.length) ? "overlay" : "current"); } }, [v, loaded, visits]);
  const commit = (next = pts) => { dirty.current = false; return update.run(id, { plot: next }); };

  if (isLoading || !v) return isLoading ? <Skeleton className="h-[520px] w-full" /> : <EmptyState title="Visit not found" />;
  const prev = (visits ?? []).filter((x) => x.patientId === v.patientId && x.id !== v.id && x.plot.length && x.date <= v.date).sort((a, b) => b.date.localeCompare(a.date))[0];
  const locked = v.status === "Completed";
  const selected = pts.find((p) => p.id === sel);
  const total = (l: PlotPoint[]) => Math.round(l.reduce((s, p) => s + p.units, 0) * 10) / 10;
  const provider = refs?.providers.find((p) => p.id === v.providerId)?.short;

  const patch = (pid: string, ch: Partial<PlotPoint>) => { dirty.current = true; setPts((l) => l.map((p) => (p.id === pid ? { ...p, ...ch } : p))); };
  const add = (x: number, y: number) => {
    const p: PlotPoint = { id: `p${Date.now()}`, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, product: pts.at(-1)?.product ?? PRODUCTS[0], units: pts.at(-1)?.units ?? 2, note: "" };
    const next = [...pts, p]; setPts(next); setSel(p.id); commit(next);
  };
  const remove = (pid: string) => { const next = pts.filter((p) => p.id !== pid); setPts(next); setSel(null); commit(next).then(() => toast.success("Point deleted")); };

  return (
    <>
      <nav className="mb-3 text-[13px] text-muted"><Link href="/visits" className="hover:text-primary">Visits</Link> / <Link href={`/visits/${v.id}`} className="hover:text-primary">{pname(v.patientId)}</Link> / Injection plotting</nav>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-[26px] font-semibold tracking-tight">Injection plotting</h1><p className="mt-1 text-sm text-muted">{pname(v.patientId)} · {v.type} · {fmtDate(v.date, true)} · {provider}</p></div>
        <div className="flex flex-wrap gap-2">
          {prev && <Button variant="secondary" onClick={() => ui.evi({ prep: { patientId: v.patientId, apptId: v.apptId } })}>Summarize previous treatment</Button>}
          <Link href={`/visits/${v.id}`}><Button variant="secondary">Back to visit</Button></Link>
        </div>
      </div>
      <Alert tone="info" title="Documentation tool">Record where treatment was given. Placement and dosage decisions are made by the provider. EVI only summarizes previously documented treatment.</Alert>

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
            <div className="flex items-center gap-2">
              {!locked && <div role="radiogroup" aria-label="Tool" className="inline-flex rounded-lg bg-cloud p-0.5">
                {([["add", "Add point", Crosshair], ["select", "Move / edit", MousePointer2]] as const).map(([k, l, I]) => (
                  <button key={k} role="radio" aria-checked={tool === k} onClick={() => setTool(k)} className={cn("flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium", tool === k ? "bg-white text-primary shadow-sm" : "text-muted")}><I className="size-3.5" />{l}</button>))}
              </div>}
              {locked && <Badge tone="mint">Completed visit · read-only</Badge>}
            </div>
            {prev && <Segmented label="Comparison" value={mode} onChange={setMode} options={[{ value: "current", label: "Current" }, { value: "previous", label: "Previous" }, { value: "overlay", label: "Compare" }]} />}
          </div>
          <div className={cn("grid gap-4 p-4", mode === "overlay" ? "" : "")}>
            <div className="mx-auto w-full max-w-[460px]">
              {mode === "previous" && prev ? <FaceCanvas points={prev.plot} readOnly /> :
                <FaceCanvas points={pts} previous={mode === "overlay" ? prev?.plot : undefined} selectedId={sel} readOnly={locked} tool={tool}
                  onAdd={add} onSelect={(i) => { setSel(i); if (i && tool === "add") setTool("select"); }} onMove={(pid, x, y) => patch(pid, { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 })} onCommit={() => dirty.current && commit()} />}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-muted">
              <span className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-primary" />Current ({pts.length})</span>
              {prev && <span className="flex items-center gap-1.5"><span className="size-3 rounded-full border border-dashed border-[#7B7FC4]" />Previous ({prev.plot.length})</span>}
              {!locked && <span>{tool === "add" ? "Select the face to add a point" : "Drag a point to move it. Arrow keys nudge the selected point."}</span>}
            </div>
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel>
            <PanelHeader title="Treatment comparison" />
            <div className="grid grid-cols-2 divide-x divide-line text-[13px]">
              <div className="p-4"><p className="text-xs text-muted">Previous treatment</p><p className="font-medium">{prev ? fmtDate(prev.date) : "None on record"}</p>{prev && <p className="text-muted">{prev.plot.length} points · {total(prev.plot)} units</p>}</div>
              <div className="p-4"><p className="text-xs text-muted">Current treatment</p><p className="font-medium">{v.date === TODAY ? "Today" : fmtDate(v.date)}</p><p className="text-muted">{pts.length} points · {total(pts)} units</p></div>
            </div>
          </Panel>
          <Panel>
            <PanelHeader title={selected ? `Point ${pts.indexOf(selected) + 1}` : "Point details"} action={selected && !locked && <Button size="sm" variant="ghost" onClick={() => remove(selected.id)} aria-label="Delete point"><Trash2 className="size-4" />Delete</Button>} />
            {selected ? (
              <div className="space-y-3 p-4">
                <Field label="Treatment / product"><Select disabled={locked} value={selected.product} onChange={(e) => { patch(selected.id, { product: e.target.value }); setTimeout(() => commit(), 0); }}>{[...new Set([...PRODUCTS, selected.product])].map((p) => <option key={p}>{p}</option>)}</Select></Field>
                <Field label="Units or volume"><Input disabled={locked} type="number" min={0} step="0.1" value={selected.units} onChange={(e) => patch(selected.id, { units: Number(e.target.value) })} onBlur={() => commit()} /></Field>
                <div className="grid grid-cols-2 gap-3 text-[13px]"><div><p className="text-xs text-muted">Date</p><p>{fmtDate(v.date, true)}</p></div><div><p className="text-xs text-muted">Provider</p><p>{provider}</p></div></div>
                <Field label="Notes"><Textarea disabled={locked} value={selected.note} onChange={(e) => patch(selected.id, { note: e.target.value })} onBlur={() => commit()} /></Field>
              </div>
            ) : <EmptyState title="No point selected" text={locked ? "Select a point to view its details." : "Select a point on the face, or add a new one."} />}
          </Panel>
          <Panel>
            <PanelHeader title="Documented points" />
            {pts.length === 0 ? <p className="p-4 text-[13px] text-muted">No points yet.</p> : (
              <ul className="max-h-56 divide-y divide-line overflow-y-auto">{pts.map((p, i) => (
                <li key={p.id}><button onClick={() => { setSel(p.id); setTool("select"); }} className={cn("flex w-full items-center gap-3 px-4 py-2 text-left text-[13px] hover:bg-cloud/60", p.id === sel && "bg-active")}>
                  <span className="grid size-5 place-items-center rounded-full bg-primary text-[11px] font-semibold text-white">{i + 1}</span><span className="flex-1 truncate">{p.product}</span><span className="text-muted">{p.units} u</span></button></li>))}</ul>)}
          </Panel>
        </div>
      </div>
    </>
  );
}
