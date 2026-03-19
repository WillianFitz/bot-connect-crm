export type LeadStatus = 'captured' | 'first_contact' | 'response_received' | 'qualified' | 'proposal_sent' | 'meeting_scheduled' | 'client';
export type LeadOrigin = 'instagram' | 'radar' | 'cnpj' | 'csv' | 'manual';
export type CampaignStatus = 'active' | 'paused' | 'completed' | 'draft';
export type AgentType = 'attendance' | 'scheduling';

export interface Lead {
  id: string;
  name: string;
  company: string;
  phone: string;
  whatsapp: string;
  email: string;
  instagram: string;
  city: string;
  state: string;
  segment: string;
  cnpj: string;
  origin: LeadOrigin;
  capturedAt: string;
  status: LeadStatus;
  notes: string;
  funnelId?: string;
  stageId?: string;
  tags: string[];
}

export interface FunnelStage {
  id: string;
  name: string;
  order: number;
  color: string;
  actions: StageAction[];
}

export interface Funnel {
  id: string;
  name: string;
  stages: FunnelStage[];
  leadsCount: number;
}

export interface StageAction {
  id: string;
  type: 'send_text' | 'send_audio' | 'send_image' | 'send_video' | 'wait_response' | 'execute_ai';
  content?: string;
  delayMinutes?: number;
}

export interface Campaign {
  id: string;
  name: string;
  targetAudience: string;
  funnelId: string;
  agentId: string;
  status: CampaignStatus;
  leadsCount: number;
  sentCount: number;
  responseCount: number;
  createdAt: string;
}

export interface AIAgent {
  id: string;
  name: string;
  type: AgentType;
  description: string;
  isActive: boolean;
  conversationsCount: number;
  successRate: number;
  delayMinutes: number;
  antibotEnabled: boolean;
}

export interface Appointment {
  id: string;
  leadId: string;
  leadName: string;
  company: string;
  phone: string;
  date: string;
  time: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  agentId: string;
}

export interface Conversation {
  id: string;
  leadId: string;
  messages: ConversationMessage[];
  agentId: string;
  startedAt: string;
}

export interface ConversationMessage {
  id: string;
  role: 'agent' | 'lead';
  content: string;
  timestamp: string;
}

export type HandoffStatus = 'pending' | 'active' | 'resolved';

export interface Handoff {
  id: number;
  phone: string;
  contact_name: string | null;
  status: HandoffStatus;
  trigger_reason: string;
  created_at: string;
  updated_at: string;
  last_message: string | null;
  last_message_role: string | null;
  last_message_at: string | null;
}

export interface HandoffMessage {
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}
