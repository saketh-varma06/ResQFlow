export interface PageParams { page: number; limit: number; skip: number; }
export function parsePagination(query: Record<string, unknown>): PageParams {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
}
export function pageMeta(total: number, p: PageParams) {
  return { total, page: p.page, limit: p.limit, pages: Math.max(1, Math.ceil(total / p.limit)) };
}
