"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Circle, X } from "lucide-react";
import { Sheet } from "@/components/ui";
import { useAppointments, usePatients, useVisits } from "@/lib/hooks";
import { TODAY } from "@/lib/db";
import { useUI } from "./ui-state";

const STEPS = [
  { t: "Run the day", d: "Overview shows today's schedule and who is waiting. In Calendar, click an appointment for details or an empty slot to book.", href: "/calendar", go: "Open calendar" },
  { t: "Move patients through the visit", d: "Front desk: check in, move to waiting, start the visit, then complete it. Actions change with each status.", href: "/front-desk", go: "Open front desk" },
  { t: "Find anything fast", d: "Ctrl K searches patients, appointments and visits. Ctrl J or Ask EVI answers questions such as “Who is waiting?”. Use + New to add patients, appointments and follow-ups.", href: "", go: "" },
  { t: "Document a visit", d: "Visits has tabs for notes, treatment, forms, photos and follow-up. Injection plotting records where treatment was given.", href: "/visits", go: "Open visits" },
  { t: "Keep follow-ups moving", d: "Follow-ups lists what is due, overdue and upcoming. Complete one or schedule the next appointment from the same row.", href: "/follow-ups", go: "Open follow-ups" },
  { t: "Let agents help", d: "Six agents review the schedule, follow-ups, recalls, no-shows and visit history. They summarize documented information only. They never diagnose or recommend treatment.", href: "/agents", go: "Open AI agents" },
  { t: "Set up your practice", d: "Providers, services, locations and rooms live under Practice in the sidebar.", href: "/practice/providers", go: "Open providers" },
];

export function GuidePanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const ui = useUI();
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="Quick guide" description="A two-minute tour of the practice workspace." width={460}>
      <ol className="space-y-5">
        {STEPS.map((s, i) => (
          <li key={s.t} className="flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-active text-xs font-semibold text-primary">{i + 1}</span>
            <div>
              <h3 className="text-sm font-semibold">{s.t}</h3>
              <p className="mt-0.5 text-[13px] text-muted">{s.d}</p>
              {s.href ? <button className="mt-1.5 text-[13px] font-medium text-primary hover:underline" onClick={() => { onClose(); router.push(s.href); }}>{s.go}</button>
                : <div className="mt-1.5 flex gap-3 text-[13px] font-medium text-primary"><button className="hover:underline" onClick={() => { onClose(); ui.openSearch(); }}>Try search</button><button className="hover:underline" onClick={() => { onClose(); ui.evi(); }}>Ask EVI</button></div>}
            </div>
          </li>
        ))}
      </ol>
    </Sheet>
  );
}

const FLAG = "pms.checklist";
export const markEviUsed = () => { try { localStorage.setItem(FLAG + ".evi", "1"); } catch {} };

export function GettingStarted() {
  const { data: patients } = usePatients();
  const { data: appts } = useAppointments();
  const { data: visits } = useVisits();
  const ui = useUI();
  const [hidden, setHidden] = useState(true);
  const [evi, setEvi] = useState(false);
  useEffect(() => {
    try { setHidden(localStorage.getItem(FLAG + ".hidden") === "1"); setEvi(localStorage.getItem(FLAG + ".evi") === "1"); } catch { setHidden(false); }
    const t = setInterval(() => { try { setEvi(localStorage.getItem(FLAG + ".evi") === "1"); } catch {} }, 1500);
    return () => clearInterval(t);
  }, []);
  if (hidden || !patients || !appts || !visits) return null;

  const items = [
    { k: "patient", l: "Add a patient", done: patients.length > 12, run: ui.newPatient },
    { k: "appt", l: "Book an appointment", done: appts.length > 23, run: () => ui.newAppt() },
    { k: "checkin", l: "Check a patient in", done: appts.filter((a) => a.date === TODAY && ["arrived", "waiting", "in_progress", "completed"].includes(a.status)).length > 8, href: "/front-desk" },
    { k: "visit", l: "Complete a visit", done: visits.filter((v) => v.date === TODAY && v.status === "Completed").length > 3, href: "/front-desk" },
    { k: "evi", l: "Ask EVI a question", done: evi, run: () => ui.evi() },
  ];
  const n = items.filter((i) => i.done).length;
  const dismiss = () => { try { localStorage.setItem(FLAG + ".hidden", "1"); } catch {} setHidden(true); };

  return (
    <section aria-label="Getting started" className="mb-5 rounded-xl border border-line bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="text-[15px] font-semibold">Getting started</h2><p className="text-xs text-muted">{n === items.length ? "All done. Nice work." : `${n} of ${items.length} done`}</p></div>
        <div className="flex items-center gap-3">
          <button onClick={ui.guide} className="text-[13px] font-medium text-primary hover:underline">Quick guide</button>
          <button onClick={dismiss} aria-label="Dismiss getting started" className="rounded-md p-1 text-muted hover:bg-cloud"><X className="size-4" /></button>
        </div>
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-cloud" role="progressbar" aria-valuenow={n} aria-valuemax={items.length} aria-label="Getting started progress"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(n / items.length) * 100}%` }} /></div>
      <ul className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2 xl:grid-cols-5">
        {items.map((i) => (
          <li key={i.k} className="flex items-center gap-2 text-[13px]">
            {i.done ? <Check className="size-4 shrink-0 text-[#2A8577]" aria-label="Done" /> : <Circle className="size-3.5 shrink-0 text-slate-300" aria-hidden />}
            {i.done ? <span className="text-muted line-through">{i.l}</span> : i.href ? <Link href={i.href} className="font-medium hover:text-primary">{i.l}</Link> : <button onClick={i.run} className="font-medium hover:text-primary">{i.l}</button>}
          </li>
        ))}
      </ul>
    </section>
  );
}
