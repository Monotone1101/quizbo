import { cva, type VariantProps } from "class-variance-authority";
import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** shadcn-style button, restyled to Industry: square, hairline, one solid accent primary. */
export const buttonVariants = cva("btn", {
  variants: {
    variant: {
      primary: "btn-primary",
      secondary: "btn-secondary",
      ghost: "btn-ghost",
      onDark: "btn-on-dark",
    },
    size: {
      md: "",
      sm: "text-[11px] px-[9px] py-[5px]",
      lg: "text-[20px] p-[14px] tracking-[.05em]",
      icon: "btn-icon",
    },
    block: { true: "btn-block", false: "" },
  },
  defaultVariants: { variant: "secondary", size: "md", block: false },
});

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, block, type = "button", ...props }: ComponentProps<"button"> & ButtonVariantProps) {
  return <button type={type} className={cn(buttonVariants({ variant, size, block }), className)} {...props} />;
}

export function ButtonLink({ className, variant, size, block, ...props }: ComponentProps<typeof Link> & ButtonVariantProps) {
  return <Link className={cn(buttonVariants({ variant, size, block }), className)} {...props} />;
}
