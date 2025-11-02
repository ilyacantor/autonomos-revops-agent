import { useState, useEffect } from 'react';
import axios from 'axios';

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
}

export function useFetch<T>(url: string, options: UseFetchOptions<T> = {}): UseFetchResult<T> {
  const { method = 'GET', dependencies = [], customFetcher } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      let responseData: T;
      
      if (customFetcher) {
        responseData = await customFetcher();
      } else {
        const response = method === 'POST' 
          ? await axios.post<T>(url)
          : await axios.get<T>(url);
        responseData = response.data;
      }
      
      setData(responseData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      console.error('[useFetch] Error:', errorMessage, err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, dependencies);

  return { data, loading, error, refetch: fetchData };
}
