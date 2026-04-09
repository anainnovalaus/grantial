
import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronUp, ChevronDown } from "lucide-react"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onArrowClick?: (value: number | undefined) => void;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, onArrowClick, ...props }, ref) => {
    const isNumberInput = type === "number"
    const innerRef = React.useRef<HTMLInputElement | null>(null)
    
    // Combine the forwarded ref with our internal ref
    React.useImperativeHandle(ref, () => innerRef.current as HTMLInputElement)
    
    const handleArrowClick = (direction: 'up' | 'down') => {
      const input = innerRef.current
      if (input && onArrowClick) {
        const currentValue = input.value ? parseFloat(input.value) : undefined
        const step = parseFloat(input.step) || 1
        const min = input.min ? parseFloat(input.min) : undefined
        const max = input.max ? parseFloat(input.max) : undefined
        
        let newValue: number | undefined
        
        if (currentValue === undefined) {
          newValue = direction === 'up' ? (min !== undefined ? min : 0) : (min !== undefined ? min : 0)
        } else {
          newValue = direction === 'up' ? currentValue + step : currentValue - step
        }
        
        // Apply min/max constraints
        if (min !== undefined && newValue < min) newValue = min
        if (max !== undefined && newValue > max) newValue = max
        
        // Update the input value for visual feedback
        input.value = newValue.toString()
        
        // Dispatch events for any listeners
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
        
        // Call the custom handler with the new value
        onArrowClick(newValue)
      }
    }
    
    return (
      <div className={isNumberInput ? "relative" : undefined}>
        <input
          type={type}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            isNumberInput && "pr-8", // Add padding for the arrows
            isNumberInput && "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none", // Hide default arrows
            className
          )}
          ref={innerRef}
          {...props}
        />
        {isNumberInput && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col">
            <button
              type="button"
              tabIndex={-1}
              className="flex h-4 w-4 items-center justify-center text-muted-foreground hover:text-foreground transition-colors p-0.5"
              onClick={(e) => {
                e.preventDefault(); // Prevent form submission
                handleArrowClick('up');
              }}
            >
              <ChevronUp className="h-3 w-3" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              className="flex h-4 w-4 items-center justify-center text-muted-foreground hover:text-foreground transition-colors p-0.5"
              onClick={(e) => {
                e.preventDefault(); // Prevent form submission
                handleArrowClick('down');
              }}
            >
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }
