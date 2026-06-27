'use client'

import { useState, useEffect, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { assetApi } from "@/lib/asset-api";
import { cn, formatCurrency } from "@/lib/utils";
import { Search, X, Loader2, Clock, TrendingUp } from "lucide-react";

interface SearchBarProps {
  onSearch: (query: string) => void;
  className?: string;
  initialValue?: string;
}

export function SearchBar({ onSearch, className, initialValue = "" }: SearchBarProps) {
  const [query, setQuery] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    setIsLoading(true);
    try {
      const results = await assetApi.getAutocompleteSuggestions(q);
      setSuggestions(results);
      setIsOpen(results.length > 0);
    } catch {
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchSuggestions]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
    setIsOpen(false);
  };

  const handleSelect = (value: string) => {
    setQuery(value);
    onSearch(value);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[selectedIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <form onSubmit={handleSubmit} role="search">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Search assets, tokens, locations..."
            aria-label="Search assets, tokens, locations"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(-1); }}
            onFocus={() => suggestions.length > 0 && setIsOpen(true)}
            onKeyDown={handleKeyDown}
            className="pl-9 pr-16"
            role="combobox"
            aria-expanded={isOpen && suggestions.length > 0}
            aria-controls="search-suggestions"
            aria-autocomplete="list"
            aria-activedescendant={selectedIndex >= 0 ? `search-suggestion-${selectedIndex}` : undefined}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />}
            {query && (
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setQuery(""); onSearch(""); }} aria-label="Clear search">
                <X className="h-3 w-3" aria-hidden="true" />
              </Button>
            )}
            <Button type="submit" size="sm" className="h-7">
              Search
            </Button>
          </div>
        </div>
      </form>

      {isOpen && suggestions.length > 0 && (
        <ul
          id="search-suggestions"
          role="listbox"
          aria-label="Search suggestions"
          className="absolute top-full mt-1 w-full bg-popover border rounded-lg shadow-lg z-50 max-h-64 overflow-auto"
        >
          {suggestions.map((s, i) => (
            <li key={i} role="option" aria-selected={i === selectedIndex} id={`search-suggestion-${i}`}>
              <button
                type="button"
                tabIndex={-1}
                className={cn(
                  "w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors flex items-center gap-2",
                  i === selectedIndex && "bg-muted"
                )}
                onClick={() => handleSelect(s)}
              >
                <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                <span>{s}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
