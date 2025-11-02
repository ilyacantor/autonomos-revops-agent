import { getAosClient } from './aosClient';
import type { IntentResponse } from './aosClient';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

export interface AlertIntentPayload {
  deal_ids?: string[];
  escalation_ids?: string[];
  explain_only?: boolean;
}

export interface AlertResult {
  success: boolean;
  message: string;
  trace_id?: string;
  task_id?: string;
}

const USE_PLATFORM_VIEWS = import.meta.env.VITE_USE_PLATFORM_VIEWS === 'true';

export async function sendPipelineAlert(
  dealIds: string[],
  explainOnly: boolean = false
): Promise<AlertResult> {
  const idempotencyKey = uuidv4();

  if (USE_PLATFORM_VIEWS) {
    try {
      const aosClient = getAosClient();
      if (!aosClient) {
        throw new Error('AosClient not initialized');
      }

      const response: IntentResponse = await aosClient.postIntent(
        'revops',
        'execute',
        {
          intent: 'send_pipeline_alerts',
          targets: dealIds,
          explain_only: explainOnly,
        },
        { idempotencyKey }
      );

      return {
        success: true,
        message: explainOnly
          ? `Explain-only mode: Would send alerts for ${dealIds.length} deals`
          : `Successfully sent alerts for ${dealIds.length} deals`,
        trace_id: response.trace_id,
        task_id: response.task_id,
      };
    } catch (error: any) {
      const traceId = getAosClient()?.getLastTraceId();
      return {
        success: false,
        message: error.response?.data?.detail || 'Failed to send alerts',
        trace_id: traceId || undefined,
      };
    }
  } else {
    try {
      await axios.post('/api/alerts/pipeline', { deal_ids: dealIds });
      return {
        success: true,
        message: `Successfully sent alerts for ${dealIds.length} deals`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.detail || 'Failed to send alerts',
      };
    }
  }
}

export async function sendBantAlert(
  escalationIds: string[],
  explainOnly: boolean = false
): Promise<AlertResult> {
  const idempotencyKey = uuidv4();

  if (USE_PLATFORM_VIEWS) {
    try {
      const aosClient = getAosClient();
      if (!aosClient) {
        throw new Error('AosClient not initialized');
      }

      const response: IntentResponse = await aosClient.postIntent(
        'revops',
        'execute',
        {
          intent: 'send_bant_alerts',
          targets: escalationIds,
          explain_only: explainOnly,
        },
        { idempotencyKey }
      );

      return {
        success: true,
        message: explainOnly
          ? `Explain-only mode: Would send alerts for ${escalationIds.length} items`
          : `Successfully sent alerts for ${escalationIds.length} items`,
        trace_id: response.trace_id,
        task_id: response.task_id,
      };
    } catch (error: any) {
      const traceId = getAosClient()?.getLastTraceId();
      return {
        success: false,
        message: error.response?.data?.detail || 'Failed to send alerts',
        trace_id: traceId || undefined,
      };
    }
  } else {
    try {
      await axios.post('/api/alerts/bant', { escalation_ids: escalationIds });
      return {
        success: true,
        message: `Successfully sent alerts for ${escalationIds.length} items`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.detail || 'Failed to send alerts',
      };
    }
  }
}
