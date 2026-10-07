"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, ChevronDown, TriangleAlert } from "lucide-react";
import { Alert, Button, ConfirmDialog, Field, Input, Modal, Select, Sheet, Skeleton, StatusBadge, Textarea } from "@/components/ui";
import { useAction, useAppointments, usePatients, useRefs, useVisits, useFollowUps, useNow } from "@/lib/hooks";
import { api, checkConflicts, fmtDate, fmtTime, freeSlots, fromMin, TODAY, addDays, nowMin } from "@/lib/db";
import { appointmentSchema, patientSchema, type AppointmentInput, type PatientInput } from "@/lib/schemas";
import { useUI } from "./ui-state";
import { toast } from "sonner";
import type { FollowUpType } from "@/lib/types";
import { cn } from "@/lib/utils";

export const waitLabel = (now: number, arrivedAt?: number) => (arrivedAt == null ? "—" : `${Math.max(0, now - arrivedAt)} min`);

/* ---------- Appointment panel ---------- */
export function AppointmentPanel({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data: appts } = useAppointments();
  const { data: patients } = usePatients();
  const { data: refs } = useRefs();
  const { data: visits } = useVisits();
  const { data: fus } = useFollowUps();
  const ui = useUI();
  const router = useRouter();
  const now = useNow();
  const [confirm, setConfirm] = useState<null | "cancel" | "noshow">(null);
  const [resched, setResched] = useState(false);
  const [rdate, setRdate] = useState(TODAY);
  const [rtime, setRtime] = useState("");
  const setStatus = useAction(api.setStatus);
  const reschedule = useAction(api.reschedule, "Appointment rescheduled");
  const start = useAction(api.startVisit);

  const a = appts?.find((x) => x.id === id);
  useEffect(() => { setResched(false); setConfirm(null); setRtime(""); }, [id]);
  const p = patients?.find((x) => x.id === a?.patientId);
  const provider = refs?.providers.find((x) => x.id === a?.providerId);
  const service = refs?.services.find((x) => x.id === a?.serviceId);
  const loc = refs?.locations.find((x) => x.id === a?.locationId);
  const room = refs?.rooms.find((x) => x.id === a?.roomId);
  const last = visits?.filter((v) => v.patientId === p?.id && v.status === "Completed" && v.id !== a?.visitId).sort((x, y) => y.date.localeCompare(x.date))[0];
  const nextFu = fus?.filter((f) => f.patientId === p?.id && f.status === "Open").sort((x, y) => x.due.localeCompare(y.due))[0];
  const slots = useMemo(() => (a ? freeSlots(a.providerId, rdate, a.duration) : []), [a, rdate]);

  const go = async (fn: () => Promise<unknown>) => { await fn(); };
  const startVisit = async () => { const v = await start.run(a!.id); toast.success("Visit started"); onClose(); router.push(`/visits/${v.id}`); };
  const name = p ? `${p.first} ${p.last}` : "";
  const st = a?.status;

  return (
    <>
      <Sheet open={!!id} onOpenChange={(o) => !o && onClose()} title={a ? name : "Appointment"} description={a ? `Patient ID ${p?.id}` : undefined}
        footer={a && st && (
          <div className="flex w-full flex-wrap items-center gap-2">
            {(st === "scheduled" || st === "confirmed") && <>
              <Button variant="secondary" loading={setStatus.pending} onClick={() => go(async () => { await setStatus.run(a.id, "arrived"); toast.success(`${name} checked in`); })}>Check in</Button>
              <Button onClick={startVisit} loading={start.pending}>Start visit</Button>
            </>}
            {st === "arrived" && <>
              <Button variant="secondary" onClick={() => go(async () => { await setStatus.run(a.id, "waiting"); toast.success(`${name} moved to waiting`); })}>Move to waiting</Button>
              <Button onClick={startVisit} loading={start.pending}>Start visit</Button>
            </>}
            {st === "waiting" && <>
              <Button variant="secondary" onClick={() => toast.success(`Calling ${name}`)}>Call patient</Button>
              <Button onClick={startVisit} loading={start.pending}>Start visit</Button>
            </>}
            {(st === "in_progress" || st === "completed") && a.visitId && <Button onClick={() => { onClose(); router.push(`/visits/${a.visitId}`); }}>View visit</Button>}
            {(st === "cancelled" || st === "no_show") && <Button onClick={() => setResched(true)}>Reschedule</Button>}
          </div>
        )}>
        {!a || !p ? <div className="space-y-3"><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></div> : (
          <div className="space-y-5">
            <div className="flex items-center justify-between"><StatusBadge status={a.status} />{a.notes && <span className="text-xs text-muted">{a.notes}</span>}</div>
            <dl className="grid grid-cols-[96px_1fr] gap-y-2.5 text-sm">
              <dt className="text-muted">Time</dt><dd>{fmtDate(a.date)} · {fmtTime(a.time)} ({a.duration} min)</dd>
              <dt className="text-muted">Service</dt><dd>{service?.name}</dd>
              <dt className="text-muted">Provider</dt><dd>{provider?.name}</dd>
              <dt className="text-muted">Location</dt><dd>{loc?.name}</dd>
              <dt className="text-muted">Room</dt><dd>{room?.name}</dd>
              {(a.status === "waiting" || a.status === "arrived") && <><dt className="text-muted">Wait time</dt><dd>{waitLabel(now, a.arrivedAt)}</dd></>}
            </dl>
            <div className="rounded-lg bg-cloud/70 p-3 text-[13px]">
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">Patient context</p>
              <p>Last visit: {last ? `${fmtDate(last.date)} · ${last.type}` : "None on record"}</p>
              <p>Upcoming follow-up: {nextFu ? `${nextFu.type}, ${fmtDate(nextFu.due)}` : "None"}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => { onClose(); router.push(`/patients/${p.id}`); }}>Open patient</Button>
              {st !== "completed" && st !== "cancelled" && st !== "no_show" && <Button size="sm" variant="soft" onClick={() => { onClose(); ui.evi({ prep: { patientId: p.id, apptId: a.id } }); }}>Prepare this visit</Button>}
              {(st === "scheduled" || st === "confirmed" || st === "arrived" || st === "waiting") && <>
                <Button size="sm" variant="secondary" onClick={() => setResched((r) => !r)}>Reschedule</Button>
                <Button size="sm" variant="secondary" onClick={() => setConfirm("cancel")}>Cancel</Button>
                {st !== "waiting" && st !== "arrived" && <Button size="sm" variant="secondary" onClick={() => setConfirm("noshow")}>Mark no-show</Button>}
              </>}
            </div>
            {resched && (
              <div className="anim-fade space-y-3 rounded-lg border border-line p-3">
                <p className="text-sm font-medium">Reschedule appointment</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Date"><Input type="date" min={TODAY} value={rdate} onChange={(e) => { setRdate(e.target.value); setRtime(""); }} /></Field>
                  <Field label="Time"><Select value={rtime} onChange={(e) => setRtime(e.target.value)}><option value="">Select time</option>{slots.filter((s) => rdate !== TODAY || s > fromMin(nowMin())).map((s) => <option key={s} value={s}>{fmtTime(s)}</option>)}</Select></Field>
                </div>
                <div className="flex justify-end gap-2"><Button size="sm" variant="secondary" onClick={() => setResched(false)}>Cancel</Button>
                  <Button size="sm" disabled={!rtime} loading={reschedule.pending} onClick={() => go(async () => { await reschedule.run(a.id, rdate, rtime); setResched(false); })}>Confirm new time</Button></div>
              </div>
            )}
          </div>
        )}
      </Sheet>
      <ConfirmDialog open={confirm === "cancel"} onOpenChange={(o) => !o && setConfirm(null)} title="Cancel appointment?"
        description={a && `This appointment is scheduled for ${name} at ${fmtTime(a.time)}.`} cancelLabel="Keep appointment" confirmLabel="Cancel appointment" danger loading={setStatus.pending}
        onConfirm={() => go(async () => { await setStatus.run(a!.id, "cancelled"); setConfirm(null); toast.success("Appointment cancelled"); })} />
      <ConfirmDialog open={confirm === "noshow"} onOpenChange={(o) => !o && setConfirm(null)} title="No-show?"
        description={`Mark ${name} as a no-show?`} cancelLabel="Cancel" confirmLabel="Mark no-show" danger loading={setStatus.pending}
        onConfirm={() => go(async () => { await setStatus.run(a!.id, "no_show"); setConfirm(null); toast.success(`${name} marked as no-show`); })} />
    </>
  );
}

/* ---------- New appointment ---------- */
const TIMES = Array.from({ length: 36 }, (_, i) => fromMin(8 * 60 + 30 + i * 15));
export function NewAppointmentPanel({ open, onClose, prefill }: { open: boolean; onClose: () => void; prefill?: Partial<AppointmentInput> }) {
  const { data: refs } = useRefs();
  const { data: patients } = usePatients();
  const ui = useUI();
  const router = useRouter();
  const [created, setCreated] = useState<{ id: string; patientId: string } | null>(null);
  const create = useAction(api.createAppointment);
  const f = useForm<AppointmentInput>({
    resolver: zodResolver(appointmentSchema) as never,
    defaultValues: { patientId: "", providerId: "", serviceId: "", date: TODAY, time: "", duration: 30, locationId: "", roomId: "", notes: "" },
  });
  useEffect(() => {
    if (open) { setCreated(null); f.reset({ patientId: "", providerId: "", serviceId: "", date: TODAY, time: "", duration: 30, locationId: "", roomId: "", notes: "", ...prefill }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prefill]);
  const v = f.watch();
  const { errors } = f.formState;
  const services = refs?.services.filter((s) => !v.providerId || s.providerIds.includes(v.providerId)) ?? [];
  const provider = refs?.providers.find((p) => p.id === v.providerId);
  const locs = refs?.locations.filter((l) => !provider || provider.locationIds.includes(l.id)) ?? [];
  const rooms = refs?.rooms.filter((r) => !v.locationId || r.locationId === v.locationId) ?? [];
  const conflicts = useMemo(() => (v.providerId && v.time ? checkConflicts({ providerId: v.providerId, roomId: v.roomId, date: v.date, time: v.time, duration: Number(v.duration) || 30 }) : []), [v.providerId, v.roomId, v.date, v.time, v.duration]);
  const free = useMemo(() => (v.providerId ? new Set(freeSlots(v.providerId, v.date, Number(v.duration) || 30)) : null), [v.providerId, v.date, v.duration]);
  const pname = patients?.find((p) => p.id === created?.patientId);

  const onService = (id: string) => {
    f.setValue("serviceId", id, { shouldValidate: !!id });
    const s = refs?.services.find((x) => x.id === id); if (s) f.setValue("duration", s.duration);
  };
  const onProvider = (id: string) => {
    f.setValue("providerId", id, { shouldValidate: true });
    const p = refs?.providers.find((x) => x.id === id);
    if (p) { f.setValue("locationId", p.locationIds[0]); f.setValue("roomId", refs!.rooms.find((r) => r.locationId === p.locationIds[0])!.id); if (!p.serviceIds.includes(v.serviceId)) f.setValue("serviceId", ""); }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title={created ? "Appointment scheduled" : "New appointment"} description={created ? undefined : "Schedule a patient with a provider."}
      footer={created ? (
        <><Button variant="secondary" onClick={onClose}>Done</Button>
          <Button variant="secondary" onClick={() => { onClose(); router.push(`/patients/${created.patientId}`); }}>Open patient</Button>
          <Button onClick={() => { onClose(); ui.openAppt(created.id); }}>View appointment</Button></>
      ) : (
        <><Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={create.pending} onClick={f.handleSubmit(async (d) => { const a = await create.run(d); setCreated({ id: a.id, patientId: a.patientId }); })}>Schedule appointment</Button></>
      )}>
      {created ? (
        <div className="anim-fade space-y-3 py-6 text-center">
          <CheckCircle2 className="mx-auto size-10 text-[#2A8577]" />
          <p className="text-base font-semibold">Appointment scheduled successfully</p>
          <p className="text-sm text-muted">{pname?.first} {pname?.last} · {fmtDate(v.date)} at {fmtTime(v.time)}</p>
        </div>
      ) : !refs || !patients ? <div className="space-y-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div> : (
        <form className="space-y-4" noValidate onSubmit={(e) => e.preventDefault()}>
          <Field label="Patient" required error={errors.patientId?.message}>
            <Select value={v.patientId} onChange={(e) => f.setValue("patientId", e.target.value, { shouldValidate: true })}>
              <option value="">Select patient</option>{patients.map((p) => <option key={p.id} value={p.id}>{p.first} {p.last} · {p.id}</option>)}
            </Select>
          </Field>
          <Field label="Provider" required error={errors.providerId?.message}>
            <Select value={v.providerId} onChange={(e) => onProvider(e.target.value)}><option value="">Select provider</option>{refs.providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
          </Field>
          <Field label="Service" required error={errors.serviceId?.message}>
            <Select value={v.serviceId} onChange={(e) => onService(e.target.value)}><option value="">Select service</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.duration} min</option>)}</Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" required error={errors.date?.message}><Input type="date" min={TODAY} value={v.date} onChange={(e) => f.setValue("date", e.target.value)} /></Field>
            <Field label="Time" required error={errors.time?.message}>
              <Select value={v.time} onChange={(e) => f.setValue("time", e.target.value, { shouldValidate: true })}>
                <option value="">Select time</option>
                {TIMES.map((t) => <option key={t} value={t}>{fmtTime(t)}{free && !free.has(t) ? " · unavailable" : ""}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Duration" error={errors.duration?.message}><Select value={String(v.duration)} onChange={(e) => f.setValue("duration", Number(e.target.value))}>{[15, 20, 30, 45, 60, 90].map((d) => <option key={d} value={d}>{d} min</option>)}</Select></Field>
            <Field label="Location" required error={errors.locationId?.message}><Select value={v.locationId} onChange={(e) => { f.setValue("locationId", e.target.value, { shouldValidate: true }); f.setValue("roomId", ""); }}><option value="">Select</option>{locs.map((l) => <option key={l.id} value={l.id}>{l.name.replace("Brightwell ", "")}</option>)}</Select></Field>
            <Field label="Room" required error={errors.roomId?.message}><Select value={v.roomId} onChange={(e) => f.setValue("roomId", e.target.value, { shouldValidate: true })}><option value="">Select</option>{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select></Field>
          </div>
          {conflicts.length > 0 && (
            <Alert tone="warn" title={conflicts.some((c) => c.kind === "provider") ? "Provider conflict" : conflicts.some((c) => c.kind === "room") ? "Room conflict" : "Unavailable time"}>
              <ul className="list-disc pl-4">{conflicts.map((c) => <li key={c.text}>{c.text}</li>)}</ul>
              <p className="mt-1">You can still schedule, or choose another time.</p>
            </Alert>
          )}
          {v.providerId && v.time && conflicts.length === 0 && <p className="flex items-center gap-1.5 text-[13px] text-[#2A8577]"><CheckCircle2 className="size-4" />Provider and room are available.</p>}
          <Field label="Notes"><Textarea value={v.notes} onChange={(e) => f.setValue("notes", e.target.value)} placeholder="Reason for visit, special requirements" /></Field>
        </form>
      )}
    </Sheet>
  );
}

/* ---------- New patient ---------- */
export function NewPatientPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: refs } = useRefs();
  const ui = useUI();
  const router = useRouter();
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null);
  const [more, setMore] = useState(false);
  const create = useAction(api.createPatient);
  const f = useForm<PatientInput>({ resolver: zodResolver(patientSchema), defaultValues: { first: "", last: "", dob: "", phone: "", email: "", gender: "", address: "", emergency: "", providerId: "", notes: "" } });
  useEffect(() => { if (open) { setCreated(null); setMore(false); f.reset(); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open]);
  const e = f.formState.errors;
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title={created ? "Patient added" : "New patient"} description={created ? undefined : "Required fields are marked with an asterisk."}
      footer={created ? (
        <><Button variant="secondary" onClick={onClose}>Done</Button>
          <Button variant="secondary" onClick={() => { onClose(); ui.newAppt({ patientId: created.id }); }}>Schedule appointment</Button>
          <Button onClick={() => { onClose(); router.push(`/patients/${created.id}`); }}>View patient</Button></>
      ) : (
        <><Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={create.pending} onClick={f.handleSubmit(async (d) => { const p = await create.run(d); setCreated({ id: p.id, name: `${p.first} ${p.last}` }); })}>Create patient</Button></>
      )}>
      {created ? (
        <div className="anim-fade space-y-2 py-6 text-center"><CheckCircle2 className="mx-auto size-10 text-[#2A8577]" /><p className="text-base font-semibold">{created.name} was added</p><p className="text-sm text-muted">Patient ID {created.id}</p></div>
      ) : (
        <form noValidate className="space-y-4" onSubmit={(ev) => ev.preventDefault()}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" required error={e.first?.message}><Input {...f.register("first")} /></Field>
            <Field label="Last name" required error={e.last?.message}><Input {...f.register("last")} /></Field>
          </div>
          <Field label="Date of birth" required error={e.dob?.message}><Input type="date" max={TODAY} {...f.register("dob")} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone" required error={e.phone?.message}><Input type="tel" {...f.register("phone")} /></Field>
            <Field label="Email" required error={e.email?.message}><Input type="email" {...f.register("email")} /></Field>
          </div>
          <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more} className="flex items-center gap-1 text-[13px] font-medium text-primary">
            <ChevronDown className={cn("size-4 transition-transform", more && "rotate-180")} />Additional details
          </button>
          {more && (
            <div className="anim-fade space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Gender"><Select {...f.register("gender")}><option value="">Not specified</option><option>Female</option><option>Male</option><option>Non-binary</option></Select></Field>
                <Field label="Preferred provider"><Select {...f.register("providerId")}><option value="">No preference</option>{refs?.providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
              </div>
              <Field label="Address"><Input {...f.register("address")} /></Field>
              <Field label="Emergency contact"><Input placeholder="Name and phone" {...f.register("emergency")} /></Field>
              <Field label="Notes"><Textarea {...f.register("notes")} /></Field>
            </div>
          )}
        </form>
      )}
    </Sheet>
  );
}

/* ---------- New follow-up ---------- */
export function NewFollowUpPanel({ open, onClose, prefill }: { open: boolean; onClose: () => void; prefill?: { patientId?: string; visitId?: string } }) {
  const { data: patients } = usePatients();
  const create = useAction(api.createFollowUp, "Follow-up added");
  const [v, setV] = useState({ patientId: "", type: "Post-treatment" as FollowUpType, due: addDays(TODAY, 14), assignee: "Dr. Patel" });
  const [err, setErr] = useState("");
  useEffect(() => { if (open) { setV({ patientId: prefill?.patientId ?? "", type: "Post-treatment", due: addDays(TODAY, 14), assignee: "Dr. Patel" }); setErr(""); } }, [open, prefill]);
  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title="New follow-up" description="Track a patient who needs to return or be contacted."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button loading={create.pending} onClick={async () => { if (!v.patientId) return setErr("Select a patient"); await create.run({ ...v, visitId: prefill?.visitId }); onClose(); }}>Add follow-up</Button></>}>
      <div className="space-y-4">
        <Field label="Patient" required error={err}><Select value={v.patientId} onChange={(e) => { setV({ ...v, patientId: e.target.value }); setErr(""); }}><option value="">Select patient</option>{patients?.map((p) => <option key={p.id} value={p.id}>{p.first} {p.last}</option>)}</Select></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type"><Select value={v.type} onChange={(e) => setV({ ...v, type: e.target.value as FollowUpType })}>{["Post-treatment", "Routine review", "Treatment continuation", "Recall", "Other"].map((t) => <option key={t}>{t}</option>)}</Select></Field>
          <Field label="Due date"><Input type="date" value={v.due} onChange={(e) => setV({ ...v, due: e.target.value })} /></Field>
        </div>
        <Field label="Assigned to"><Select value={v.assignee} onChange={(e) => setV({ ...v, assignee: e.target.value })}>{["Dr. Patel", "Dr. Rao", "Dr. Mehta", "Tom Reyes", "Meera Iyer"].map((t) => <option key={t}>{t}</option>)}</Select></Field>
      </div>
    </Modal>
  );
}

/* ---------- New visit ---------- */
export function NewVisitDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: patients } = usePatients();
  const { data: refs } = useRefs();
  const router = useRouter();
  const create = useAction(api.newVisit);
  const [pid, setPid] = useState(""); const [prov, setProv] = useState("pat"); const [err, setErr] = useState("");
  useEffect(() => { if (open) { setPid(""); setErr(""); } }, [open]);
  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title="New visit" description="Start documenting a visit that is not linked to a scheduled appointment."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button loading={create.pending} onClick={async () => { if (!pid) return setErr("Select a patient"); const v = await create.run(pid, prov); onClose(); router.push(`/visits/${v.id}`); }}>Start visit</Button></>}>
      <div className="space-y-4">
        <Field label="Patient" required error={err}><Select value={pid} onChange={(e) => { setPid(e.target.value); setErr(""); }}><option value="">Select patient</option>{patients?.map((p) => <option key={p.id} value={p.id}>{p.first} {p.last} · {p.id}</option>)}</Select></Field>
        <Field label="Provider"><Select value={prov} onChange={(e) => setProv(e.target.value)}>{refs?.providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
      </div>
    </Modal>
  );
}

export { TriangleAlert };
