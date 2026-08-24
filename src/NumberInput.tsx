import { useEffect, useRef, useState, type FocusEvent, type InputHTMLAttributes } from "react";
import { numberInputValue } from "./lib/input";

interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "defaultValue" | "onChange"> {
  value: number | null | undefined;
  onRawChange: (value: string) => void;
}

function draftValue(value: number | null | undefined): string {
  const displayValue = numberInputValue(value);
  return displayValue === "" ? "" : String(displayValue);
}

function NumberInput({ value, onRawChange, onFocus, onBlur, ...props }: NumberInputProps) {
  const [draft, setDraft] = useState(() => draftValue(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(draftValue(value));
  }, [value]);

  const handleFocus = (event: FocusEvent<HTMLInputElement>) => {
    focused.current = true;
    onFocus?.(event);
  };

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    focused.current = false;
    setDraft(draftValue(value));
    onBlur?.(event);
  };

  return (
    <input
      {...props}
      type="number"
      value={draft}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onChange={(event) => {
        setDraft(event.target.value);
        onRawChange(event.target.value);
      }}
    />
  );
}

export default NumberInput;
