import * as React from "react"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "default", size = "default", style, disabled, ...props }, ref) => {
    const baseStyles: React.CSSProperties = {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "6px",
      fontSize: "14px",
      fontWeight: "500",
      transition: "all 0.2s",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      border: "none",
      outline: "none",
    }

    const variants = {
      default: {
        backgroundColor: "#2563eb",
        color: "white",
        ":hover": { backgroundColor: "#1d4ed8" },
      },
      destructive: {
        backgroundColor: "#dc2626",
        color: "white",
        ":hover": { backgroundColor: "#b91c1c" },
      },
      outline: {
        border: "1px solid #d1d5db",
        backgroundColor: "white",
        color: "#374151",
        ":hover": { backgroundColor: "#f9fafb" },
      },
      secondary: {
        backgroundColor: "#f3f4f6",
        color: "#111827",
        ":hover": { backgroundColor: "#e5e7eb" },
      },
      ghost: {
        backgroundColor: "transparent",
        color: "#374151",
        ":hover": { backgroundColor: "#f3f4f6" },
      },
      link: {
        backgroundColor: "transparent",
        color: "#2563eb",
        textDecoration: "underline",
        ":hover": { textDecoration: "none" },
      },
    }

    const sizes = {
      default: { height: "40px", padding: "0 16px" },
      sm: { height: "36px", padding: "0 12px" },
      lg: { height: "44px", padding: "0 32px" },
      icon: { height: "40px", width: "40px", padding: "0" },
    }

    const variantStyles = variants[variant]
    const sizeStyles = sizes[size]

    return (
      <button
        ref={ref}
        style={{
          ...baseStyles,
          ...variantStyles,
          ...sizeStyles,
          ...style,
        }}
        disabled={disabled}
        {...props}
      />
    )
  },
)
Button.displayName = "Button"

export { Button }
