export interface Faq {
  id: string;
  question: string;
  answer: string;
  status: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface FaqFormData {
  question: string;
  answer: string;
  status: boolean;
  sort_order?: number;
}

export interface FaqListParams {
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface FaqListResult {
  rows: Faq[];
  total: number;
  page: number;
  pageSize: number;
}
