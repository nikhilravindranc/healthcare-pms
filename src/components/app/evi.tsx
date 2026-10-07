"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { ArrowUp, Maximize2, Minimize2, Sparkles, X } from "lucide-react";
import { Button, Skeleton } from "@/components/ui";
import { askEvi, EVI_SUGGESTIONS, prepSummary, type EviAnswer, type PrepSummary } from "@/lib/insight";
import { api, fmtDate } from "@/lib/db";
import { useAction } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { useUI, type EviOpen } from "./ui-state";
import { markEviUsed } from "./guide";
import { toast } from "sonner";

type Msg = { role: "user"; text: string } | { role: "evi"; answer: EviAnswer } | { role: "pending" };

function Sec({ t, items, empty }: { t: string; items: string[]; empty: string }) {
  return (
    <div><p className="text-[11px] font-medium uppercase tracking-wide text-muted">{t}</p>
      {items.length ? <ul className="mt-0.5 space-y-0.5">{items.map((i) => <li key={i} className="text-[13px]">{i}</li>)}</ul> : <p className="text-[13px] text-muted">{empty}</p>}</div>
  );
}

export function PrepCard({ prep }: { prep: PrepSummary }) {
  const router = useRouter();
  return (
    <div className="mt-3 space-y-3 rounded-lg border border-line bg-white p-3.5">
      {prep.reason && <p className="text-[13px] font-medium">{prep.reason}</p>}
      <Sec t="Previous visits" items={prep.visits.map((v) => `${v.label}${v.sub ? ` — ${v.sub}` : ""}`)} empty="No previous visits" />
      <Sec t="Treatments" items={prep.treatments} empty="No documented treatments" />
      <Sec t="Recent notes" items={prep.notes} empty="No notes on file" />
      <Sec t="Forms and documents" items={prep.forms} empty="No forms on file" />
      <Sec t="Photos and injection plot" items={[`${prep.photos} photo${prep.photos === 1 ? "" : "s"} on file`, prep.plot ? `Previous plot: ${prep.plot.points} points on ${fmtDate(prep.plot.date)}` : "No previous plot"]} empty="" />
      <Sec t="Follow-up history" items={prep.followUps} empty="No follow-ups" />
      <p className="border-t border-line pt-2 text-[11px] text-muted">Summary of documented information only. It does not include diagnosis or treatment recommendations.</p>
      {prep.plot && <Button size="sm" variant="secondary" onClick={() => router.push(`/visits/${prep.plot!.visitId}/plotting`)}>View previous injection plot</Button>}
    </div>
  );
}

export function EviDialog({ open, onClose, initial }: { open: boolean; onClose: () => void; initial: EviOpen }) {
  const router = useRouter();
  const ui = useUI();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [wide, setWide] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const start = useAction(api.startVisit);

  const ask = (text: string, answer?: EviAnswer) => {
    if (!text.trim()) return;
    markEviUsed();
    setMsgs((m) => [...m, { role: "user", text }, { role: "pending" }]);
    setQ("");
    setTimeout(() => setMsgs((m) => [...m.filter((x) => x.role !== "pending"), { role: "evi", answer: answer ?? askEvi(text) }]), 650);
  };
  useEffect(() => {
    if (!open) return;
    setMsgs([]); setQ(""); setWide(false);
    if (initial.prep) {
      const prep = prepSummary(initial.prep.patientId, initial.prep.apptId);
      setTimeout(() => ask(`Prepare this visit: ${prep.name}`, { text: `Visit Preparation Agent summary for ${prep.name}.`, prep, links: [{ label: "Open patient", href: `/patients/${prep.patientId}` }, ...(initial.prep!.apptId ? [{ label: "Start visit", startAppt: initial.prep!.apptId }] : [])] }), 0);
    } else if (initial.prompt) setTimeout(() => ask(initial.prompt!), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs]);

  const go = (href: string) => { onClose(); router.push(href); };
  const empty = msgs.length === 0;

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="anim-fade fixed inset-0 z-50 bg-[#26384B]/35" />
        <Dialog.Content className={cn("anim-pop fixed left-1/2 z-50 flex w-[calc(100vw-24px)] -translate-x-1/2 flex-col overflow-hidden rounded-xl bg-white shadow-2xl focus:outline-none", wide ? "top-6 h-[calc(100vh-48px)] max-w-3xl" : empty ? "top-[12vh] max-w-xl" : "top-[8vh] h-[80vh] max-w-xl")}>
          <Dialog.Title className="sr-only">Ask EVI</Dialog.Title>
          <Dialog.Description className="sr-only">Ask questions about your practice</Dialog.Description>
          <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
            {!empty && <span className="grid size-6 place-items-center rounded-full bg-active text-primary"><Sparkles className="size-3.5" /></span>}
            <span className="text-sm font-semibold">{empty ? "Ask EVI" : "EVI"}</span>
            <span className="text-xs text-muted">Practice assistant</span>
            <div className="ml-auto flex items-center gap-1">
              {!empty && <button onClick={() => setWide((w) => !w)} className="rounded-md p-1.5 text-muted hover:bg-cloud" aria-label={wide ? "Collapse" : "Expand"}>{wide ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}</button>}
              <Dialog.Close className="rounded-md p-1.5 text-muted hover:bg-cloud" aria-label="Close"><X className="size-4" /></Dialog.Close>
            </div>
          </div>
          {!empty && (
            <div className="scroll-thin flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
              {msgs.map((m, i) =>
                m.role === "user" ? <div key={i} className="flex justify-end"><p className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-white">{m.text}</p></div>
                : m.role === "pending" ? <div key={i} className="space-y-2" aria-label="EVI is thinking"><Skeleton className="w-3/5" /><Skeleton className="w-2/5" /></div>
                : (
                  <div key={i} className="max-w-[95%]">
                    <p className="text-sm">{m.answer.text}</p>
                    {m.answer.prep && <PrepCard prep={m.answer.prep} />}
                    {m.answer.rows && m.answer.rows.length > 0 && (
                      <ul className="mt-2.5 divide-y divide-line overflow-hidden rounded-lg border border-line">
                        {m.answer.rows.map((r, j) => (
                          <li key={j} className="flex items-center gap-3 px-3 py-2.5">
                            <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-medium">{r.title}</p>{r.meta && <p className="truncate text-xs text-muted">{r.meta}</p>}</div>
                            {r.right && <span className="text-xs font-medium text-[#7A4B00]">{r.right}</span>}
                            {r.patientId && <button className="text-[13px] font-medium text-primary hover:underline" onClick={() => go(`/patients/${r.patientId}`)}>Open patient</button>}
                            {r.apptId && <button className="text-[13px] font-medium text-primary hover:underline" onClick={() => { onClose(); ui.openAppt(r.apptId!); }}>Appointment</button>}
                            {r.href && <button className="text-[13px] font-medium text-primary hover:underline" onClick={() => go(r.href!)}>Open</button>}
                          </li>
                        ))}
                      </ul>
                    )}
                    {m.answer.links && (
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {m.answer.links.map((l) => (
                          <Button key={l.label} size="sm" variant="secondary" onClick={async () => {
                            if (l.href) go(l.href);
                            else if (l.prep) ask(`Summarize visits`, { text: "Documented history", prep: prepSummary(l.prep.patientId, l.prep.apptId) });
                            else if (l.startAppt) { const v = await start.run(l.startAppt); toast.success("Visit started"); go(`/visits/${v.id}`); }
                            else ask(l.label);
                          }}>{l.label}</Button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              <div ref={end} />
            </div>
          )}
          {empty && (
            <div className="px-4 pb-1 pt-3">
              <p className="mb-2 text-xs font-medium text-muted">Suggestions</p>
              <div className="flex flex-col">{EVI_SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => ask(s)} className="rounded-md px-2.5 py-2 text-left text-sm hover:bg-cloud">{s}</button>
              ))}</div>
            </div>
          )}
          <form className="m-3 flex items-center gap-2 rounded-lg border border-line px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask EVI about your practice..." aria-label="Ask EVI" className="h-11 flex-1 bg-transparent text-sm outline-none" />
            <button type="submit" disabled={!q.trim()} aria-label="Send" className="grid size-7 place-items-center rounded-md bg-primary text-white disabled:opacity-40"><ArrowUp className="size-4" /></button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
