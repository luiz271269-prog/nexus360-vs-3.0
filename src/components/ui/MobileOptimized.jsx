import React from "react";
import { cn } from "@/lib/utils";

/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║  COMPONENTES MOBILE-OPTIMIZED                                ║
 * ║  + Touch-friendly                                            ║
 * ║  + Responsive design                                         ║
 * ║  + Performance otimizada                                     ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

/**
 * Container responsivo com padding adequado
 */
export const MobileContainer = ({ children, className }) => {
  return (
    <div className={cn(
      "w-full px-4 py-4 md:px-6 md:py-6 lg:px-8 lg:py-8",
      "max-w-7xl mx-auto",
      className
    )}>
      {children}
    </div>
  );
};

/**
 * Grid responsivo que se adapta ao tamanho da tela
 */
export const ResponsiveGrid = ({ children, cols = { mobile: 1, tablet: 2, desktop: 3 }, gap = 4, className }) => {
  return (
    <div className={cn(
      "grid gap-4",
      `grid-cols-${cols.mobile}`,
      `md:grid-cols-${cols.tablet}`,
      `lg:grid-cols-${cols.desktop}`,
      `gap-${gap}`,
      className
    )}>
      {children}
    </div>
  );
};

/**
 * Botão touch-friendly com área de toque aumentada
 */
export const TouchButton = ({ children, onClick, variant = "primary", size = "md", className, disabled = false }) => {
  const baseClasses = "font-medium rounded-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white",
    secondary: "bg-slate-200 hover:bg-slate-300 text-slate-900",
    outline: "border-2 border-slate-300 hover:border-slate-400 text-slate-700",
    danger: "bg-red-600 hover:bg-red-700 text-white"
  };

  const sizes = {
    sm: "px-3 py-2 text-sm min-h-[40px]",
    md: "px-4 py-3 text-base min-h-[44px]",
    lg: "px-6 py-4 text-lg min-h-[48px]"
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        baseClasses,
        variants[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </button>
  );
};

/**
 * Input touch-friendly
 */
export const TouchInput = ({ type = "text", placeholder, value, onChange, className, ...props }) => {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className={cn(
        "w-full px-4 py-3 text-base rounded-lg border-2 border-slate-300",
        "focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none",
        "min-h-[44px]", // Altura mínima recomendada pela Apple
        "transition-all",
        className
      )}
      {...props}
    />
  );
};

/**
 * Card mobile-optimized
 */
export const MobileCard = ({ children, className, onClick, interactive = false }) => {
  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-white rounded-xl shadow-sm border border-slate-200 p-4",
        "transition-all duration-200",
        interactive && "active:scale-[0.98] cursor-pointer hover:shadow-md",
        className
      )}
    >
      {children}
    </div>
  );
};

/**
 * Lista otimizada para scroll touch
 */
export const TouchList = ({ items, renderItem, className }) => {
  return (
    <div className={cn(
      "space-y-2 overflow-y-auto -webkit-overflow-scrolling-touch",
      className
    )}>
      {items.map((item, index) => (
        <div key={index} className="touch-manipulation">
          {renderItem(item, index)}
        </div>
      ))}
    </div>
  );
};

/**
 * Bottom navigation bar para mobile
 */
export const MobileBottomNav = ({ items, activeItem, onItemClick }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 md:hidden z-50 safe-area-inset-bottom">
      <div className="flex items-center justify-around py-2">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeItem === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onItemClick(item.id)}
              className={cn(
                "flex flex-col items-center justify-center px-3 py-2 min-w-[60px] transition-colors",
                isActive ? "text-blue-600" : "text-slate-600"
              )}
            >
              <Icon className={cn(
                "w-6 h-6 mb-1",
                isActive && "scale-110"
              )} />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Floating Action Button (FAB)
 */
export const FloatingActionButton = ({ icon: Icon, onClick, className, badge }) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "fixed bottom-20 md:bottom-6 right-6 z-40",
        "w-14 h-14 rounded-full shadow-lg",
        "bg-blue-600 hover:bg-blue-700 text-white",
        "flex items-center justify-center",
        "transition-all active:scale-95",
        "focus:outline-none focus:ring-4 focus:ring-blue-300",
        className
      )}
    >
      <Icon className="w-6 h-6" />
      {badge && (
        <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold">
          {badge}
        </span>
      )}
    </button>
  );
};

/**
 * Pull to refresh indicator
 */
export const PullToRefresh = ({ onRefresh, children }) => {
  const [isPulling, setIsPulling] = React.useState(false);
  const [startY, setStartY] = React.useState(0);
  const [currentY, setCurrentY] = React.useState(0);

  const handleTouchStart = (e) => {
    setStartY(e.touches[0].clientY);
  };

  const handleTouchMove = (e) => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    if (scrollTop === 0) {
      setCurrentY(e.touches[0].clientY);
      if (e.touches[0].clientY - startY > 80) {
        setIsPulling(true);
      }
    }
  };

  const handleTouchEnd = () => {
    if (isPulling) {
      onRefresh();
    }
    setIsPulling(false);
    setStartY(0);
    setCurrentY(0);
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {isPulling && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}
      {children}
    </div>
  );
};

export default {
  MobileContainer,
  ResponsiveGrid,
  TouchButton,
  TouchInput,
  MobileCard,
  TouchList,
  MobileBottomNav,
  FloatingActionButton,
  PullToRefresh
};