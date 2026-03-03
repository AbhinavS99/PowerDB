import api from './api';
import type { Report, ReportCreate, ReportUpdate } from '@/types';

export const reportService = {
  async list(): Promise<Report[]> {
    const { data } = await api.get<Report[]>('/reports/');
    return data;
  },

  async get(id: number): Promise<Report> {
    const { data } = await api.get<Report>(`/reports/${id}`);
    return data;
  },

  async create(report: ReportCreate): Promise<Report> {
    const { data } = await api.post<Report>('/reports/', report);
    return data;
  },

  async update(id: number, report: ReportUpdate): Promise<Report> {
    const { data } = await api.put<Report>(`/reports/${id}`, report);
    return data;
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/reports/${id}`);
  },
};
