import { useState, useEffect, useRef } from 'react';
import axios, { AxiosError } from 'axios';

interface UseFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export type CustomFetcher<T> = () => Promise<T>;

interface UseFetchOptions<T> {
  method?: 'GET' | 'POST';
  dependencies?: any[];
  customFetcher?: CustomFetcher<T>;
  retryCount?: number;
  retryDelay?: number;
  cacheTime?: number;
  onRetry?: (attempt: number, error: any) => void;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<any>>();

const MAX_RETRY_DELAY = 10000;

const isRetryableError = (error: any): boolean => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;
    if (!axiosError.response) {
      return true;
    }
    const status = axiosError.response.status;
    return status >= 500 && status < 600;
  }
  return error.message?.includes('network') || error.message?.includes('timeout');
};

const isAbortError = (error: any): boolean => {
  return error.name === 'AbortError' || 
         error.name === 'CanceledError' ||
         axios.isCancel(error);
};

const sleep = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

export function useFetch<T>(url: string, options: UseFetchOptions<T> = {}): UseFetchResult<T> {
  const { 
    method = 'GET', 
    dependencies = [], 
    customFetcher,
    retryCount = 3,
    retryDelay = 1000,
    cacheTime = 60000,
    onRetry
  } = options;
  
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef<boolean>(true);

  const getCacheKey = (): string => {
    return customFetcher ? `custom-${url}` : `${method}-${url}`;
  };

  const getCachedData = (): T | null => {
    const cacheKey = getCacheKey();
    const cached = cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < cacheTime) {
      return cached.data;
    }
    
    return null;
  };

  const setCachedData = (data: T): void => {
    const cacheKey = getCacheKey();
    cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
  };

  const clearCache = (): void => {
    const cacheKey = getCacheKey();
    cache.delete(cacheKey);
  };

  const fetchWithRetry = async (signal: AbortSignal): Promise<T> => {
    let lastError: any;
    
    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        let responseData: T;
        
        if (customFetcher) {
          responseData = await customFetcher();
        } else {
          const response = method === 'POST' 
            ? await axios.post<T>(url, {}, { signal })
            : await axios.get<T>(url, { signal });
          responseData = response.data;
        }
        
        return responseData;
      } catch (err) {
        lastError = err;
        
        if (isAbortError(err)) {
          throw err;
        }
        
        if (!isRetryableError(err) || attempt === retryCount) {
          throw err;
        }
        
        const delay = Math.min(retryDelay * Math.pow(2, attempt), MAX_RETRY_DELAY);
        
        console.log(
          `[useFetch] Retry attempt ${attempt + 1}/${retryCount} for ${url}. ` +
          `Waiting ${delay}ms before retry...`,
          err
        );
        
        if (onRetry) {
          onRetry(attempt + 1, err);
        }
        
        await sleep(delay);
      }
    }
    
    throw lastError;
  };

  const fetchData = async (useCache: boolean = true) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    setLoading(true);
    setError(null);
    
    if (useCache) {
      const cachedData = getCachedData();
      if (cachedData) {
        setData(cachedData);
        setLoading(false);
        
        fetchWithRetry(signal)
          .then(responseData => {
            if (!isMountedRef.current || signal.aborted) return;
            
            setCachedData(responseData);
            setData(responseData);
          })
          .catch(err => {
            if (isAbortError(err) || !isMountedRef.current) return;
            
            console.error('[useFetch] Background refresh error:', err);
          });
        
        return;
      }
    }
    
    try {
      const responseData = await fetchWithRetry(signal);
      
      if (!isMountedRef.current || signal.aborted) return;
      
      setCachedData(responseData);
      setData(responseData);
    } catch (err) {
      if (!isMountedRef.current) return;
      
      if (isAbortError(err)) {
        console.log('[useFetch] Request cancelled:', url);
        return;
      }
      
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      console.error('[useFetch] Error:', errorMessage, err);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const refetch = () => {
    clearCache();
    fetchData(false);
  };

  useEffect(() => {
    isMountedRef.current = true;
    fetchData();
    
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, dependencies);

  return { data, loading, error, refetch };
}
