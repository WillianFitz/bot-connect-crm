import { Lead, Funnel, Campaign, AIAgent, Appointment } from '@/types';

// Dados mockados foram removidos para deixar o projeto limpo.
// Estes exports permanecem apenas como placeholders tipados
// até que a integração com Cloudflare Workers / D1 seja implementada.

export const mockLeads: Lead[] = [];

export const mockFunnels: Funnel[] = [];

export const mockCampaigns: Campaign[] = [];

export const mockAgents: AIAgent[] = [];

export const mockAppointments: Appointment[] = [];

export const dashboardStats = {
  totalLeads: 0,
  leadsToday: 0,
  responseRate: 0,
  qualificationRate: 0,
  schedulingRate: 0,
  conversionRate: 0,
  activeCampaigns: 0,
  activeAgents: 0,
};

export const chartData = {
  leadsByDay: [] as { day: string; leads: number }[],
  leadsByOrigin: [] as { origin: string; count: number; fill: string }[],
  funnelData: [] as { stage: string; count: number }[],
};
