/**
 * Unified data fetchers - Platform Views OR Mock ONLY (no backend API)
 * Two paths only:
 * 1. Platform views via AosClient (when USE_PLATFORM_VIEWS=true)
 * 2. Mock data (when USE_PLATFORM_VIEWS=false OR platform fails)
 */

import { getAosClient } from './aosClient';
import { getMockPipelineHealth } from '../services/mockOpportunities';
import { getMockCrmIntegrity } from '../services/mockValidations';
import fallbackMonitor from '../services/fallbackMonitor';
import {
  adaptOpportunitiesResponse,
  adaptValidationsResponse,
  type BackendResponse,
  type ValidationResponse,
  type PlatformViewResponse,
  type PlatformOpportunity,
  type PlatformAccount,
} from './adapters';

const USE_PLATFORM_VIEWS = import.meta.env.VITE_USE_PLATFORM_VIEWS === 'true';
const IS_DEVELOPMENT = import.meta.env.DEV;

/**
 * Fetch pipeline health data with pagination support
 * Flow: Platform → Mock (no backend API)
 */
export async function fetchPipelineHealthWithFallback(options?: {
  page?: number;
  page_size?: number;
  cursor?: string;
}): Promise<BackendResponse> {
  const page = options?.page || 1;
  const page_size = options?.page_size || 50;
  const cursor = options?.cursor;

  // Path 1: Use mock data directly if platform views disabled
  if (!USE_PLATFORM_VIEWS) {
    console.warn('[DataFetcher] Pipeline health fallback activated', {
      reason: 'platform_disabled',
      timestamp: new Date().toISOString(),
      usePlatformViews: USE_PLATFORM_VIEWS,
      context: 'Platform views intentionally disabled via VITE_USE_PLATFORM_VIEWS',
    });

    fallbackMonitor.trackFallback({
      type: 'pipeline_health',
      reason: 'platform_disabled',
      severity: 'info',
      usePlatformViews: USE_PLATFORM_VIEWS,
    });

    return getMockPipelineHealth({ page, page_size, cursor }, 'platform_disabled');
  }

  // Path 2: Try platform, fallback to mock on error
  const aosClient = getAosClient();
  if (!aosClient) {
    console.warn('[DataFetcher] Pipeline health fallback activated', {
      reason: 'client_not_initialized',
      timestamp: new Date().toISOString(),
      usePlatformViews: USE_PLATFORM_VIEWS,
      context: 'AosClient not initialized - check platform configuration',
    });

    fallbackMonitor.trackFallback({
      type: 'pipeline_health',
      reason: 'client_not_initialized',
      severity: 'warning',
      usePlatformViews: USE_PLATFORM_VIEWS,
    });

    return getMockPipelineHealth({ page, page_size, cursor }, 'client_not_initialized');
  }

  try {
    const platformResponse = await aosClient.getView<PlatformViewResponse<PlatformOpportunity>>(
      'opportunities',
      {
        filters: {},
        page,
        page_size,
      }
    );

    // Transform platform response to UI contract using adapter
    console.info('[DataFetcher] Pipeline health - platform data received successfully');
    const adaptedResponse = adaptOpportunitiesResponse(platformResponse);
    
    // Add pagination metadata from platform response
    adaptedResponse.pagination = {
      page: platformResponse.page,
      page_size: platformResponse.page_size,
      total: platformResponse.total,
      has_more: platformResponse.page * platformResponse.page_size < platformResponse.total,
      next_cursor: cursor,
    };
    
    return adaptedResponse;
  } catch (error: any) {
    const errorMessage = error?.message || 'Unknown error';
    const errorStack = IS_DEVELOPMENT ? error?.stack : undefined;

    console.warn('[DataFetcher] Pipeline health fallback activated', {
      reason: 'platform_fetch_failed',
      error: errorMessage,
      timestamp: new Date().toISOString(),
      usePlatformViews: USE_PLATFORM_VIEWS,
      stack: errorStack,
      context: 'Platform fetch failed - falling back to mock data',
    });

    fallbackMonitor.trackFallback({
      type: 'pipeline_health',
      reason: 'platform_fetch_failed',
      severity: 'error',
      error: errorMessage,
      errorStack,
      usePlatformViews: USE_PLATFORM_VIEWS,
    });

    return getMockPipelineHealth({ page, page_size, cursor }, 'platform_fetch_failed');
  }
}

/**
 * Fetch CRM integrity validation data with pagination support
 * Flow: Platform → Mock (no backend API)
 */
export async function fetchCrmIntegrityWithFallback(options?: {
  page?: number;
  page_size?: number;
  cursor?: string;
}): Promise<ValidationResponse> {
  const page = options?.page || 1;
  const page_size = options?.page_size || 50;
  const cursor = options?.cursor;

  // Path 1: Use mock data directly if platform views disabled
  if (!USE_PLATFORM_VIEWS) {
    console.warn('[DataFetcher] CRM integrity fallback activated', {
      reason: 'platform_disabled',
      timestamp: new Date().toISOString(),
      usePlatformViews: USE_PLATFORM_VIEWS,
      context: 'Platform views intentionally disabled via VITE_USE_PLATFORM_VIEWS',
    });

    fallbackMonitor.trackFallback({
      type: 'crm_integrity',
      reason: 'platform_disabled',
      severity: 'info',
      usePlatformViews: USE_PLATFORM_VIEWS,
    });

    return getMockCrmIntegrity({ page, page_size, cursor }, 'platform_disabled');
  }

  // Path 2: Try platform, fallback to mock on error
  const aosClient = getAosClient();
  if (!aosClient) {
    console.warn('[DataFetcher] CRM integrity fallback activated', {
      reason: 'client_not_initialized',
      timestamp: new Date().toISOString(),
      usePlatformViews: USE_PLATFORM_VIEWS,
      context: 'AosClient not initialized - check platform configuration',
    });

    fallbackMonitor.trackFallback({
      type: 'crm_integrity',
      reason: 'client_not_initialized',
      severity: 'warning',
      usePlatformViews: USE_PLATFORM_VIEWS,
    });

    return getMockCrmIntegrity({ page, page_size, cursor }, 'client_not_initialized');
  }

  try {
    const platformResponse = await aosClient.getView<PlatformViewResponse<PlatformAccount>>(
      'accounts',
      {
        filters: {},
        page,
        page_size,
      }
    );

    // Transform platform response to UI contract using adapter
    console.info('[DataFetcher] CRM integrity - platform data received successfully');
    const adaptedResponse = adaptValidationsResponse(platformResponse);
    
    // Add pagination metadata from platform response
    adaptedResponse.pagination = {
      page: platformResponse.page,
      page_size: platformResponse.page_size,
      total: platformResponse.total,
      has_more: platformResponse.page * platformResponse.page_size < platformResponse.total,
      next_cursor: cursor,
    };
    
    return adaptedResponse;
  } catch (error: any) {
    const errorMessage = error?.message || 'Unknown error';
    const errorStack = IS_DEVELOPMENT ? error?.stack : undefined;

    console.warn('[DataFetcher] CRM integrity fallback activated', {
      reason: 'platform_fetch_failed',
      error: errorMessage,
      timestamp: new Date().toISOString(),
      usePlatformViews: USE_PLATFORM_VIEWS,
      stack: errorStack,
      context: 'Platform fetch failed - falling back to mock data',
    });

    fallbackMonitor.trackFallback({
      type: 'crm_integrity',
      reason: 'platform_fetch_failed',
      severity: 'error',
      error: errorMessage,
      errorStack,
      usePlatformViews: USE_PLATFORM_VIEWS,
    });

    return getMockCrmIntegrity({ page, page_size, cursor }, 'platform_fetch_failed');
  }
}
