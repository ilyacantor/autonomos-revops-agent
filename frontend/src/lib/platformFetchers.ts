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
    throw new Error('AosClient not initialized');
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
    console.error('[fetchPipelineHealth] Failed to fetch from platform views:', error);
    throw error;
  }
}

export async function fetchCrmIntegrity(): Promise<ValidationResponse> {
  if (!USE_PLATFORM_VIEWS) {
    throw new Error('Platform views not enabled - use default axios fetcher');
  }

  const aosClient = getAosClient();
  if (!aosClient) {
    throw new Error('AosClient not initialized');
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
    console.error('[fetchCrmIntegrity] Failed to fetch from platform views:', error);
    throw error;
  }
}
