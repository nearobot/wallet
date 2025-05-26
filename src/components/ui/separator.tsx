import * as React from "react"

export interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical"
}

const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  ({ orientation = "horizontal", style, ...props }, ref) => (
    <div
      ref={ref}
      style={{
        flexShrink: 0,
        backgroundColor: "#e5e7eb",
        ...(orientation === "horizontal" ? { height: "1px", width: "100%" } : { height: "100%", width: "1px" }),
        ...style,
      }}
      {...props}
    />
  ),
)
Separator.displayName = "Separator"

export { Separator }
