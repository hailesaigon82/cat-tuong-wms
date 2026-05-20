// src/components/ui/index.tsx
"use client";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import React from "react";
import { createPortal } from "react-dom";

// ─── Badge ────────────────────────────────────────────────────────────────────
const badgeVariants: Record<string, string> = {
  admin: "bg-purple-100 text-purple-800",
  manager: "bg-blue-100 text-blue-800",
  office: "bg-amber-100 text-amber-800",
  warehouse: "bg-green-100 text-green-800",
  N: "bg-blue-100 text-blue-800",
  R: "bg-yellow-100 text-yellow-800",
  H: "bg-green-100 text-green-800",
  in: "bg-green-100 text-green-800",
  out: "bg-red-100 text-red-800",
  adj: "bg-amber-100 text-amber-800",
};

export function Badge({ variant, children, className }: { variant: string; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-block px-2 py-0.5 rounded-full text-xs font-medium", badgeVariants[variant] ?? "bg-gray-100 text-gray-700", className)}>
      {children}
    </span>
  );
}

// ─── Button ───────────────────────────────────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "success" | "danger" | "outline" | "ghost";
  size?: "sm" | "md";
}

export function Button({ variant = "outline", size = "md", className, children, ...props }: ButtonProps) {
  const base = "inline-flex items-center gap-1.5 font-medium rounded-lg border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
  const sizes = { sm: "px-2.5 py-1 text-xs", md: "px-3.5 py-2 text-sm" };
  const variants = {
    primary: "bg-[#185FA5] text-white border-[#185FA5] hover:bg-[#0c447c]",
    success: "bg-[#3B6D11] text-white border-[#3B6D11] hover:bg-[#2d540d]",
    danger: "bg-[#A32D2D] text-white border-[#A32D2D] hover:bg-[#7d2222]",
    outline: "bg-white text-gray-700 border-gray-300 hover:bg-gray-50",
    ghost: "bg-transparent text-gray-600 border-transparent hover:bg-gray-100",
  };
  return (
    <button className={cn(base, sizes[size], variants[variant], className)} {...props}>
      {children}
    </button>
  );
}

// ─── Alert ────────────────────────────────────────────────────────────────────
export function Alert({ type, message }: { type: "error" | "success" | "warning"; message: string }) {
  const styles = {
    error: "bg-[#FCEBEB] text-[#A32D2D] border border-red-200",
    success: "bg-[#EAF3DE] text-[#3B6D11] border border-green-200",
    warning: "bg-[#FAEEDA] text-[#854F0B] border border-amber-200",
  };
  return <div className={cn("px-3.5 py-2.5 rounded-lg text-sm", styles[type])}>{message}</div>;
}

// ─── Modal ────────────────────────────────────────────────────────────────────
interface ModalProps {
  title: string;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string;
}

export function Modal({ title, onClose, footer, children, maxWidth = "max-w-lg" }: ModalProps) {
  const [mounted, setMounted] = React.useState(false);
  const dialogRef = React.useRef<HTMLDivElement | null>(null);
  const onCloseRef = React.useRef(onClose);
  const titleId = React.useId();

  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!mounted) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [mounted]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn("bg-white rounded-xl w-full overflow-y-auto max-h-[90vh] shadow-xl fade-in", maxWidth)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 id={titleId} className="text-base font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Đóng">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-gray-200 flex gap-2 justify-end">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-white border border-gray-200 rounded-lg overflow-hidden mb-5", className)}>
      {children}
    </div>
  );
}

export function CardHeader({ title, actions }: { title: string; actions?: React.ReactNode }) {
  return (
    <div className="px-4 py-3.5 border-b border-gray-200 flex items-center justify-between">
      <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
      {actions}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
export function KpiCard({ label, value, sub, variant }: { label: string; value: string | number; sub?: string; variant?: "danger" | "success" }) {
  const valueColor = variant === "danger" ? "text-[#A32D2D]" : variant === "success" ? "text-[#3B6D11]" : "text-gray-900";
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="text-xs text-gray-500 mb-1.5">{label}</div>
      <div className={cn("text-2xl font-semibold leading-tight", valueColor)}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

// ─── Form primitives ──────────────────────────────────────────────────────────
export function FormGroup({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-gray-600">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-[#185FA5] transition-colors";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputClass, props.className)} {...props} />;
}

export function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(inputClass, "bg-white")} {...props}>
      {children}
    </select>
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputClass, "resize-none")} {...props} />;
}

// ─── Table ────────────────────────────────────────────────────────────────────
export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2.5 text-left bg-gray-50 text-gray-500 font-medium text-xs border-b border-gray-200 whitespace-nowrap">{children}</th>;
}

export function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-3 py-2.5 border-b border-gray-100 text-gray-700", className)}>{children}</td>;
}
