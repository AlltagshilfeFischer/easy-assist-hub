import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import Fuse from 'fuse.js';

interface Customer {
  id: string;
  vorname?: string;
  nachname?: string;
  name: string;
}

interface CustomerSearchComboboxProps {
  customers: Customer[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

export function CustomerSearchCombobox({
  customers,
  value,
  onValueChange,
  placeholder = 'Kunde auswählen...',
}: CustomerSearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const fuse = useMemo(() => {
    return new Fuse(customers, {
      keys: ['name'],
      threshold: 0.4,
      distance: 100,
      minMatchCharLength: 1,
      includeScore: true,
    });
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    if (!searchQuery) return customers;
    return fuse.search(searchQuery).map(result => result.item);
  }, [searchQuery, customers, fuse]);

  const selectedCustomer = customers.find((customer) => customer.id === value);

  const updatePosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 99999,
      });
    }
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        buttonRef.current && !buttonRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Position and focus when opened
  useEffect(() => {
    if (open) {
      updatePosition();
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, updatePosition]);

  return (
    <div className="relative w-full">
      <Button
        ref={buttonRef}
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className="w-full justify-between"
        onClick={() => setOpen(!open)}
      >
        {selectedCustomer ? selectedCustomer.name : placeholder}
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>

      {open && createPortal(
        <div
          ref={dropdownRef}
          style={dropdownStyle}
          className="bg-popover border border-border rounded-md shadow-lg overflow-hidden"
        >
          <div className="flex items-center border-b px-3 py-2">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Kunden suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filteredCustomers.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {searchQuery ? `Kein Kunde gefunden für "${searchQuery}"` : 'Keine Kunden verfügbar'}
              </p>
            ) : (
              filteredCustomers.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  className="flex items-center w-full px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
                  onClick={() => {
                    onValueChange(customer.id);
                    setOpen(false);
                    setSearchQuery('');
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4 flex-shrink-0',
                      value === customer.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {customer.name}
                </button>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
