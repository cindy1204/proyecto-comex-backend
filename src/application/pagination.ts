import type { Page, PageRequest } from '../domain/models/page.model.js';

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 50;

export interface Pagination {
  total: number;
  currentPage: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: Pagination;
}

export function toPaginatedResponse<T, R>(
  page: Page<T>,
  request: PageRequest,
  map: (item: T) => R,
): PaginatedResponse<R> {
  return {
    data: page.items.map(map),
    pagination: {
      total: page.total,
      currentPage: request.page,
      limit: request.limit,
      totalPages: Math.ceil(page.total / request.limit),
    },
  };
}
