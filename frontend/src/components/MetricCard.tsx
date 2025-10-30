import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from './Card';

interface MetricCardProps {
  label: string;
  value: string | number;
  change?: number;
  trend?: 'up' | 'down';
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({ 
  label, 
  value, 
  change, 
  trend,
  className = '' 
}) => {
  return (
    <Card className={className}>
      <div className="flex flex-col">
        <span className="text-text-secondary text-sm mb-2">{label}</span>
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
