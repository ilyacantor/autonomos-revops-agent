import { useState, useEffect } from 'react';
import axios from 'axios';

interface UseFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

interface UseFetchOptions {
  method?: 'GET' | 'POST';
  dependencies?: any[];
}

export function useFetch<T>(url: string, options: UseFetchOptions = {}): UseFetchResult<T> {
  const { method = 'GET', dependencies = [] } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = method === 'POST' 
        ? await axios.post<T>(url)
        : await axios.get<T>(url);
      setData(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, dependencies);

  return { data, loading, error, refetch: fetchData };
}
