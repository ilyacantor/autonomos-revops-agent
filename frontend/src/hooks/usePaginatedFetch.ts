import { useState, useCallback, useEffect } from 'react';
import type { PaginationMeta } from '../lib/adapters';

interface PaginatedResponse {
  pagination?: PaginationMeta;
  [key: string]: any;
}

interface UsePaginatedFetchResult<T extends PaginatedResponse> {
  data: T | null;
  loading: boolean;
  error: string | null;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
  nextPage: () => void;
  prevPage: () => void;
  goToPage: (page: number) => void;
  setPageSize: (size: number) => void;
  refetch: () => void;
}

type PaginatedFetcher<T> = (options?: {
  page?: number;
  page_size?: number;
  cursor?: string;
}) => Promise<T>;

export function usePaginatedFetch<T extends PaginatedResponse>(
  fetcher: PaginatedFetcher<T>,
  initialPageSize: number = 50
): UsePaginatedFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(initialPageSize);
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetcher({ page, page_size: pageSize, cursor });
      setData(result);
      
      if (result.pagination?.next_cursor) {
        setCursor(result.pagination.next_cursor);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      console.error('[usePaginatedFetch] Error:', errorMessage, err);
    } finally {
      setLoading(false);
    }
  }, [fetcher, page, pageSize, cursor]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalPages = data?.pagination
    ? Math.ceil(data.pagination.total / data.pagination.page_size)
    : 1;

  const hasMore = data?.pagination?.has_more || false;

  const nextPage = useCallback(() => {
    if (hasMore) {
      setPage((prev) => prev + 1);
    }
  }, [hasMore]);

  const prevPage = useCallback(() => {
    if (page > 1) {
      setPage((prev) => prev - 1);
    }
  }, [page]);

  const goToPage = useCallback((newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  }, [totalPages]);

  const handleSetPageSize = useCallback((size: number) => {
    setPageSize(size);
    setPage(1);
  }, []);

  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    page,
    pageSize,
    totalPages,
    hasMore,
    nextPage,
    prevPage,
    goToPage,
    setPageSize: handleSetPageSize,
    refetch,
  };
}
