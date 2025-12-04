import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import VoiceInput from "./VoiceInput";

export default function GlobalSearchVoice({ onSearch, placeholder = "Pesquisar..." }) {
  const [searchTerm, setSearchTerm] = useState("");

  const handleVoiceTranscription = (transcription) => {
    if (typeof transcription === 'string') {
      setSearchTerm(transcription);
      onSearch?.(transcription);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch?.(searchTerm);
  };

  return (
    <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={placeholder}
          className="pl-9 pr-4 bg-white"
        />
      </div>
      <VoiceInput
        onTranscription={handleVoiceTranscription}
        contextType="search"
        placeholder="Fale o que deseja buscar"
        size="sm"
      />
    </form>
  );
}