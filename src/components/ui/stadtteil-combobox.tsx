import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { HANNOVER_STADTTEILE } from '@/lib/hannover-stadtteile';

interface StadtteilComboboxProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
}

export function StadtteilCombobox({ value, onChange, id }: StadtteilComboboxProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const isKnown = HANNOVER_STADTTEILE.includes(value as (typeof HANNOVER_STADTTEILE)[number]);

  const handleSelect = (selected: string) => {
    onChange(selected === value ? '' : selected);
    setOpen(false);
    setInputValue('');
  };

  // Freie Eingabe: Enter bestätigt den eingetippten Wert
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      const exact = HANNOVER_STADTTEILE.find(
        (s) => s.toLowerCase() === inputValue.trim().toLowerCase()
      );
      onChange(exact ?? inputValue.trim());
      setOpen(false);
      setInputValue('');
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between font-normal', !value && 'text-muted-foreground')}
        >
          {value || 'Stadtteil wählen…'}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Stadtteil suchen…"
            value={inputValue}
            onValueChange={setInputValue}
            onKeyDown={handleKeyDown}
          />
          <CommandList>
            <CommandEmpty>
              {inputValue.trim() ? (
                <button
                  className="w-full px-3 py-2 text-sm text-left hover:bg-accent"
                  onClick={() => {
                    onChange(inputValue.trim());
                    setOpen(false);
                    setInputValue('');
                  }}
                >
                  „{inputValue.trim()}" übernehmen
                </button>
              ) : (
                <span className="px-3 py-2 text-sm text-muted-foreground">Kein Treffer</span>
              )}
            </CommandEmpty>
            <CommandGroup>
              {HANNOVER_STADTTEILE.map((stadtteil) => (
                <CommandItem key={stadtteil} value={stadtteil} onSelect={handleSelect}>
                  <Check
                    className={cn('mr-2 h-4 w-4', value === stadtteil ? 'opacity-100' : 'opacity-0')}
                  />
                  {stadtteil}
                </CommandItem>
              ))}
            </CommandGroup>
            {value && !isKnown && (
              <CommandGroup heading="Aktueller Wert">
                <CommandItem value={value} onSelect={handleSelect}>
                  <Check className="mr-2 h-4 w-4 opacity-100" />
                  {value}
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
