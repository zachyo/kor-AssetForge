import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAmount(
  amount: number | string,
  decimals: number = 7,
): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(num);
}

export function formatCurrency(
  amount: number | string,
  currency: string = "USD",
): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(num);
}

export function truncateAddress(
  address: string,
  startChars: number = 6,
  endChars: number = 4,
): string {
  if (!address) return "";
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

export function formatDate(timestamp: number | string): string {
  const date =
    typeof timestamp === "string"
      ? new Date(timestamp)
      : new Date(timestamp * 1000);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
