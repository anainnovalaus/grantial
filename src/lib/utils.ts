
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatAmount(amount: string | undefined): string {
  if (!amount) return "";
  
  // Remove any existing currency symbols or formatting
  const cleanAmount = amount.replace(/[€$.,\s]/g, "");
  
  // Check if it's a valid number
  const numericAmount = Number(cleanAmount);
  if (isNaN(numericAmount)) return amount;
  
  // Format with Spanish locale (dots as thousand separators) and add € symbol
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(numericAmount);
}

export function formatNumber(value: number | string | undefined): string {
  if (value === undefined || value === null || value === '') return "No especificado";
  return value.toString();
}
