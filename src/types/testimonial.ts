export interface Testimonial {
  id: string;
  author_name: string;
  image_url: string | null;
  description: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TestimonialFormData {
  author_name: string;
  image_url?: string | null;
  description: string;
  sort_order?: number;
}

export interface TestimonialListParams {
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface TestimonialListResult {
  rows: Testimonial[];
  total: number;
  page: number;
  pageSize: number;
}
