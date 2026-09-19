import type { Student, Booking, BlockedSlot, PaymentRecord, PricingConfig } from "@/types/gym";

import { supabase } from "../supabase-client";

interface GymStore {
  students: Student[];
  bookings: Booking[];
  blockedSlots: BlockedSlot[];
  payments: PaymentRecord[];
  pricing: PricingConfig;
}

// Single fixed row id for the one-row pricing table (this app has one gym,
// one pricing config — no need for a real primary key here).
const PRICING_ROW_ID = 1;

const DEFAULT_PRICING: PricingConfig = {
  twoDays: 15000,
  threeDays: 20000,
  fourPlusDays: 25000,
  mercadoPagoLink: "",
};

// All persistence for gym.ts (students, bookings, blocked slots, payments,
// pricing) lives in Supabase Postgres now instead of an in-memory object,
// so data survives restarts/redeploys and is shared by every device. The
// exported function names and shapes are unchanged from the old in-memory
// version — only routes/gym.ts had to add `await`.

export async function getStore(): Promise<GymStore> {
  const [studentsRes, bookingsRes, blockedRes, paymentsRes, pricingRes] = await Promise.all([
    supabase.from("students").select("id, first_name, last_name, phone, created_at"),
    supabase.from("bookings").select("id, student_id, day_of_week, hour"),
    supabase.from("blocked_slots").select("id, day_of_week, hour, reason"),
    supabase.from("payments").select("student_id, month, paid, method"),
    supabase.from("pricing").select("two_days, three_days, four_plus_days, mercado_pago_link").eq("id", PRICING_ROW_ID).maybeSingle(),
  ]);

  for (const [label, res] of [
    ["students", studentsRes],
    ["bookings", bookingsRes],
    ["blockedSlots", blockedRes],
    ["payments", paymentsRes],
    ["pricing", pricingRes],
  ] as const) {
    if (res.error) {
      console.log(`[Store] Failed to load ${label}:`, res.error.message);
      throw res.error;
    }
  }

  const students: Student[] = (studentsRes.data ?? []).map((r) => ({
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    phone: r.phone,
    createdAt: r.created_at,
  }));

  const bookings: Booking[] = (bookingsRes.data ?? []).map((r) => ({
    id: r.id,
    studentId: r.student_id,
    dayOfWeek: r.day_of_week,
    hour: r.hour,
  }));

  const blockedSlots: BlockedSlot[] = (blockedRes.data ?? []).map((r) => ({
    id: r.id,
    dayOfWeek: r.day_of_week,
    hour: r.hour,
    reason: r.reason,
  }));

  const payments: PaymentRecord[] = (paymentsRes.data ?? []).map((r) => ({
    studentId: r.student_id,
    month: r.month,
    paid: r.paid,
    method: r.method ?? undefined,
  }));

  const pricing: PricingConfig = pricingRes.data
    ? {
        twoDays: pricingRes.data.two_days,
        threeDays: pricingRes.data.three_days,
        fourPlusDays: pricingRes.data.four_plus_days,
        mercadoPagoLink: pricingRes.data.mercado_pago_link,
      }
    : DEFAULT_PRICING;

  return { students, bookings, blockedSlots, payments, pricing };
}

export async function setStudents(students: Student[]): Promise<void> {
  const { error: delErr } = await supabase.from("students").delete().not("id", "is", null);
  if (delErr) throw delErr;

  if (students.length > 0) {
    const rows = students.map((s) => ({
      id: s.id,
      first_name: s.firstName,
      last_name: s.lastName,
      phone: s.phone,
      created_at: s.createdAt,
    }));
    const { error: insErr } = await supabase.from("students").insert(rows);
    if (insErr) throw insErr;
  }

  console.log("[Store] Students updated:", students.length);
}

export async function setBookings(bookings: Booking[]): Promise<void> {
  const { error: delErr } = await supabase.from("bookings").delete().not("id", "is", null);
  if (delErr) throw delErr;

  if (bookings.length > 0) {
    const rows = bookings.map((b) => ({
      id: b.id,
      student_id: b.studentId,
      day_of_week: b.dayOfWeek,
      hour: b.hour,
    }));
    const { error: insErr } = await supabase.from("bookings").insert(rows);
    if (insErr) throw insErr;
  }

  console.log("[Store] Bookings updated:", bookings.length);
}

export async function setBlockedSlots(blockedSlots: BlockedSlot[]): Promise<void> {
  const { error: delErr } = await supabase.from("blocked_slots").delete().not("id", "is", null);
  if (delErr) throw delErr;

  if (blockedSlots.length > 0) {
    const rows = blockedSlots.map((b) => ({
      id: b.id,
      day_of_week: b.dayOfWeek,
      hour: b.hour,
      reason: b.reason,
    }));
    const { error: insErr } = await supabase.from("blocked_slots").insert(rows);
    if (insErr) throw insErr;
  }

  console.log("[Store] BlockedSlots updated:", blockedSlots.length);
}

export async function setPayments(payments: PaymentRecord[]): Promise<void> {
  const { error: delErr } = await supabase.from("payments").delete().not("student_id", "is", null);
  if (delErr) throw delErr;

  if (payments.length > 0) {
    const rows = payments.map((p) => ({
      student_id: p.studentId,
      month: p.month,
      paid: p.paid,
      method: p.method ?? null,
    }));
    const { error: insErr } = await supabase.from("payments").insert(rows);
    if (insErr) throw insErr;
  }

  console.log("[Store] Payments updated:", payments.length);
}

export async function setPricing(pricing: PricingConfig): Promise<void> {
  const { error } = await supabase.from("pricing").upsert({
    id: PRICING_ROW_ID,
    two_days: pricing.twoDays,
    three_days: pricing.threeDays,
    four_plus_days: pricing.fourPlusDays,
    mercado_pago_link: pricing.mercadoPagoLink,
  });
  if (error) throw error;

  console.log("[Store] Pricing updated");
}
