export function formatCurrency(amount: number, currency = 'Ar'): string {
  const symbols: Record<string, string> = {
    Ar: 'Ar',
    EUR: '€',
    USD: '$',
    FCFA: 'FCFA',
  };
  const symbol = symbols[currency] || currency;

  if (currency === 'Ar' || currency === 'FCFA') {
    return `${new Intl.NumberFormat('fr-FR').format(Math.round(amount))} ${symbol}`;
  }
  return `${symbol} ${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}`;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(date);
}

export function formatMonthYear(month: number, year: number): string {
  const date = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(date);
}

export function getCurrentMonth(): { month: number; year: number } {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

export function toInputDate(dateStr: string): string {
  return dateStr.split('T')[0];
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}
