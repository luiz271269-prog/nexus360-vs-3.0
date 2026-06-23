import React from "react";

// Cartão neo-brutalista: bordas grossas pretas, sombra dura (offset sólido),
// sem gradientes suaves, cores chapadas e cantos retos.
export default function BrutalCard({ children, className = "", color = "bg-white" }) {
  return (
    <div
      className={`${color} border-4 border-black rounded-none shadow-[6px_6px_0_0_#000] ${className}`}
    >
      {children}
    </div>
  );
}