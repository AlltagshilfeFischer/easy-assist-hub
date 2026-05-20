import { cn } from '@/lib/utils';
import { type ChangeEvent, useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';

interface TimeInputProps {
  value: string; // "HH:MM"
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

export function TimeInput({ value, onChange, className, disabled }: TimeInputProps) {
  const [raw, setRaw] = useState(value);

  useEffect(() => {
    setRaw(value);
  }, [value]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/[^0-9:]/g, '');

    // Auto-insert colon after 2 digits when typing forward
    if (v.length === 2 && !v.includes(':') && raw.length <= 2) {
      v = v + ':';
    }

    if (v.length > 5) return;
    setRaw(v);

    const match = v.match(/^([0-2]?\d):([0-5]\d)$/);
    if (match) {
      const h = parseInt(match[1]);
      const m = parseInt(match[2]);
      if (h >= 0 && h <= 23) {
        onChange(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    }
  };

  const handleBlur = () => {
    const match = raw.match(/^([0-2]?\d):([0-5]\d)$/);
    if (!match) setRaw(value);
  };

  return (
    <Input
      type="text"
      inputMode="numeric"
      value={raw}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder="HH:MM"
      maxLength={5}
      className={cn(className)}
      disabled={disabled}
    />
  );
}
