import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SearchBar({ 
  placeholder = "Buscar...", 
  onSearch, 
  debounceMs = 300,
  className = ""
}) {
  const [value, setValue] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      if (onSearch) {
        onSearch(value);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [value, debounceMs, onSearch]);

  const handleClear = () => {
    setValue("");
    if (onSearch) {
      onSearch("");
    }
  };

  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="pl-10 pr-10"
      />
      {value && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClear}
          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
        >
          <X className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}