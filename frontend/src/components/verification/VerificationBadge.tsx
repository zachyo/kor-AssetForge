"use client";

import { cn } from "@/lib/utils";
import { ShieldCheck, ShieldOff, Clock } from "lucide-react";

type VerificationBadgeStatus = "verified" | "pending" | "unverified";

interface VerificationBadgeProps {
  status: VerificationBadgeStatus;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const config: Record<
  VerificationBadgeStatus,
  { label: string; icon: React.ReactNode; classes: string }
> = {
  verified: {
    label: "Verified",
    icon: <ShieldCheck className="shrink-0" />,
    classes: "bg-green-100 text-green-800 border-green-300",
  },
  pending: {
    label: "Pending Review",
    icon: <Clock className="shrink-0" />,
    classes: "bg-yellow-100 text-yellow-800 border-yellow-300",
  },
  unverified: {
    label: "Unverified",
    icon: <ShieldOff className="shrink-0" />,
    classes: "bg-gray-100 text-gray-600 border-gray-300",
  },
};

const sizeClasses = {
  sm: "text-xs px-2 py-0.5 gap-1 [&_svg]:h-3 [&_svg]:w-3",
  md: "text-sm px-2.5 py-1 gap-1.5 [&_svg]:h-4 [&_svg]:w-4",
  lg: "text-base px-3 py-1.5 gap-2 [&_svg]:h-5 [&_svg]:w-5",
};

export function VerificationBadge({
  status,
  size = "md",
  className,
}: VerificationBadgeProps) {
  const { label, icon, classes } = config[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        classes,
        sizeClasses[size],
        className
      )}
    >
      {icon}
      {label}
    </span>
  );
}