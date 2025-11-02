// Type definitions only - no transformation logic
// Transformation logic moved to _deprecated/dcl-lite/

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
}

export interface ValidationResponse {
  metrics: MetricResponse[];
  validations: ValidationRecord[];
  timestamp: string;
}

// Platform response types (kept for AosClient integration)
export interface PlatformViewResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  metadata?: Record<string, any>;
}
