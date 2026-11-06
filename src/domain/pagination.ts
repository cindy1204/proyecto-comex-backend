export interface PaginationQuery {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    currentPage: number;
    limit: number;
    totalPages: number;
    page: number;
    pageSize: number;
  };
}

export function createPagination<T>(
  data: T[],
  total: number,
  query: PaginationQuery,
): PaginatedResult<T> {
  const totalPages = Math.ceil(total / query.pageSize);
  return {
    data,
    pagination: {
      total,
      currentPage: query.page,
      limit: query.pageSize,
      totalPages,
      page: query.page,
      pageSize: query.pageSize,
    },
  };
}
