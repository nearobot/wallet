import * as React from "react"

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "destructive" }
>(({ variant = "default", style, ...props }, ref) => {
  const variants = {
    default: {
      backgroundColor: "white",
      color: "#111827",
      border: "1px solid #e5e7eb",
    },
    destructive: {
      backgroundColor: "#fef2f2",
      color: "#7f1d1d",
      border: "1px solid #fecaca",
    },
  }

  const variantStyles = variants[variant]

  return (
    <div
      ref={ref}
      role="alert"
      style={{
        position: "relative",
        width: "100%",
        borderRadius: "8px",
        padding: "16px",
        ...variantStyles,
        ...style,
      }}
      {...props}
    />
  )
})
Alert.displayName = "Alert"

const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ style, ...props }, ref) => (
    <div
      ref={ref}
      style={{
        fontSize: "14px",
        ...style,
      }}
      {...props}
    />
  ),
)
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertDescription }
