export interface PageRequest {
  page: number;
  limit: number;
}

export interface Page<T> {
  items: T[];
  total: number;
}

export interface DateRange {
  createdFrom?: Date;
  createdTo?: Date;
}
