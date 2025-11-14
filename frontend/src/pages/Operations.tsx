import React, { useState, useMemo } from 'react';
import { usePaginatedFetch } from '@/hooks/usePaginatedFetch';
import { MetricCard } from '@/components/MetricCard';
import { Card } from '@/components/Card';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { 
  PieChart, 
  Pie, 
  BarChart, 
  Bar, 
  Cell, 
  Legend, 
  ResponsiveContainer, 
  Tooltip, 
  XAxis, 
  YAxis 
} from 'recharts';
import { AlertTriangle, ChevronDown, ChevronUp, Send, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchCrmIntegrityWithFallback } from '../lib/dataFetchers';
import { sendBantAlert } from '../lib/intentHelpers';
import type { ValidationResponse, ValidationRecord } from '../lib/adapters';

type BackendResponse = ValidationResponse;

const RISK_COLORS = {
  HIGH: '#FF6B6B',
  MEDIUM: '#FFD93D',
  LOW: '#51CF66'
};

export const Operations: React.FC = () => {
  const { 
    data, 
    loading, 
    error, 
    page, 
    pageSize, 
    totalPages, 
    hasMore, 
    nextPage, 
    prevPage, 
    goToPage, 
    setPageSize 
  } = usePaginatedFetch<BackendResponse>(
    fetchCrmIntegrityWithFallback,
    50
  );
  const [selectedRiskLevels, setSelectedRiskLevels] = useState<string[]>(['HIGH', 'MEDIUM', 'LOW']);
  const [expandedEscalations, setExpandedEscalations] = useState<Set<string>>(new Set());
  const [sendingAlerts, setSendingAlerts] = useState(false);
  const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const validations = useMemo(() => data?.validations || [], [data?.validations]);

  const riskDistribution = useMemo(() => {
    const counts = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    validations.forEach(v => {
      if (v.risk_level in counts) {
        counts[v.risk_level]++;
      }
    });
    return [
      { name: 'HIGH', value: counts.HIGH, color: RISK_COLORS.HIGH },
      { name: 'MEDIUM', value: counts.MEDIUM, color: RISK_COLORS.MEDIUM },
      { name: 'LOW', value: counts.LOW, color: RISK_COLORS.LOW }
    ];
  }, [validations]);

  const stageValidation = useMemo(() => {
    const stageMap = new Map<string, { valid: number, invalid: number }>();
    validations.forEach(v => {
      if (!stageMap.has(v.stage)) {
        stageMap.set(v.stage, { valid: 0, invalid: 0 });
      }
      const stats = stageMap.get(v.stage)!;
      if (v.is_valid) {
        stats.valid++;
      } else {
        stats.invalid++;
      }
    });
    return Array.from(stageMap.entries()).map(([stage, stats]) => ({
      stage,
      Valid: stats.valid,
      Invalid: stats.invalid
    }));
  }, [validations]);

  const metrics = useMemo(() => {
    const total = validations.length;
    const valid = validations.filter(v => v.is_valid).length;
    const highRisk = validations.filter(v => v.risk_level === 'HIGH').length;
    const validationRate = total > 0 ? ((valid / total) * 100).toFixed(1) : '0.0';

    return {
      total,
      valid,
      highRisk,
      validationRate: `${validationRate}%`
    };
  }, [validations]);

  const filteredValidations = useMemo(() => {
    return validations.filter(v => selectedRiskLevels.includes(v.risk_level));
  }, [validations, selectedRiskLevels]);

  const escalationItems = useMemo(() => {
    return validations.filter(v => !v.is_valid && v.risk_level === 'HIGH');
  }, [validations]);

  const toggleRiskLevel = (level: string) => {
    setSelectedRiskLevels(prev => 
      prev.includes(level) 
        ? prev.filter(l => l !== level)
        : [...prev, level]
    );
  };

  const toggleEscalation = (id: string) => {
    setExpandedEscalations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const sendSlackAlerts = async () => {
    setSendingAlerts(true);
    setAlertMessage(null);
    try {
      const result = await sendBantAlert(
        escalationItems.map(item => item.opportunity_id),
        false
      );
      
      if (result.success) {
        setAlertMessage({ type: 'success', text: result.message });
      } else {
        setAlertMessage({ type: 'error', text: result.message });
      }
    } catch (error) {
      setAlertMessage({ type: 'error', text: 'Failed to send Slack alerts. Please try again.' });
    } finally {
      setSendingAlerts(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">CRM Integrity Operations</h1>

      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-white">Validation Analysis</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h3 className="text-lg font-semibold text-white mb-4">Risk Level Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={riskDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {riskDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0A2540', border: '1px solid #1E3A5F' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-white mb-4">Validation Status by Stage</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stageValidation}>
                <XAxis 
                  dataKey="stage" 
                  stroke="#6B7280" 
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis stroke="#6B7280" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0A2540', border: '1px solid #1E3A5F' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Legend />
                <Bar dataKey="Valid" stackId="a" fill={RISK_COLORS.LOW} />
                <Bar dataKey="Invalid" stackId="a" fill={RISK_COLORS.HIGH} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <MetricCard
          label="Total Opportunities"
          value={metrics.total.toString()}
        />
        <MetricCard
          label="Valid Opportunities"
          value={metrics.valid.toString()}
          change={metrics.validationRate}
        />
        <MetricCard
          label="High Risk"
          value={metrics.highRisk.toString()}
        />
      </div>

      <Card>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-white">Validation Results</h2>
            <div className="flex gap-4 items-center">
              <span className="text-text-secondary text-sm">Filter by Risk Level:</span>
              <div className="flex gap-3">
                {(['HIGH', 'MEDIUM', 'LOW'] as const).map(level => (
                  <label key={level} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedRiskLevels.includes(level)}
                      onChange={() => toggleRiskLevel(level)}
                      className="w-4 h-4 rounded border-gray-300 text-teal-accent focus:ring-teal-accent"
                    />
                    <span className="text-white text-sm">{level}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <p className="text-text-secondary text-sm">
            Showing {filteredValidations.length} of {validations.length} validations
          </p>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-card-border">
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Record Name</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Account Name</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Stage</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Amount</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Risk Level</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Status</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Issues</th>
                </tr>
              </thead>
              <tbody>
                {filteredValidations.length > 0 ? filteredValidations.map((validation) => (
                  <tr key={validation.opportunity_id} className="border-b border-card-border/50 hover:bg-card-border/20 transition">
                    <td className="py-3 px-4 text-white">{validation.opportunity_name}</td>
                    <td className="py-3 px-4 text-text-secondary">{validation.account_name}</td>
                    <td className="py-3 px-4 text-text-secondary">{validation.stage}</td>
                    <td className="py-3 px-4 text-text-secondary">
                      ${validation.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium`}
                        style={{
                          backgroundColor: `${RISK_COLORS[validation.risk_level]}20`,
                          color: RISK_COLORS[validation.risk_level]
                        }}
                      >
                        {validation.risk_level}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          validation.is_valid
                            ? 'bg-green-500/20 text-green-500'
                            : 'bg-red-500/20 text-red-500'
                        }`}
                      >
                        {validation.is_valid ? 'valid' : 'invalid'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-text-secondary">
                      {validation.is_valid ? 'None' : [...validation.missing_fields, validation.validation_issues].filter(Boolean).join(', ')}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-text-secondary">
                      No validation records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {data?.pagination && (
            <div className="mt-6 flex items-center justify-between border-t border-card-border pt-4">
              <div className="flex items-center gap-4">
                <div className="text-text-secondary text-sm">
                  Page {page} of {totalPages} ({data.pagination.total} total records)
                </div>
                
                <div className="flex items-center gap-2">
                  <label className="text-text-secondary text-sm">Per page:</label>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="bg-card-bg border border-card-border rounded px-2 py-1 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-accent"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={prevPage}
                  disabled={page === 1}
                  className="flex items-center gap-1 px-3 py-1.5 bg-card-bg border border-card-border rounded text-white text-sm hover:bg-card-border transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => goToPage(pageNum)}
                        className={`px-3 py-1.5 rounded text-sm transition ${
                          page === pageNum
                            ? 'bg-teal-accent text-white font-medium'
                            : 'bg-card-bg border border-card-border text-white hover:bg-card-border'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={nextPage}
                  disabled={!hasMore}
                  className="flex items-center gap-1 px-3 py-1.5 bg-card-bg border border-card-border rounded text-white text-sm hover:bg-card-border transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {escalationItems.length > 0 && (
        <Card>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <AlertTriangle className="text-red-500" size={24} />
                <h2 className="text-xl font-bold text-white">
                  Human-in-the-Loop Escalation
                </h2>
              </div>
              <button
                onClick={sendSlackAlerts}
                disabled={sendingAlerts}
                className="flex items-center gap-2 px-4 py-2 bg-teal-accent text-dark-bg rounded-lg font-medium hover:bg-teal-accent/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={16} />
                {sendingAlerts ? 'Sending...' : 'Send Slack Alerts'}
              </button>
            </div>

            <p className="text-red-400">
              ⚠️ {escalationItems.length} items require escalation
            </p>

            {alertMessage && (
              <div
                className={`p-3 rounded-lg ${
                  alertMessage.type === 'success'
                    ? 'bg-green-500/20 text-green-500'
                    : 'bg-red-500/20 text-red-500'
                }`}
              >
                {alertMessage.text}
              </div>
            )}

            <div className="space-y-3">
              {escalationItems.map(item => {
                const isExpanded = expandedEscalations.has(item.opportunity_id);
                return (
                  <div
                    key={item.opportunity_id}
                    className="border border-card-border rounded-lg overflow-hidden"
                  >
                    <button
                      onClick={() => toggleEscalation(item.opportunity_id)}
                      className="w-full flex justify-between items-center p-4 hover:bg-card-border/20 transition"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-white font-medium">
                          {item.opportunity_name}
                        </span>
                        <span className="text-text-secondary text-sm">
                          ({item.stage})
                        </span>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="text-text-secondary" size={20} />
                      ) : (
                        <ChevronDown className="text-text-secondary" size={20} />
                      )}
                    </button>
                    
                    {isExpanded && (
                      <div className="p-4 bg-card-border/10 border-t border-card-border space-y-3 animate-in slide-in-from-top">
                        <div>
                          <h4 className="text-sm font-semibold text-white mb-2">Issues:</h4>
                          <ul className="list-disc list-inside space-y-1">
                            {[...item.missing_fields, item.validation_issues]
                              .filter(Boolean)
                              .map((issue, idx) => (
                                <li key={idx} className="text-text-secondary text-sm">
                                  {issue}
                                </li>
                              ))}
                          </ul>
                        </div>
                        <div className="pt-2 border-t border-card-border">
                          <p className="text-sm text-red-400 font-medium">
                            Action Required: Review and update opportunity or revert stage
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
