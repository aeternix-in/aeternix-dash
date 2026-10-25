import * as React from "react";
import { cn } from "@/lib/utils";

export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" }
>(({ className, variant = "primary", ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
      variant === "primary" && "bg-accent text-white hover:bg-accent-hover",
      variant === "secondary" && "border border-line-strong bg-surface text-ink hover:bg-canvas",
      variant === "ghost" && "text-muted hover:bg-canvas hover:text-ink",
      className
    )}
    {...props}
  />
));
Button.displayName = "Button";

export const controlClass =
  "h-9 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-faint disabled:bg-canvas aria-[invalid=true]:border-danger";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(controlClass, className)} {...props} />
);
Input.displayName = "Input";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { options: readonly string[]; placeholder?: string }
>(({ className, options, placeholder = "Select…", ...props }, ref) => (
  <select ref={ref} className={cn(controlClass, "pr-8", className)} {...props}>
    <option value="">{placeholder}</option>
    {options.map((o) => (
      <option key={o} value={o}>
        {o}
      </option>
    ))}
  </select>
));
Select.displayName = "Select";

export function Field({
  label, hint, error, optional, children, className,
}: {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-sm font-medium text-ink">
        {label}
        {optional && <span className="ml-1.5 font-normal text-faint">optional</span>}
      </span>
      {children}
      {error ? (
        <span className="text-xs text-danger">{error}</span>
      ) : hint ? (
        <span className="text-xs text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border border-line bg-surface", className)} {...props} />;
}

const badgeTones = {
  neutral: "bg-canvas text-muted",
  accent: "bg-accent-soft text-accent",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
};

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof badgeTones; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded px-2 py-0.5 text-xs font-medium", badgeTones[tone])}>
      {children}
    </span>
  );
}

export function statusTone(status: string): keyof typeof badgeTones {
  if (["Settled"].includes(status)) return "ok";
  if (["Denied", "Written off"].includes(status)) return "danger";
  if (["Under query", "Part-settled", "Moved to reimbursement"].includes(status)) return "warn";
  if (["Approved", "Awaiting settlement"].includes(status)) return "accent";
  return "neutral";
}
