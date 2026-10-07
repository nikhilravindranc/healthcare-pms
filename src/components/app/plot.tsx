"use client";
import { useRef } from "react";
import type { PlotPoint, Visit } from "@/lib/types";
import { cn } from "@/lib/utils";

export const VB = { w: 100, h: 120 };

interface CanvasProps {
  points: PlotPoint[];
  previous?: PlotPoint[];
  selectedId?: string | null;
  readOnly?: boolean;
  tool?: "add" | "select";
  onAdd?: (x: number, y: number) => void;
  onSelect?: (id: string | null) => void;
  onMove?: (id: string, x: number, y: number) => void;
  onCommit?: () => void;
  showZones?: boolean;
  className?: string;
}

const ZONES: { label: string; d: string; lx: number; ly: number }[] = [
  { label: "Frontalis", d: "M30 20 Q50 12 70 20 L72 33 Q50 28 28 33 Z", lx: 50, ly: 17 },
  { label: "Glabella", d: "M42 35 Q50 33 58 35 L57 46 Q50 48 43 46 Z", lx: 50, ly: 41 },
  { label: "Lateral canthal", d: "M14 42 Q22 40 28 44 L27 58 Q20 58 15 54 Z", lx: 20, ly: 38 },
  { label: "Lateral canthal", d: "M86 42 Q78 40 72 44 L73 58 Q80 58 85 54 Z", lx: 80, ly: 38 },
  { label: "Perioral", d: "M38 74 Q50 70 62 74 L62 90 Q50 94 38 90 Z", lx: 50, ly: 97 },
  { label: "Masseter", d: "M20 66 Q27 62 31 70 L30 84 Q23 84 20 76 Z", lx: 22, ly: 90 },
  { label: "Masseter", d: "M80 66 Q73 62 69 70 L70 84 Q77 84 80 76 Z", lx: 78, ly: 90 },
];

export function FaceCanvas({ points, previous, selectedId, readOnly, tool = "select", onAdd, onSelect, onMove, onCommit, showZones = true, className }: CanvasProps) {
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<string | null>(null);
  const toLocal = (e: { clientX: number; clientY: number }) => {
    const r = svg.current!.getBoundingClientRect();
    return { x: Math.min(98, Math.max(2, ((e.clientX - r.left) / r.width) * VB.w)), y: Math.min(118, Math.max(2, ((e.clientY - r.top) / r.height) * VB.h)) };
  };
  return (
    <svg ref={svg} viewBox={`0 0 ${VB.w} ${VB.h}`} role="application" aria-label="Facial injection plotting canvas"
      className={cn("w-full touch-none select-none rounded-lg bg-[#F8FAFB]", tool === "add" && !readOnly && "cursor-crosshair", className)}
      onPointerDown={(e) => { if (readOnly) return; if (tool === "add") { const p = toLocal(e); onAdd?.(p.x, p.y); } else onSelect?.(null); }}
      onPointerMove={(e) => { if (drag.current) { const p = toLocal(e); onMove?.(drag.current, p.x, p.y); } }}
      onPointerUp={() => { if (drag.current) { drag.current = null; onCommit?.(); } }}
      onPointerLeave={() => { if (drag.current) { drag.current = null; onCommit?.(); } }}>
      {/* anatomical outline */}
      <g fill="none" stroke="#9AA9B8" strokeWidth=".6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M50 8 C28 8 21 26 21 46 C21 62 24 78 33 92 C38 100 44 106 50 106 C56 106 62 100 67 92 C76 78 79 62 79 46 C79 26 72 8 50 8 Z" fill="#fff" />
        <path d="M21 52 C16 50 15 58 18 63 C19 66 21 66 22 64" /><path d="M79 52 C84 50 85 58 82 63 C81 66 79 66 78 64" />
        <path d="M38 106 L36 120 M62 106 L64 120" />
        <path d="M30 38 Q38 33 45 37" strokeWidth=".9" /><path d="M55 37 Q62 33 70 38" strokeWidth=".9" />
        <path d="M31 47 Q37 43 43 47 Q37 50 31 47 Z" /><path d="M57 47 Q63 43 69 47 Q63 50 57 47 Z" />
        <path d="M50 46 L47 62 Q50 65 53 62 L50 46" /><path d="M44 66 Q50 69 56 66" />
        <path d="M41 78 Q45 75 50 77 Q55 75 59 78 Q50 86 41 78 Z" /><path d="M41 78 Q50 80 59 78" />
        <path d="M40 98 Q50 102 60 98" strokeDasharray="1.5 1.5" opacity=".6" />
      </g>
      {showZones && ZONES.map((z, i) => (
        <g key={i}><path d={z.d} fill="#2867B2" fillOpacity=".04" stroke="#2867B2" strokeOpacity=".3" strokeWidth=".35" strokeDasharray="1.4 1.2" />
          {i < 7 && !(i === 3 || i === 6) && <text x={z.lx} y={z.ly} fontSize="2.6" fill="#64748B" textAnchor="middle">{z.label}</text>}</g>
      ))}
      {previous?.map((p, i) => (
        <g key={p.id} aria-hidden><circle cx={p.x} cy={p.y} r="2.3" fill="none" stroke="#7B7FC4" strokeWidth=".7" strokeDasharray="1.2 .9" /><circle cx={p.x} cy={p.y} r=".5" fill="#7B7FC4" /><title>{`Previous ${i + 1}: ${p.product}, ${p.units} units`}</title></g>
      ))}
      {points.map((p, i) => {
        const sel = p.id === selectedId;
        return (
          <g key={p.id} data-pt="1" tabIndex={0} role="button" aria-label={`Point ${i + 1}: ${p.product}, ${p.units} units${sel ? ", selected" : ""}`} className={cn("outline-none", !readOnly && "cursor-grab")}
            onPointerDown={(e) => { e.stopPropagation(); onSelect?.(p.id); if (!readOnly) { drag.current = p.id; (svg.current as SVGSVGElement).setPointerCapture?.(e.pointerId); } }}
            onKeyDown={(e) => {
              if (readOnly) return;
              const d = e.shiftKey ? 3 : 1;
              const m: Record<string, [number, number]> = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] };
              if (m[e.key]) { e.preventDefault(); onMove?.(p.id, p.x + m[e.key][0], p.y + m[e.key][1]); onCommit?.(); }
            }}
            onFocus={() => onSelect?.(p.id)}>
            <circle data-pt="1" cx={p.x} cy={p.y} r="4" fill="transparent" />
            {sel && <circle cx={p.x} cy={p.y} r="3.6" fill="none" stroke="#26B9CF" strokeWidth=".7" />}
            <circle data-pt="1" cx={p.x} cy={p.y} r="2.3" fill="#2867B2" stroke="#fff" strokeWidth=".6" />
            <text data-pt="1" x={p.x} y={p.y + 0.9} fontSize="2.4" fill="#fff" textAnchor="middle" fontWeight="600">{i + 1}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function PlotSummary({ visit }: { visit: Visit }) {
  const units = visit.plot.reduce((s, p) => s + p.units, 0);
  return (
    <div className="flex items-center gap-4 p-4">
      <div className="w-24 shrink-0"><FaceCanvas points={visit.plot} readOnly showZones={false} /></div>
      <div className="text-[13px]">{visit.plot.length ? <><p className="font-medium">{visit.plot.length} injection points</p><p className="text-muted">{Math.round(units * 10) / 10} units documented in total</p></> : <p className="text-muted">No injection points documented for this visit.</p>}</div>
    </div>
  );
}
