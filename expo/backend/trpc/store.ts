import type { Student, Booking, BlockedSlot, PaymentRecord, PricingConfig } from "@/types/gym";

interface GymStore {
  students: Student[];
  bookings: Booking[];
  blockedSlots: BlockedSlot[];
  payments: PaymentRecord[];
  pricing: PricingConfig;
}

const store: GymStore = {
  students: [],
  bookings: [],
  blockedSlots: [],
  payments: [],
  pricing: {
    twoDays: 15000,
    threeDays: 20000,
    fourPlusDays: 25000,
    mercadoPagoLink: "",
  },
};

console.log("[Store] In-memory store initialized");

export function getStore(): GymStore {
  return store;
}

export function setStudents(students: Student[]) {
  store.students = students;
  console.log("[Store] Students updated:", students.length);
}

export function setBookings(bookings: Booking[]) {
  store.bookings = bookings;
  console.log("[Store] Bookings updated:", bookings.length);
}

export function setBlockedSlots(blockedSlots: BlockedSlot[]) {
  store.blockedSlots = blockedSlots;
  console.log("[Store] BlockedSlots updated:", blockedSlots.length);
}

export function setPayments(payments: PaymentRecord[]) {
  store.payments = payments;
  console.log("[Store] Payments updated:", payments.length);
}

export function setPricing(pricing: PricingConfig) {
  store.pricing = pricing;
  console.log("[Store] Pricing updated");
}
