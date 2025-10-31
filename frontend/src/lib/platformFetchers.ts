import axios from 'axios';
import { getAosClient } from './aosClient';
import { 
  adaptOpportunitiesResponse, 
  adaptValidationsResponse
} from './adapters';
import type {
  BackendResponse,
  ValidationResponse,
  PlatformViewResponse,
  PlatformOpportunity,
  PlatformAccount
} from './adapters';

const USE_PLATFORM_VIEWS = import.meta.env.VITE_USE_PLATFORM_VIEWS === 'true';

export async function fetchPipelineHealth(): Promise<BackendResponse> {
  if (!USE_PLATFORM_VIEWS) {
    throw new Error('Platform views not enabled - use default axios fetcher');
  }

  const aosClient = getAosClient();
  if (!aosClient) {
    console.warn('[fetchPipelineHealth] AosClient not initialized - falling back to backend API');
    const response = await axios.post<BackendResponse>('/api/workflows/pipeline-health');
    return response.data;
  }

  try {
    const platformResponse = await aosClient.getView<PlatformViewResponse<PlatformOpportunity>>(
      'opportunities',
      {
        filters: {},
        page: 1,
        page_size: 100,
      }
    );

    return adaptOpportunitiesResponse(platformResponse);
  } catch (error) {
    console.info('[fetchPipelineHealth] Platform API unavailable – using fallback data');
    const response = await axios.post<BackendResponse>('/api/workflows/pipeline-health');
    return response.data;
  }
}

export async function fetchCrmIntegrity(): Promise<ValidationResponse> {
  if (!USE_PLATFORM_VIEWS) {
    throw new Error('Platform views not enabled - use default axios fetcher');
  }

  const aosClient = getAosClient();
  if (!aosClient) {
    console.warn('[fetchCrmIntegrity] AosClient not initialized - falling back to backend API');
    const response = await axios.post<ValidationResponse>('/api/workflows/crm-integrity');
    return response.data;
  }

  try {
    const platformResponse = await aosClient.getView<PlatformViewResponse<PlatformAccount>>(
      'accounts',
      {
        filters: {},
        page: 1,
        page_size: 100,
      }
    );

    return adaptValidationsResponse(platformResponse);
  } catch (error) {
    console.info('[fetchCrmIntegrity] Platform API unavailable – using fallback data');
    const response = await axios.post<ValidationResponse>('/api/workflows/crm-integrity');
    return response.data;
  }
}
