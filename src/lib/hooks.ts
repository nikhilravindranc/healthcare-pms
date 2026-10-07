"use client";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, nowMin } from "./db";

export const useRefs = () => useQuery({ queryKey: ["refs"], queryFn: api.refs, staleTime: Infinity });
export const usePatients = () => useQuery({ queryKey: ["patients"], queryFn: api.patients });
export const useAppointments = () => useQuery({ queryKey: ["appointments"], queryFn: api.appointments });
export const useVisits = () => useQuery({ queryKey: ["visits"], queryFn: api.visits });
export const useFollowUps = () => useQuery({ queryKey: ["followUps"], queryFn: api.followUps });
export const useNotifications = () => useQuery({ queryKey: ["notifications"], queryFn: api.notifications });

/** Mutation that refreshes all practice data and optionally shows a toast. */
export function useAction<A extends unknown[], R>(fn: (...a: A) => Promise<R>, success?: string | ((r: R) => string)) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (a: A) => fn(...a),
    onSuccess: async (r) => {
      await qc.invalidateQueries();
      if (success) toast.success(typeof success === "function" ? success(r) : success);
    },
    onError: () => toast.error("Something went wrong. Please try again."),
  });
  return { run: (...a: A) => m.mutateAsync(a), pending: m.isPending };
}

/** Demo clock in minutes after midnight, refreshed every 20 seconds. */
export function useNow() {
  const [n, setN] = useState(nowMin());
  useEffect(() => {
    const t = setInterval(() => setN(nowMin()), 20000);
    return () => clearInterval(t);
  }, []);
  return n;
}
