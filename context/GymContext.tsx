import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import {
  Student,
  Booking,
  BlockedSlot,
  PaymentRecord,
  CurrentUser,
  UserRole,
  PricingConfig,
} from '@/types/gym';
import { MAX_CAPACITY, STORAGE_KEYS, DEFAULT_PRICING } from '@/constants/gym';
import { trpc } from '@/lib/trpc';

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export const [GymProvider, useGym] = createContextHook(() => {
  const [students, setStudents] = useState<Student[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [pricing, setPricing] = useState<PricingConfig>({ ...DEFAULT_PRICING, mercadoPagoLink: '' });
  const [localLoaded, setLocalLoaded] = useState<boolean>(false);
  const initialSyncDone = useRef<boolean>(false);

  const utils = trpc.useUtils();

  const localDataQuery = useQuery({
    queryKey: ['localGymData'],
    queryFn: async () => {
      console.log('[GymContext] Loading local data from AsyncStorage...');
      const [storedStudents, storedBookings, storedBlocked, storedPayments, storedPricing, storedUser] =
        await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.students),
          AsyncStorage.getItem(STORAGE_KEYS.bookings),
          AsyncStorage.getItem(STORAGE_KEYS.blockedSlots),
          AsyncStorage.getItem(STORAGE_KEYS.payments),
          AsyncStorage.getItem(STORAGE_KEYS.pricing),
          AsyncStorage.getItem(STORAGE_KEYS.currentUser),
        ]);

      const data = {
        students: storedStudents ? JSON.parse(storedStudents) as Student[] : [],
        bookings: storedBookings ? JSON.parse(storedBookings) as Booking[] : [],
        blockedSlots: storedBlocked ? JSON.parse(storedBlocked) as BlockedSlot[] : [],
        payments: storedPayments ? JSON.parse(storedPayments) as PaymentRecord[] : [],
        pricing: storedPricing ? JSON.parse(storedPricing) as PricingConfig : { ...DEFAULT_PRICING, mercadoPagoLink: '' },
        currentUser: storedUser ? JSON.parse(storedUser) as CurrentUser : null,
      };

      console.log('[GymContext] Local data loaded:', {
        students: data.students.length,
        bookings: data.bookings.length,
        payments: data.payments.length,
      });

      return data;
    },
    staleTime: Infinity,
  });

  useEffect(() => {
    if (localDataQuery.data && !localLoaded) {
      console.log('[GymContext] Applying local data as initial state');
      setStudents(localDataQuery.data.students);
      setBookings(localDataQuery.data.bookings);
      setBlockedSlots(localDataQuery.data.blockedSlots);
      setPayments(localDataQuery.data.payments);
      setPricing(localDataQuery.data.pricing);
      setCurrentUser(localDataQuery.data.currentUser);
      setLocalLoaded(true);
    }
  }, [localDataQuery.data, localLoaded]);

  const dataQuery = trpc.gym.getData.useQuery(undefined, {
    refetchInterval: 8000,
    staleTime: 3000,
    retry: 2,
    retryDelay: 2000,
  });

  const setStudentsMutation = trpc.gym.setStudents.useMutation({
    onSuccess: () => {
      console.log('[GymContext] Students synced to backend OK');
      utils.gym.getData.invalidate();
    },
    onError: (err) => {
      console.log('[GymContext] Students backend sync failed:', err.message);
    },
  });

  const setBookingsMutation = trpc.gym.setBookings.useMutation({
    onSuccess: () => {
      console.log('[GymContext] Bookings synced to backend OK');
      utils.gym.getData.invalidate();
    },
    onError: (err) => {
      console.log('[GymContext] Bookings backend sync failed:', err.message);
    },
  });

  const setBlockedSlotsMutation = trpc.gym.setBlockedSlots.useMutation({
    onSuccess: () => {
      console.log('[GymContext] BlockedSlots synced to backend OK');
      utils.gym.getData.invalidate();
    },
    onError: (err) => {
      console.log('[GymContext] BlockedSlots backend sync failed:', err.message);
    },
  });

  const setPaymentsMutation = trpc.gym.setPayments.useMutation({
    onSuccess: () => {
      console.log('[GymContext] Payments synced to backend OK');
      utils.gym.getData.invalidate();
    },
    onError: (err) => {
      console.log('[GymContext] Payments backend sync failed:', err.message);
    },
  });

  const setPricingMutation = trpc.gym.setPricing.useMutation({
    onSuccess: () => {
      console.log('[GymContext] Pricing synced to backend OK');
      utils.gym.getData.invalidate();
    },
    onError: (err) => {
      console.log('[GymContext] Pricing backend sync failed:', err.message);
    },
  });

  useEffect(() => {
    if (!dataQuery.data || !localLoaded) return;

    const backendHasData =
      dataQuery.data.students.length > 0 ||
      dataQuery.data.bookings.length > 0 ||
      dataQuery.data.payments.length > 0 ||
      dataQuery.data.blockedSlots.length > 0;

    const localHasData =
      students.length > 0 ||
      bookings.length > 0 ||
      payments.length > 0 ||
      blockedSlots.length > 0;

    if (!initialSyncDone.current && !backendHasData && localHasData) {
      console.log('[GymContext] Backend empty but local has data — pushing local to backend');
      initialSyncDone.current = true;
      if (students.length > 0) setStudentsMutation.mutate({ students });
      if (bookings.length > 0) setBookingsMutation.mutate({ bookings });
      if (blockedSlots.length > 0) setBlockedSlotsMutation.mutate({ blockedSlots });
      if (payments.length > 0) setPaymentsMutation.mutate({ payments });
      if (pricing.twoDays !== DEFAULT_PRICING.twoDays || pricing.threeDays !== DEFAULT_PRICING.threeDays || pricing.fourPlusDays !== DEFAULT_PRICING.fourPlusDays || pricing.mercadoPagoLink) {
        setPricingMutation.mutate({ pricing });
      }
      return;
    }

    initialSyncDone.current = true;
    console.log('[GymContext] Backend data received:', {
      students: dataQuery.data.students.length,
      bookings: dataQuery.data.bookings.length,
      blockedSlots: dataQuery.data.blockedSlots.length,
      payments: dataQuery.data.payments.length,
    });

    setStudents(dataQuery.data.students);
    setBookings(dataQuery.data.bookings);
    setBlockedSlots(dataQuery.data.blockedSlots);
    setPayments(dataQuery.data.payments);
    if (dataQuery.data.pricing) {
      setPricing(dataQuery.data.pricing);
    }

    AsyncStorage.setItem(STORAGE_KEYS.students, JSON.stringify(dataQuery.data.students)).catch(() => {});
    AsyncStorage.setItem(STORAGE_KEYS.bookings, JSON.stringify(dataQuery.data.bookings)).catch(() => {});
    AsyncStorage.setItem(STORAGE_KEYS.blockedSlots, JSON.stringify(dataQuery.data.blockedSlots)).catch(() => {});
    AsyncStorage.setItem(STORAGE_KEYS.payments, JSON.stringify(dataQuery.data.payments)).catch(() => {});
    if (dataQuery.data.pricing) {
      AsyncStorage.setItem(STORAGE_KEYS.pricing, JSON.stringify(dataQuery.data.pricing)).catch(() => {});
    }
  }, [dataQuery.data, localLoaded]);

  useEffect(() => {
    if (dataQuery.error) {
      console.log('[GymContext] Backend error:', dataQuery.error.message);
    }
  }, [dataQuery.error]);

  const saveToLocal = useCallback(async (key: string, data: unknown) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(data));
    } catch (err) {
      console.error('[GymContext] Failed to save to local storage:', key, err);
    }
  }, []);

  const persistStudents = useCallback(async (data: Student[]) => {
    console.log('[GymContext] Persisting students:', data.length);
    setStudents(data);
    await saveToLocal(STORAGE_KEYS.students, data);
    setStudentsMutation.mutate({ students: data });
  }, [setStudentsMutation, saveToLocal]);

  const persistBookings = useCallback(async (data: Booking[]) => {
    console.log('[GymContext] Persisting bookings:', data.length);
    setBookings(data);
    await saveToLocal(STORAGE_KEYS.bookings, data);
    setBookingsMutation.mutate({ bookings: data });
  }, [setBookingsMutation, saveToLocal]);

  const persistBlockedSlots = useCallback(async (data: BlockedSlot[]) => {
    console.log('[GymContext] Persisting blocked slots:', data.length);
    setBlockedSlots(data);
    await saveToLocal(STORAGE_KEYS.blockedSlots, data);
    setBlockedSlotsMutation.mutate({ blockedSlots: data });
  }, [setBlockedSlotsMutation, saveToLocal]);

  const persistPayments = useCallback(async (data: PaymentRecord[]) => {
    console.log('[GymContext] Persisting payments:', data.length);
    setPayments(data);
    await saveToLocal(STORAGE_KEYS.payments, data);
    setPaymentsMutation.mutate({ payments: data });
  }, [setPaymentsMutation, saveToLocal]);

  const persistPricing = useCallback(async (data: PricingConfig) => {
    console.log('[GymContext] Persisting pricing:', data);
    setPricing(data);
    await saveToLocal(STORAGE_KEYS.pricing, data);
    setPricingMutation.mutate({ pricing: data });
  }, [setPricingMutation, saveToLocal]);

  const loginMutation = useMutation({
    mutationFn: async ({
      role,
      firstName,
      lastName,
      phone,
      currentStudents,
    }: {
      role: UserRole;
      firstName?: string;
      lastName?: string;
      phone?: string;
      currentStudents: Student[];
    }) => {
      if (role === 'admin') {
        const user: CurrentUser = { role: 'admin' };
        await AsyncStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(user));
        return { user, students: currentStudents };
      }

      const normalizedFirst = (firstName ?? '').trim();
      const normalizedLast = (lastName ?? '').trim();
      const normalizedPhone = (phone ?? '').trim();

      let student = currentStudents.find(
        (s) =>
          s.firstName.toLowerCase() === normalizedFirst.toLowerCase() &&
          s.lastName.toLowerCase() === normalizedLast.toLowerCase()
      );

      let updatedStudents = currentStudents;
      if (!student) {
        student = {
          id: generateId(),
          firstName: normalizedFirst,
          lastName: normalizedLast,
          phone: normalizedPhone,
          createdAt: new Date().toISOString(),
        };
        updatedStudents = [...currentStudents, student];
        console.log('[GymContext] New student created:', student.firstName, student.lastName);
      } else {
        if (normalizedPhone && student.phone !== normalizedPhone) {
          student = { ...student, phone: normalizedPhone };
          updatedStudents = currentStudents.map((s) =>
            s.id === student!.id ? student! : s
          );
          console.log('[GymContext] Student phone updated');
        }
        console.log('[GymContext] Existing student found:', student.firstName, student.lastName);
      }

      const user: CurrentUser = { role: 'student', studentId: student.id };
      await AsyncStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(user));
      return { user, students: updatedStudents };
    },
    onSuccess: (data) => {
      setCurrentUser(data.user);
      persistStudents(data.students);
    },
  });

  const { mutateAsync: loginAsync, isPending: loginPending } = loginMutation;

  const login = useCallback(
    async (role: UserRole, firstName?: string, lastName?: string, phone?: string) => {
      await loginAsync({
        role,
        firstName,
        lastName,
        phone,
        currentStudents: students,
      });
    },
    [loginAsync, students]
  );

  const logout = useCallback(async () => {
    console.log('[GymContext] Logging out');
    setCurrentUser(null);
    await AsyncStorage.removeItem(STORAGE_KEYS.currentUser);
  }, []);

  const addBooking = useCallback(
    async (studentId: string, dayOfWeek: number, hour: number) => {
      const existingCount = bookings.filter(
        (b) => b.dayOfWeek === dayOfWeek && b.hour === hour
      ).length;
      if (existingCount >= MAX_CAPACITY) {
        throw new Error('Turno completo');
      }

      const isBlocked = blockedSlots.some(
        (s) => s.dayOfWeek === dayOfWeek && s.hour === hour
      );
      if (isBlocked) {
        throw new Error('Turno bloqueado');
      }

      const alreadyBooked = bookings.some(
        (b) =>
          b.studentId === studentId &&
          b.dayOfWeek === dayOfWeek &&
          b.hour === hour
      );
      if (alreadyBooked) {
        throw new Error('Ya estás anotado en este turno');
      }

      const booking: Booking = {
        id: generateId(),
        studentId,
        dayOfWeek,
        hour,
      };
      const updated = [...bookings, booking];
      persistBookings(updated);
      console.log('[GymContext] Booking added:', dayOfWeek, hour);
      return booking;
    },
    [bookings, blockedSlots, persistBookings]
  );

  const removeBooking = useCallback(
    async (bookingId: string) => {
      const updated = bookings.filter((b) => b.id !== bookingId);
      persistBookings(updated);
      console.log('[GymContext] Booking removed:', bookingId);
    },
    [bookings, persistBookings]
  );

  const blockSlot = useCallback(
    async (dayOfWeek: number, hour: number, reason: string) => {
      const blocked: BlockedSlot = {
        id: generateId(),
        dayOfWeek,
        hour,
        reason,
      };
      const updatedBlocked = [...blockedSlots, blocked];
      persistBlockedSlots(updatedBlocked);

      const updatedBookings = bookings.filter(
        (b) => !(b.dayOfWeek === dayOfWeek && b.hour === hour)
      );
      persistBookings(updatedBookings);
      console.log('[GymContext] Slot blocked:', dayOfWeek, hour, reason);
    },
    [blockedSlots, bookings, persistBlockedSlots, persistBookings]
  );

  const unblockSlot = useCallback(
    async (dayOfWeek: number, hour: number) => {
      const updated = blockedSlots.filter(
        (s) => !(s.dayOfWeek === dayOfWeek && s.hour === hour)
      );
      persistBlockedSlots(updated);
      console.log('[GymContext] Slot unblocked:', dayOfWeek, hour);
    },
    [blockedSlots, persistBlockedSlots]
  );

  const togglePayment = useCallback(
    async (studentId: string, month: string, method?: 'manual' | 'mercadopago') => {
      const existing = payments.find(
        (p) => p.studentId === studentId && p.month === month
      );
      let updated: PaymentRecord[];
      if (existing) {
        updated = payments.map((p) =>
          p.studentId === studentId && p.month === month
            ? { ...p, paid: !p.paid, method: !p.paid ? (method ?? 'manual') : undefined }
            : p
        );
      } else {
        updated = [...payments, { studentId, month, paid: true, method: method ?? 'manual' }];
      }
      persistPayments(updated);
      console.log('[GymContext] Payment toggled:', studentId, month);
    },
    [payments, persistPayments]
  );

  const updatePricing = useCallback(
    async (newPricing: PricingConfig) => {
      persistPricing(newPricing);
      console.log('[GymContext] Pricing updated:', newPricing);
    },
    [persistPricing]
  );

  const bulkImportStudents = useCallback(
    async (rows: { firstName: string; lastName: string; phone: string; dayOfWeek?: number; hour?: number }[]) => {
      const currentStudents = [...students];
      const currentBookings = [...bookings];
      let importedStudents = 0;
      let importedBookings = 0;
      let skipped = 0;

      const studentMap = new Map<string, Student>();
      for (const s of currentStudents) {
        studentMap.set(`${s.firstName.toLowerCase()}|${s.lastName.toLowerCase()}`, s);
      }

      for (const row of rows) {
        const normalizedFirst = row.firstName.trim();
        const normalizedLast = row.lastName.trim();
        const normalizedPhone = row.phone.trim();

        if (!normalizedFirst || !normalizedLast) {
          skipped++;
          continue;
        }

        const key = `${normalizedFirst.toLowerCase()}|${normalizedLast.toLowerCase()}`;
        let student = studentMap.get(key);

        if (!student) {
          student = {
            id: generateId(),
            firstName: normalizedFirst,
            lastName: normalizedLast,
            phone: normalizedPhone,
            createdAt: new Date().toISOString(),
          };
          currentStudents.push(student);
          studentMap.set(key, student);
          importedStudents++;
        } else if (normalizedPhone && !student.phone) {
          student = { ...student, phone: normalizedPhone };
          const idx = currentStudents.findIndex((s) => s.id === student!.id);
          if (idx >= 0) currentStudents[idx] = student;
          studentMap.set(key, student);
        }

        if (row.dayOfWeek !== undefined && row.hour !== undefined) {
          const alreadyBooked = currentBookings.some(
            (b) =>
              b.studentId === student!.id &&
              b.dayOfWeek === row.dayOfWeek &&
              b.hour === row.hour
          );
          const slotCount = currentBookings.filter(
            (b) => b.dayOfWeek === row.dayOfWeek && b.hour === row.hour
          ).length;
          const isBlockedSlot = blockedSlots.some(
            (s) => s.dayOfWeek === row.dayOfWeek && s.hour === row.hour
          );

          if (!alreadyBooked && slotCount < MAX_CAPACITY && !isBlockedSlot) {
            const booking: Booking = {
              id: generateId(),
              studentId: student.id,
              dayOfWeek: row.dayOfWeek,
              hour: row.hour,
            };
            currentBookings.push(booking);
            importedBookings++;
          }
        }
      }

      await persistStudents(currentStudents);
      await persistBookings(currentBookings);

      console.log(`[GymContext] Bulk import: ${importedStudents} students, ${importedBookings} bookings, ${skipped} skipped`);
      return { imported: importedStudents, skipped, importedBookings };
    },
    [students, bookings, blockedSlots, persistStudents, persistBookings]
  );

  const removeAllStudents = useCallback(
    async () => {
      await persistStudents([]);
      await persistBookings([]);
      await persistPayments([]);
      console.log('[GymContext] All students removed');
    },
    [persistStudents, persistBookings, persistPayments]
  );

  const removeStudent = useCallback(
    async (studentId: string) => {
      const updatedStudents = students.filter((s) => s.id !== studentId);
      await persistStudents(updatedStudents);

      const updatedBookings = bookings.filter((b) => b.studentId !== studentId);
      await persistBookings(updatedBookings);

      const updatedPayments = payments.filter((p) => p.studentId !== studentId);
      await persistPayments(updatedPayments);
      console.log('[GymContext] Student removed:', studentId);
    },
    [students, bookings, payments, persistStudents, persistBookings, persistPayments]
  );

  const getSlotBookings = useCallback(
    (dayOfWeek: number, hour: number) => {
      return bookings.filter(
        (b) => b.dayOfWeek === dayOfWeek && b.hour === hour
      );
    },
    [bookings]
  );

  const getSlotAvailability = useCallback(
    (dayOfWeek: number, hour: number) => {
      const count = bookings.filter(
        (b) => b.dayOfWeek === dayOfWeek && b.hour === hour
      ).length;
      return MAX_CAPACITY - count;
    },
    [bookings]
  );

  const isSlotBlocked = useCallback(
    (dayOfWeek: number, hour: number) => {
      return blockedSlots.some(
        (s) => s.dayOfWeek === dayOfWeek && s.hour === hour
      );
    },
    [blockedSlots]
  );

  const getBlockedSlot = useCallback(
    (dayOfWeek: number, hour: number) => {
      return blockedSlots.find(
        (s) => s.dayOfWeek === dayOfWeek && s.hour === hour
      );
    },
    [blockedSlots]
  );

  const isPaymentDone = useCallback(
    (studentId: string, month: string) => {
      const record = payments.find(
        (p) => p.studentId === studentId && p.month === month
      );
      return record?.paid ?? false;
    },
    [payments]
  );

  const getPaymentRecord = useCallback(
    (studentId: string, month: string) => {
      return payments.find(
        (p) => p.studentId === studentId && p.month === month
      ) ?? null;
    },
    [payments]
  );

  const getCurrentStudent = useCallback(() => {
    if (!currentUser || currentUser.role !== 'student') return null;
    return students.find((s) => s.id === currentUser.studentId) ?? null;
  }, [currentUser, students]);

  const getStudentBookings = useCallback(
    (studentId: string) => {
      return bookings.filter((b) => b.studentId === studentId);
    },
    [bookings]
  );

  const getStudentById = useCallback(
    (studentId: string) => {
      return students.find((s) => s.id === studentId) ?? null;
    },
    [students]
  );

  const getStudentUniqueDays = useCallback(
    (studentId: string) => {
      const studentBookings = bookings.filter((b) => b.studentId === studentId);
      const uniqueDays = new Set(studentBookings.map((b) => b.dayOfWeek));
      return uniqueDays.size;
    },
    [bookings]
  );

  const getUnpaidStudents = useCallback(
    (month: string) => {
      return students.filter((s) => !isPaymentDone(s.id, month));
    },
    [students, isPaymentDone]
  );

  const paidCount = useMemo(() => {
    return (month: string) =>
      payments.filter((p) => p.month === month && p.paid).length;
  }, [payments]);

  return {
    currentUser,
    students,
    bookings,
    blockedSlots,
    payments,
    pricing,
    isLoading: (!localLoaded && localDataQuery.isLoading),
    loginPending,
    login,
    logout,
    addBooking,
    removeBooking,
    blockSlot,
    unblockSlot,
    togglePayment,
    updatePricing,
    removeStudent,
    removeAllStudents,
    getSlotBookings,
    getSlotAvailability,
    isSlotBlocked,
    getBlockedSlot,
    isPaymentDone,
    getPaymentRecord,
    getCurrentStudent,
    getStudentBookings,
    getStudentById,
    getStudentUniqueDays,
    getUnpaidStudents,
    paidCount,
    bulkImportStudents,
  };
});
