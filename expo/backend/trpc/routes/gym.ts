import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../create-context";
import {
  getStore,
  setStudents,
  setBookings,
  setBlockedSlots,
  setPayments,
  setPricing,
} from "../store";

export const gymRouter = createTRPCRouter({
  getData: publicProcedure.query(() => {
    const store = getStore();
    return {
      students: store.students,
      bookings: store.bookings,
      blockedSlots: store.blockedSlots,
      payments: store.payments,
      pricing: store.pricing,
    };
  }),

  setStudents: publicProcedure
    .input(
      z.object({
        students: z.array(
          z.object({
            id: z.string(),
            firstName: z.string(),
            lastName: z.string(),
            phone: z.string(),
            createdAt: z.string(),
          })
        ),
      })
    )
    .mutation(({ input }) => {
      setStudents(input.students);
      return { ok: true };
    }),

  setBookings: publicProcedure
    .input(
      z.object({
        bookings: z.array(
          z.object({
            id: z.string(),
            studentId: z.string(),
            dayOfWeek: z.number(),
            hour: z.number(),
          })
        ),
      })
    )
    .mutation(({ input }) => {
      setBookings(input.bookings);
      return { ok: true };
    }),

  setBlockedSlots: publicProcedure
    .input(
      z.object({
        blockedSlots: z.array(
          z.object({
            id: z.string(),
            dayOfWeek: z.number(),
            hour: z.number(),
            reason: z.string(),
          })
        ),
      })
    )
    .mutation(({ input }) => {
      setBlockedSlots(input.blockedSlots);
      return { ok: true };
    }),

  setPayments: publicProcedure
    .input(
      z.object({
        payments: z.array(
          z.object({
            studentId: z.string(),
            month: z.string(),
            paid: z.boolean(),
            method: z.enum(["manual", "mercadopago"]).optional(),
          })
        ),
      })
    )
    .mutation(({ input }) => {
      setPayments(input.payments);
      return { ok: true };
    }),

  setPricing: publicProcedure
    .input(
      z.object({
        pricing: z.object({
          twoDays: z.number(),
          threeDays: z.number(),
          fourPlusDays: z.number(),
          mercadoPagoLink: z.string(),
        }),
      })
    )
    .mutation(({ input }) => {
      setPricing(input.pricing);
      return { ok: true };
    }),
});
