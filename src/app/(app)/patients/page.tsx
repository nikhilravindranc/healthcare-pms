"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, UserPlus } from "lucide-react";
import { Avatar, Button, EmptyState, Input, PageHeader, Pagination, Panel, Select, SkeletonRows, Td, Th } from "@/components/ui";
import { useUI } from "@/components/app/ui-state";
import { useAppointments, usePatients, useRefs, useVisits } from "@/lib/hooks";
import { fmtDate, fmtTime, TODAY, addDays } from "@/lib/db";
import { PStatus } from "@/components/app/bits";

const PAGE = 8;
export default function PatientsPage() { return <Suspense><Patients /></Suspense>; }

function Patients() {
  const { data: patients, isLoading, isError, refetch } = usePatients();
  const { data: appts } = useAppointments();
  const { data: visits } = useVisits();
  const { data: refs } = useRefs();
  const ui = useUI();
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState("");
  const [f, setF] = useState({ status: "", provider: "", last: "", next: "" });
  const [page, setPage] = useState(1);

  useEffect(() => { if (params.get("new")) { ui.newPatient(); router.replace("/patients"); } }, [params, ui, router]);

  const rows = useMemo(() => (patients ?? []).map((p) => {
    const last = (visits ?? []).filter((v) => v.patientId === p.id && v.status === "Completed").sort((a, b) => b.date.localeCompare(a.date))[0];
    const next = (appts ?? []).filter((a) => a.patientId === p.id && a.date >= TODAY && !["completed", "cancelled", "no_show"].includes(a.status)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
    return { p, last: last?.date, next };
  }).filter(({ p, last, next }) => {
    const s = q.toLowerCase();
    if (s && ![`${p.first} ${p.last}`, p.id, p.phone, p.email].some((x) => x.toLowerCase().includes(s))) return false;
    if (f.status && p.status !== f.status) return false;
    if (f.provider && p.providerId !== f.provider) return false;
    if (f.last === "30" && !(last && last >= addDays(TODAY, -30))) return false;
    if (f.last === "old" && last && last >= addDays(TODAY, -30)) return false;
    if (f.next === "yes" && !next) return false;
    if (f.next === "no" && next) return false;
    return true;
  }), [patients, appts, visits, q, f]);

  const pages = Math.ceil(rows.length / PAGE);
  const slice = rows.slice((page - 1) * PAGE, page * PAGE);
  useEffect(() => setPage(1), [q, f]);

  return (
    <>
      <PageHeader title="Patients" subtitle={patients ? `${patients.length} patients` : undefined} actions={<Button onClick={ui.newPatient}><UserPlus className="size-4" />New patient</Button>} />
      <Panel>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="relative min-w-56 flex-1 sm:max-w-xs"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden /><Input aria-label="Search patients" className="h-9 pl-9" placeholder="Search by name, ID or phone" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Select sm className="w-32" aria-label="Status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="">All statuses</option><option>Active</option><option>New</option><option>Inactive</option></Select>
          <Select sm className="w-36" aria-label="Provider" value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value })}><option value="">All providers</option>{refs?.providers.map((p) => <option key={p.id} value={p.id}>{p.short}</option>)}</Select>
          <Select sm className="w-40" aria-label="Last visit" value={f.last} onChange={(e) => setF({ ...f, last: e.target.value })}><option value="">Any last visit</option><option value="30">Within 30 days</option><option value="old">Over 30 days ago</option></Select>
          <Select sm className="w-44" aria-label="Upcoming appointment" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })}><option value="">Any upcoming</option><option value="yes">Has upcoming</option><option value="no">No upcoming</option></Select>
        </div>
        {isLoading ? <SkeletonRows rows={8} /> : isError ? (
          <EmptyState title="Couldn't load patients" text="Check your connection and try again." action={<Button variant="secondary" onClick={() => refetch()}>Try again</Button>} />
        ) : rows.length === 0 ? (
          <EmptyState title="No patients found" text="Try another search or add a new patient." action={<Button onClick={ui.newPatient}>New patient</Button>} />
        ) : (
          <>
            <table className="hidden w-full md:table">
              <thead className="border-b border-line bg-cloud/50"><tr><Th>Patient</Th><Th>Contact</Th><Th>Last visit</Th><Th>Next appointment</Th><Th>Provider</Th><Th>Status</Th></tr></thead>
              <tbody className="divide-y divide-line">
                {slice.map(({ p, last, next }) => (
                  <tr key={p.id} tabIndex={0} onClick={() => router.push(`/patients/${p.id}`)} onKeyDown={(e) => e.key === "Enter" && router.push(`/patients/${p.id}`)} className="cursor-pointer hover:bg-cloud/50 focus-visible:bg-cloud/50">
                    <Td><div className="flex items-center gap-3"><Avatar name={`${p.first} ${p.last}`} size={32} /><div><p className="font-medium">{p.first} {p.last}</p><p className="text-xs text-muted">{p.id}</p></div></div></Td>
                    <Td><p>{p.phone}</p><p className="text-xs text-muted">{p.email}</p></Td>
                    <Td>{last ? fmtDate(last) : <span className="text-muted">—</span>}</Td>
                    <Td>{next ? `${next.date === TODAY ? "Today" : fmtDate(next.date)} · ${fmtTime(next.time)}` : <span className="text-muted">None</span>}</Td>
                    <Td>{refs?.providers.find((x) => x.id === p.providerId)?.short ?? "—"}</Td>
                    <Td><PStatus s={p.status} /></Td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="divide-y divide-line md:hidden">
              {slice.map(({ p, last, next }) => (
                <li key={p.id}><button onClick={() => router.push(`/patients/${p.id}`)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  <Avatar name={`${p.first} ${p.last}`} size={36} />
                  <div className="min-w-0 flex-1"><p className="font-medium">{p.first} {p.last} <span className="text-xs font-normal text-muted">{p.id}</span></p>
                    <p className="text-xs text-muted">Last {last ? fmtDate(last) : "—"} · Next {next ? fmtDate(next.date) : "none"}</p></div><PStatus s={p.status} /></button></li>
              ))}
            </ul>
            <Pagination page={page} pages={pages} onPage={setPage} total={rows.length} />
          </>
        )}
      </Panel>
    </>
  );
}
