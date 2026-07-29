export interface Notification {
  id: string;
  title: string;
  message: string;
  status: boolean;
  is_published: boolean;
  shared_count: number;
  created_at: string;
  updated_at: string;
}

export interface NotificationFormData {
  title: string;
  message: string;
  status: boolean;
}

export interface NotificationListParams {
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface NotificationListResult {
  rows: Notification[];
  total: number;
  page: number;
  pageSize: number;
}
