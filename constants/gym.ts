export const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'] as const;
export const DAYS_SHORT = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE'] as const;
export const HOURS = Array.from({ length: 15 }, (_, i) => i + 7);
export const MAX_CAPACITY = 8;
export const ADMIN_PASSWORD = 'gym2026';
export const LOW_SPOTS_THRESHOLD = 3;

export const DEFAULT_PRICING = {
  twoDays: 15000,
  threeDays: 20000,
  fourPlusDays: 25000,
  mercadoPagoLink: '',
};

export const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
] as const;

export const STORAGE_KEYS = {
  students: 'gym_students',
  bookings: 'gym_bookings',
  blockedSlots: 'gym_blocked_slots',
  payments: 'gym_payments',
  currentUser: 'gym_current_user',
  pricing: 'gym_pricing',
} as const;

export function formatHour(hour: number): string {
  return `${hour.toString().padStart(2, '0')}:00`;
}

export function formatHourRange(hour: number): string {
  return `${formatHour(hour)} - ${formatHour(hour + 1)}`;
}

export function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
}

export function getMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  return `${MONTHS[parseInt(month, 10) - 1]} ${year}`;
}

export function getTodayDayIndex(): number {
  const day = new Date().getDay();
  if (day === 0 || day === 6) return 0;
  return day - 1;
}

export function formatPrice(amount: number): string {
  return `$${amount.toLocaleString('es-AR')}`;
}

export function getPriceForDays(days: number, pricing: { twoDays: number; threeDays: number; fourPlusDays: number }): number {
  if (days <= 2) return pricing.twoDays;
  if (days === 3) return pricing.threeDays;
  return pricing.fourPlusDays;
}

export function getPriceLabelForDays(days: number): string {
  if (days <= 2) return '2 días';
  if (days === 3) return '3 días';
  return '4+ días';
}

export function formatPhoneForWhatsApp(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  if (cleaned.startsWith('15') && cleaned.length <= 10) {
    cleaned = cleaned.substring(2);
  }
  if (!cleaned.startsWith('54')) {
    cleaned = '54' + cleaned;
  }
  if (cleaned.startsWith('549') && cleaned.length === 13) {
    return cleaned;
  }
  if (cleaned.startsWith('54') && !cleaned.startsWith('549')) {
    const rest = cleaned.substring(2);
    cleaned = '549' + rest;
  }
  return cleaned;
}
