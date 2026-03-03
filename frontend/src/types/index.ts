// ---- Auth ----

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface User {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
}

// ---- Reports ----

export type ReportStatus = 'draft' | 'in_progress' | 'completed';

export interface Report {
  id: number;
  title: string;
  status: ReportStatus;
  created_by: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportCreate {
  title: string;
  notes?: string;
  // TODO: Add power audit fields once data model is defined
}

export interface ReportUpdate {
  title?: string;
  status?: ReportStatus;
  notes?: string;
  // TODO: Add power audit fields once data model is defined
}
