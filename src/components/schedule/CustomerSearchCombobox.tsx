import React, { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import Fuse from 'fuse.js';

interface Customer {
  id: string;
  vorname?: string;
  nachname?: string;
  name: string; // Generated from vorname + nachname
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

  // Configure Fuse.js for fuzzy search
  const fuse = useMemo(() => {
    return new Fuse(customers, {
      keys: ['name'],
      threshold: 0.4, // More lenient for typos (0 = exact match, 1 = match anything)
      distance: 100,
      minMatchCharLength: 1,
      includeScore: true,
    });
  }, [customers]);

  // Filter customers based on search query with fuzzy matching
  const filteredCustomers = useMemo(() => {
    if (!searchQuery) {
      return customers;
    }
    
    const results = fuse.search(searchQuery);
    return results.map(result => result.item);
  }, [searchQuery, customers, fuse]);

  const selectedCustomer = customers.find((customer) => customer.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedCustomer ? selectedCustomer.name : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 z-50" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput
              placeholder="Kunden suchen..."
              value={searchQuery}
              onValueChange={setSearchQuery}
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <CommandList>
            <CommandEmpty>
              {searchQuery ? 
                `Kein Kunde gefunden für "${searchQuery}"` : 
                'Keine Kunden verfügbar'
              }
            </CommandEmpty>
            <CommandGroup>
              {filteredCustomers.map((customer) => (
                <CommandItem
                  key={customer.id}
                  value={customer.id}
                  onSelect={() => {
                    onValueChange(customer.id);
                    setOpen(false);
                    setSearchQuery('');
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === customer.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {customer.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
