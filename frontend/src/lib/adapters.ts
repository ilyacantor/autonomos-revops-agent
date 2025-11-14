// Data transformation adapters for platform integration
// Transforms platform view responses into UI-compatible contracts

export interface PaginationMeta {
  page: number;
  page_size: number;
  total: number;
  has_more: boolean;
  next_cursor?: string;
}

export interface MetricResponse {
  label: string;
  value: string;
  change?: string;
  trend?: string;
}

export interface OpportunityRecord {
  id: string;
  name: string;
  account_name: string;
  stage: string;
  amount: number;
  health_score: number;
  risk_score: number;
  is_stalled: boolean;
  last_login_days?: number | null;
  sessions_30d?: number | null;
}

export interface ValidationRecord {
  opportunity_id: string;
  opportunity_name: string;
  account_name: string;
  stage: string;
  amount: number;
  is_valid: boolean;
  missing_fields: string[];
  validation_issues: string;
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface BackendResponse {
  metrics: MetricResponse[];
  opportunities: OpportunityRecord[];
  data_quality: {
    health_data_available: boolean;
    usage_data_available: boolean;
    warnings: string[];
  };
  timestamp: string;
  pagination?: PaginationMeta;
}

export interface ValidationResponse {
  metrics: MetricResponse[];
  validations: ValidationRecord[];
  timestamp: string;
  pagination?: PaginationMeta;
}

// Platform response types
export interface PlatformViewResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  metadata?: Record<string, any>;
}

export interface PlatformOpportunity {
  id: string;
  name: string;
  accountName?: string;
  account_name?: string;
  stage: string;
  stageName?: string;
  amount: number;
  healthScore?: number;
  health_score?: number;
  riskScore?: number;
  risk_score?: number;
  isStalled?: boolean;
  is_stalled?: boolean;
  lastLoginDays?: number | null;
  last_login_days?: number | null;
  sessions30d?: number | null;
  sessions_30d?: number | null;
}

export interface PlatformAccount {
  opportunityId?: string;
  opportunity_id?: string;
  opportunityName?: string;
  opportunity_name?: string;
  accountName?: string;
  account_name?: string;
  stage: string;
  amount: number;
  isValid?: boolean;
  is_valid?: boolean;
  missingFields?: string[];
  missing_fields?: string[];
  validationIssues?: string;
  validation_issues?: string;
  riskLevel?: 'HIGH' | 'MEDIUM' | 'LOW';
  risk_level?: 'HIGH' | 'MEDIUM' | 'LOW';
}

// Utility: Normalize field names (camelCase vs snake_case)
function normalizeFieldName<T>(
  obj: Record<string, any>,
  camelCase: keyof T,
  snakeCase: string
): any {
  return obj[camelCase as string] ?? obj[snakeCase] ?? null;
}

// Transform platform opportunity data to UI format
export function adaptOpportunitiesView(
  platformResponse: PlatformViewResponse<PlatformOpportunity>
): OpportunityRecord[] {
  return platformResponse.data.map((opp) => ({
    id: opp.id,
    name: opp.name,
    account_name: normalizeFieldName(opp, 'accountName', 'account_name') || 'Unknown',
    stage: normalizeFieldName(opp, 'stageName', 'stage') || opp.stage || 'Unknown',
    amount: opp.amount || 0,
    health_score: normalizeFieldName(opp, 'healthScore', 'health_score') || 0,
    risk_score: normalizeFieldName(opp, 'riskScore', 'risk_score') || 0,
    is_stalled: normalizeFieldName(opp, 'isStalled', 'is_stalled') || false,
    last_login_days: normalizeFieldName(opp, 'lastLoginDays', 'last_login_days'),
    sessions_30d: normalizeFieldName(opp, 'sessions30d', 'sessions_30d'),
  }));
}

// Transform platform account data to UI validation format
export function adaptAccountsView(
  platformResponse: PlatformViewResponse<PlatformAccount>
): ValidationRecord[] {
  return platformResponse.data.map((acc) => ({
    opportunity_id: normalizeFieldName(acc, 'opportunityId', 'opportunity_id') || '',
    opportunity_name: normalizeFieldName(acc, 'opportunityName', 'opportunity_name') || 'Unknown',
    account_name: normalizeFieldName(acc, 'accountName', 'account_name') || 'Unknown',
    stage: acc.stage || 'Unknown',
    amount: acc.amount || 0,
    is_valid: normalizeFieldName(acc, 'isValid', 'is_valid') || false,
    missing_fields: normalizeFieldName(acc, 'missingFields', 'missing_fields') || [],
    validation_issues: normalizeFieldName(acc, 'validationIssues', 'validation_issues') || '',
    risk_level: normalizeFieldName(acc, 'riskLevel', 'risk_level') || 'MEDIUM',
  }));
}

// Calculate metrics from opportunity data
export function calculateMetricsFromOpportunities(
  opportunities: OpportunityRecord[]
): MetricResponse[] {
  const total = opportunities.length;
  const atRisk = opportunities.filter((o) => o.risk_score >= 70).length;
  const stalled = opportunities.filter((o) => o.is_stalled).length;
  const healthy = total - atRisk - stalled;
  const totalValue = opportunities.reduce((sum, o) => sum + o.amount, 0);
  const avgHealth = total > 0 
    ? opportunities.reduce((sum, o) => sum + o.health_score, 0) / total 
    : 0;
  const avgRisk = total > 0
    ? opportunities.reduce((sum, o) => sum + o.risk_score, 0) / total
    : 0;
  const highRisk = opportunities.filter((o) => o.risk_score >= 70).length;

  return [
    { label: 'Total Opportunities', value: String(total), trend: 'up' },
    { 
      label: 'At Risk', 
      value: String(atRisk), 
      change: total > 0 ? `${((atRisk / total) * 100).toFixed(1)}%` : '0%' 
    },
    { 
      label: 'Healthy', 
      value: String(healthy), 
      change: total > 0 ? `${((healthy / total) * 100).toFixed(1)}%` : '0%' 
    },
    { label: 'Stalled Deals', value: String(stalled) },
    { label: 'Pipeline Value', value: `$${totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
    { label: 'Avg Health Score', value: avgHealth.toFixed(0) },
    { label: 'High Risk Deals', value: String(highRisk) },
    { label: 'Avg Risk Score', value: avgRisk.toFixed(0) },
  ];
}

// Calculate metrics from validation data
export function calculateMetricsFromValidations(
  validations: ValidationRecord[]
): MetricResponse[] {
  const total = validations.length;
  const valid = validations.filter((v) => v.is_valid).length;
  const validationRate = total > 0 ? (valid / total) * 100 : 0;
  const highRisk = validations.filter((v) => v.risk_level === 'HIGH').length;

  return [
    { label: 'Total Opportunities', value: String(total) },
    { 
      label: 'Valid Opportunities', 
      value: String(valid), 
      change: `${validationRate.toFixed(1)}%` 
    },
    { 
      label: 'High Risk', 
      value: String(highRisk), 
      change: total > 0 ? `${((highRisk / total) * 100).toFixed(1)}%` : '0%' 
    },
  ];
}

// Full adapter: Platform opportunities response → UI contract
export function adaptOpportunitiesResponse(
  platformResponse: PlatformViewResponse<PlatformOpportunity>
): BackendResponse {
  const opportunities = adaptOpportunitiesView(platformResponse);
  const metrics = calculateMetricsFromOpportunities(opportunities);

  return {
    metrics,
    opportunities,
    data_quality: {
      health_data_available: true,
      usage_data_available: true,
      warnings: [],
    },
    timestamp: new Date().toISOString(),
  };
}

// Full adapter: Platform accounts response → UI validation contract
export function adaptValidationsResponse(
  platformResponse: PlatformViewResponse<PlatformAccount>
): ValidationResponse {
  const validations = adaptAccountsView(platformResponse);
  const metrics = calculateMetricsFromValidations(validations);

  return {
    metrics,
    validations,
    timestamp: new Date().toISOString(),
  };
}
