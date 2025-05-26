import type * as React from "react"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline"
}

function Badge({ variant = "default", style, ...props }: BadgeProps) {
  const variants = {
    default: {
      backgroundColor: "#2563eb",
      color: "white",
      border: "1px solid transparent",
    },
    secondary: {
      backgroundColor: "#f3f4f6",
      color: "#111827",
      border: "1px solid transparent",
    },
    destructive: {
      backgroundColor: "#dc2626",
      color: "white",
      border: "1px solid transparent",
    },
    outline: {
      backgroundColor: "transparent",
      color: "#111827",
      border: "1px solid #d1d5db",
    },
  }

  const variantStyles = variants[variant]

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: "9999px",
        padding: "2px 10px",
        fontSize: "12px",
        fontWeight: "600",
        transition: "colors 0.2s",
        ...variantStyles,
        ...style,
      }}
      {...props}
    />
  )
}

export { Badge }
