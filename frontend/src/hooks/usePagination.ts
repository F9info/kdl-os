import { useState, useCallback } from 'react'

interface UsePaginationOptions {
  initialPage?: number
  initialLimit?: number
}

export function usePagination({ initialPage = 1, initialLimit = 10 }: UsePaginationOptions = {}) {
  const [page, setPage] = useState(initialPage)
  const [limit, setLimit] = useState(initialLimit)

  const reset = useCallback(() => setPage(1), [])

  const handleLimitChange = useCallback((newLimit: number) => {
    setLimit(newLimit)
    setPage(1)
  }, [])

  return { page, limit, setPage, setLimit: handleLimitChange, reset }
}
