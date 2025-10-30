import React from 'react';
import { TrendingUp, TrendingDown, Info } from 'lucide-react';
import { Card } from './Card';

interface MetricCardProps {
  label: string;
  value: string | number;
  change?: number;
  trend?: 'up' | 'down';
  className?: string;
  infoTooltip?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({ 
  label, 
  value, 
  change, 
  trend,
  className = '',
  infoTooltip
}) => {
  return (
    <Card className={className}>
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-text-secondary text-sm">{label}</span>
          {infoTooltip && (
            <div className="group relative">
              <Info className="w-3.5 h-3.5 text-amber-400 cursor-help" />
              <div className="absolute left-0 top-6 hidden group-hover:block z-10 w-48 bg-card-bg border border-amber-500/50 rounded-lg p-2 text-xs text-amber-400 shadow-lg">
                {infoTooltip}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-end justify-between">
          <span className="text-3xl font-bold text-white">{value}</span>
          {change !== undefined && (
            <div className={`flex items-center text-sm ${
              trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-text-secondary'
            }`}>
              {trend === 'up' && <TrendingUp className="w-4 h-4 mr-1" />}
              {trend === 'down' && <TrendingDown className="w-4 h-4 mr-1" />}
              <span>{change > 0 ? '+' : ''}{change}%</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
