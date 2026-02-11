export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  createdAt: string;
}

export interface Booking {
  id: string;
  studentId: string;
  dayOfWeek: number;
  hour: number;
}

export interface BlockedSlot {
  id: string;
  dayOfWeek: number;
  hour: number;
  reason: string;
}

export interface PaymentRecord {
  studentId: string;
  month: string;
  paid: boolean;
  method?: 'manual' | 'mercadopago';
}

export interface PricingConfig {
  twoDays: number;
  threeDays: number;
  fourPlusDays: number;
  mercadoPagoLink: string;
}

export type UserRole = 'student' | 'admin';

export interface CurrentUser {
  role: UserRole;
  studentId?: string;
}
