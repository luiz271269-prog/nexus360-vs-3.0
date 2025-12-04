import React from "react";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";

export default function MetricCard({ title, value, icon: Icon, color, onViewDetails, trend }) {
  return (
    <div className="relative group">
      {/* Card principal com gradiente futurista */}
      <div className="bg-gradient-to-br from-white/90 via-white/80 to-slate-50/90 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-xl shadow-slate-900/10 transition-all duration-300 hover:shadow-2xl hover:shadow-slate-900/20 hover:-translate-y-1">
        
        {/* Borda animada no hover */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-indigo-500/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 blur-sm" />
        
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-medium text-slate-600">{title}</p>
          <div className={`p-3 rounded-xl bg-gradient-to-br ${color} shadow-lg`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>
        
        <div className="flex items-end justify-between">
          <div>
            <p className="text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent mb-2">
              {value}
            </p>
            {trend && (
              <p className={`text-sm font-medium ${
                trend.direction === 'up' 
                  ? 'text-emerald-600' 
                  : trend.direction === 'down' 
                    ? 'text-red-500' 
                    : 'text-slate-500'
              }`}>
                {trend.value} {trend.period}
              </p>
            )}
          </div>
        </div>
        
        {onViewDetails && (
          <Button
            onClick={onViewDetails}
            variant="outline"
            size="sm"
            className="w-full mt-4 bg-gradient-to-r from-slate-50 to-white border-slate-200 hover:from-blue-50 hover:to-indigo-50 hover:border-blue-300 text-slate-700 hover:text-blue-700 transition-all duration-300"
          >
            <Eye className="w-4 h-4 mr-2" />
            Ver Detalhes
          </Button>
        )}
      </div>
    </div>
  );
}