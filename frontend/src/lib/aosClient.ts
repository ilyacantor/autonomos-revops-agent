import axios from 'axios';
import type { AxiosInstance, AxiosResponse } from 'axios';

export interface AosClientConfig {
  baseUrl: string;
  tenantId: string;
  agentId: string;
  jwt?: string;
}

export interface ViewParams {
  filters?: Record<string, any>;
  fields?: string[];
  page?: number;
  page_size?: number;
}

export interface IntentOptions {
  idempotencyKey?: string;
}

export interface IntentResponse {
  task_id: string;
  trace_id: string;
  status: string;
  [key: string]: any;
}

export class AosClient {
  private client: AxiosInstance;
  private lastTraceId: string | null = null;

  constructor(config: AosClientConfig) {
    this.client = axios.create({
      baseURL: config.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': config.tenantId,
        'X-Agent-Id': config.agentId,
        ...(config.jwt && { 'Authorization': `Bearer ${config.jwt}` }),
      },
    });

    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        const traceId = response.headers['x-trace-id'];
        if (traceId) {
          this.lastTraceId = traceId;
        }
        return response;
      },
      (error) => {
        const traceId = error.response?.headers?.['x-trace-id'];
        if (traceId) {
          this.lastTraceId = traceId;
        }
        return Promise.reject(error);
      }
    );
  }

  async getView<T = any>(
    entity: 'opportunities' | 'accounts',
    params: ViewParams = {}
  ): Promise<T> {
    try {
      const response = await this.client.get(`/views/${entity}`, {
        params: {
          ...params.filters,
          fields: params.fields?.join(','),
          page: params.page,
          page_size: params.page_size,
        },
      });
      return response.data;
    } catch (error) {
      console.error(`[AosClient] getView(${entity}) failed:`, error);
      throw error;
    }
  }

  async postIntent(
    agent: string,
    action: string,
    payload: Record<string, any>,
    options: IntentOptions = {}
  ): Promise<IntentResponse> {
    try {
      const headers: Record<string, string> = {};
      if (options.idempotencyKey) {
        headers['Idempotency-Key'] = options.idempotencyKey;
      }

      const response = await this.client.post(
        `/intents/${agent}/${action}`,
        payload,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error(`[AosClient] postIntent(${agent}/${action}) failed:`, error);
      throw error;
    }
  }

  getLastTraceId(): string | null {
    return this.lastTraceId;
  }

  clearTraceId(): void {
    this.lastTraceId = null;
  }
}

let aosClientInstance: AosClient | null = null;

export function initAosClient(config: AosClientConfig): AosClient {
  aosClientInstance = new AosClient(config);
  return aosClientInstance;
}

export function getAosClient(): AosClient | null {
  return aosClientInstance;
}
