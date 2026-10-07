import { useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import { toDisplay, fromDisplay, roundForInput } from '../../utils/units';
import type { QuantityType, UnitSystem } from '../../utils/units';

interface QuantityInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  /** Current value in internal units (kip, in, ksi). */
  value: number;
  qty: QuantityType;
  unitSystem: UnitSystem;
  /** Receives the typed value converted to internal units. Empty input is 0. */
  onChange: (internalValue: number) => void;
}

interface Draft {
  text: string;
  unitSystem: UnitSystem;
  /** The internal value this text was committed as. */
  value: number;
}

/**
 * Number field that shows a value in display units and stores it in
 * internal units. The parent always holds the internal value, so switching
 * the unit system mid-edit re-renders the field in the new unit instead of
 * reinterpreting a stale number. Rounding applies to the display only.
 */
export function QuantityInput({ value, qty, unitSystem, onChange, onBlur, ...rest }: QuantityInputProps) {
  // While typing, keep the raw text so partial entries such as "0." or "-"
  // are not rewritten. The draft is ignored once it no longer matches the
  // stored value or the unit system it was typed in.
  const [draft, setDraft] = useState<Draft | null>(null);

  const shown =
    draft && draft.unitSystem === unitSystem && draft.value === value
      ? draft.text
      : String(roundForInput(toDisplay(value, qty, unitSystem)));

  return (
    <input
      type="number"
      step="any"
      {...rest}
      value={shown}
      onChange={(e) => {
        const text = e.target.value;
        const parsed = parseFloat(text);
        const internal = Number.isFinite(parsed) ? fromDisplay(parsed, qty, unitSystem) : 0;
        setDraft({ text, unitSystem, value: internal });
        onChange(internal);
      }}
      onBlur={(e) => {
        setDraft(null);
        onBlur?.(e);
      }}
    />
  );
}
