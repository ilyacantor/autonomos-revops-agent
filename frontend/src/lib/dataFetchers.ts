/**
 * Unified data fetchers - Platform Views OR Mock ONLY (no backend API)
 * Two paths only:
 * 1. Platform views via AosClient (when USE_PLATFORM_VIEWS=true)
 * 2. Mock data (when USE_PLATFORM_VIEWS=false OR platform fails)
 */

import { getAosClient } from './aosClient';
import { getMockPipelineHealth } from '../services/mockOpportunities';
import { getMockCrmIntegrity } from '../services/mockValidations';
import type {
  BackendResponse,
  ValidationResponse,
  PlatformViewResponse,
} from './adapters';

const USE_PLATFORM_VIEWS = import.meta.env.VITE_USE_PLATFORM_VIEWS === 'true';

/**
 * Fetch pipeline health data
 * Flow: Platform → Mock (no backend API)
 */
export async function fetchPipelineHealthWithFallback(): Promise<BackendResponse> {
  // Path 1: Use mock data directly if platform views disabled
  if (!USE_PLATFORM_VIEWS) {
    console.info('[fetchPipelineHealth] Using mock data (platform views disabled)');
    return getMockPipelineHealth();
  }

  // Path 2: Try platform, fallback to mock on error
  const aosClient = getAosClient();
  if (!aosClient) {
    console.warn('[fetchPipelineHealth] AosClient not initialized - using mock data');
    return getMockPipelineHealth();
  }

  try {
    const platformResponse = await aosClient.getView<PlatformViewResponse<any>>(
      'opportunities',
      {
        filters: {},
        page: 1,
        page_size: 100,
      }
    );

    // Platform returns data - use it directly (assuming it matches BackendResponse shape)
    // In production, platform should return data in BackendResponse format
    return platformResponse as unknown as BackendResponse;
  } catch (error) {
    console.info('[fetchPipelineHealth] Platform unavailable - using mock data');
    return getMockPipelineHealth();
  }
}

/**
 * Fetch CRM integrity validation data
 * Flow: Platform → Mock (no backend API)
 */
export async function fetchCrmIntegrityWithFallback(): Promise<ValidationResponse> {
  // Path 1: Use mock data directly if platform views disabled
  if (!USE_PLATFORM_VIEWS) {
    console.info('[fetchCrmIntegrity] Using mock data (platform views disabled)');
    return getMockCrmIntegrity();
  }

  // Path 2: Try platform, fallback to mock on error
  const aosClient = getAosClient();
  if (!aosClient) {
    console.warn('[fetchCrmIntegrity] AosClient not initialized - using mock data');
    return getMockCrmIntegrity();
  }

  try {
    const platformResponse = await aosClient.getView<PlatformViewResponse<any>>(
      'accounts',
      {
        filters: {},
        page: 1,
        page_size: 100,
      }
    );

    // Platform returns data - use it directly (assuming it matches ValidationResponse shape)
    // In production, platform should return data in ValidationResponse format
    return platformResponse as unknown as ValidationResponse;
  } catch (error) {
    console.info('[fetchCrmIntegrity] Platform unavailable - using mock data');
    return getMockCrmIntegrity();
  }
}
