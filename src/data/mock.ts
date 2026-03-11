import { Lead, Funnel, Campaign, AIAgent, Appointment } from '@/types';

export const mockLeads: Lead[] = [
  { id: '1', name: 'Carlos Silva', company: 'TechBR Solutions', phone: '(11) 99999-1234', whatsapp: '5511999991234', email: 'carlos@techbr.com', instagram: '@techbr', city: 'São Paulo', state: 'SP', segment: 'Tecnologia', cnpj: '12.345.678/0001-90', origin: 'instagram', capturedAt: '2026-03-10', status: 'first_contact', notes: 'Interessado em automação', tags: ['tech', 'hot'] },
  { id: '2', name: 'Ana Costa', company: 'Moda Express', phone: '(21) 98888-5678', whatsapp: '5521988885678', email: 'ana@modaexpress.com', instagram: '@modaexpress', city: 'Rio de Janeiro', state: 'RJ', segment: 'Moda', cnpj: '98.765.432/0001-10', origin: 'radar', capturedAt: '2026-03-09', status: 'qualified', notes: 'Quer agendar reunião', tags: ['moda', 'warm'] },
  { id: '3', name: 'Roberto Mendes', company: 'Construtora ABC', phone: '(31) 97777-9012', whatsapp: '5531977779012', email: 'roberto@construtoraabc.com', instagram: '@construtoraabc', city: 'Belo Horizonte', state: 'MG', segment: 'Construção', cnpj: '11.222.333/0001-44', origin: 'cnpj', capturedAt: '2026-03-08', status: 'captured', notes: '', tags: ['construção'] },
  { id: '4', name: 'Fernanda Lima', company: 'Saúde Total', phone: '(41) 96666-3456', whatsapp: '5541966663456', email: 'fernanda@saudetotal.com', instagram: '@saudetotal', city: 'Curitiba', state: 'PR', segment: 'Saúde', cnpj: '44.555.666/0001-77', origin: 'csv', capturedAt: '2026-03-07', status: 'proposal_sent', notes: 'Proposta enviada dia 07/03', tags: ['saúde', 'hot'] },
  { id: '5', name: 'Marcos Oliveira', company: 'Food Delivery SP', phone: '(11) 95555-7890', whatsapp: '5511955557890', email: 'marcos@fooddelivery.com', instagram: '@fooddeliverysp', city: 'São Paulo', state: 'SP', segment: 'Alimentação', cnpj: '77.888.999/0001-22', origin: 'instagram', capturedAt: '2026-03-06', status: 'meeting_scheduled', notes: 'Reunião marcada para 12/03', tags: ['food'] },
  { id: '6', name: 'Juliana Santos', company: 'Edu Plus', phone: '(51) 94444-2345', whatsapp: '5551944442345', email: 'juliana@eduplus.com', instagram: '@eduplus', city: 'Porto Alegre', state: 'RS', segment: 'Educação', cnpj: '33.111.222/0001-55', origin: 'manual', capturedAt: '2026-03-05', status: 'client', notes: 'Cliente ativo', tags: ['educação', 'client'] },
  { id: '7', name: 'Pedro Almeida', company: 'Auto Parts BR', phone: '(61) 93333-6789', whatsapp: '5561933336789', email: 'pedro@autoparts.com', instagram: '@autopartsbr', city: 'Brasília', state: 'DF', segment: 'Automotivo', cnpj: '55.666.777/0001-88', origin: 'radar', capturedAt: '2026-03-04', status: 'response_received', notes: 'Respondeu com interesse', tags: ['auto'] },
  { id: '8', name: 'Luciana Ferreira', company: 'Beauty Care', phone: '(71) 92222-1234', whatsapp: '5571922221234', email: 'luciana@beautycare.com', instagram: '@beautycareoficial', city: 'Salvador', state: 'BA', segment: 'Estética', cnpj: '66.777.888/0001-33', origin: 'instagram', capturedAt: '2026-03-03', status: 'first_contact', notes: '', tags: ['estética', 'cold'] },
];

export const mockFunnels: Funnel[] = [
  {
    id: 'f1', name: 'Funil de Prospecção', leadsCount: 42,
    stages: [
      { id: 's1', name: 'Lead Capturado', order: 1, color: 'hsl(215, 20%, 55%)', actions: [] },
      { id: 's2', name: 'Primeiro Contato', order: 2, color: 'hsl(192, 91%, 52%)', actions: [] },
      { id: 's3', name: 'Resposta Recebida', order: 3, color: 'hsl(265, 80%, 60%)', actions: [] },
      { id: 's4', name: 'Qualificado', order: 4, color: 'hsl(38, 92%, 50%)', actions: [] },
      { id: 's5', name: 'Proposta Enviada', order: 5, color: 'hsl(142, 71%, 45%)', actions: [] },
      { id: 's6', name: 'Reunião Agendada', order: 6, color: 'hsl(330, 70%, 55%)', actions: [] },
      { id: 's7', name: 'Cliente', order: 7, color: 'hsl(142, 71%, 45%)', actions: [] },
    ],
  },
  {
    id: 'f2', name: 'Funil de Qualificação', leadsCount: 18,
    stages: [
      { id: 's8', name: 'Análise', order: 1, color: 'hsl(215, 20%, 55%)', actions: [] },
      { id: 's9', name: 'Contato Inicial', order: 2, color: 'hsl(192, 91%, 52%)', actions: [] },
      { id: 's10', name: 'Qualificado', order: 3, color: 'hsl(142, 71%, 45%)', actions: [] },
      { id: 's11', name: 'Descartado', order: 4, color: 'hsl(0, 72%, 51%)', actions: [] },
    ],
  },
  {
    id: 'f3', name: 'Funil de Agendamento', leadsCount: 12,
    stages: [
      { id: 's12', name: 'Aguardando', order: 1, color: 'hsl(38, 92%, 50%)', actions: [] },
      { id: 's13', name: 'Horário Sugerido', order: 2, color: 'hsl(192, 91%, 52%)', actions: [] },
      { id: 's14', name: 'Confirmado', order: 3, color: 'hsl(142, 71%, 45%)', actions: [] },
    ],
  },
];

export const mockCampaigns: Campaign[] = [
  { id: 'c1', name: 'Prospecção Tech Q1', targetAudience: 'Empresas de tecnologia SP', funnelId: 'f1', agentId: 'a1', status: 'active', leadsCount: 150, sentCount: 120, responseCount: 45, createdAt: '2026-03-01' },
  { id: 'c2', name: 'Moda Verão 2026', targetAudience: 'Lojas de moda RJ/SP', funnelId: 'f1', agentId: 'a1', status: 'active', leadsCount: 80, sentCount: 65, responseCount: 28, createdAt: '2026-02-15' },
  { id: 'c3', name: 'Saúde & Bem-estar', targetAudience: 'Clínicas e consultórios', funnelId: 'f2', agentId: 'a1', status: 'paused', leadsCount: 200, sentCount: 180, responseCount: 60, createdAt: '2026-02-01' },
  { id: 'c4', name: 'Construção Civil MG', targetAudience: 'Construtoras BH', funnelId: 'f1', agentId: 'a2', status: 'draft', leadsCount: 50, sentCount: 0, responseCount: 0, createdAt: '2026-03-08' },
];

export const mockAgents: AIAgent[] = [
  { id: 'a1', name: 'Agente de Atendimento', type: 'attendance', description: 'Responde leads, qualifica interesse e conduz conversa de prospecção', isActive: true, conversationsCount: 342, successRate: 72, delayMinutes: 5, antibotEnabled: true },
  { id: 'a2', name: 'Agente de Agendamento', type: 'scheduling', description: 'Detecta intenção de reunião, sugere horários e registra agendamento', isActive: true, conversationsCount: 128, successRate: 85, delayMinutes: 3, antibotEnabled: true },
];

export const mockAppointments: Appointment[] = [
  { id: 'ap1', leadId: '5', leadName: 'Marcos Oliveira', company: 'Food Delivery SP', phone: '(11) 95555-7890', date: '2026-03-12', time: '14:00', status: 'scheduled', agentId: 'a2' },
  { id: 'ap2', leadId: '2', leadName: 'Ana Costa', company: 'Moda Express', phone: '(21) 98888-5678', date: '2026-03-11', time: '10:00', status: 'completed', agentId: 'a2' },
  { id: 'ap3', leadId: '4', leadName: 'Fernanda Lima', company: 'Saúde Total', phone: '(41) 96666-3456', date: '2026-03-13', time: '16:00', status: 'scheduled', agentId: 'a2' },
  { id: 'ap4', leadId: '1', leadName: 'Carlos Silva', company: 'TechBR Solutions', phone: '(11) 99999-1234', date: '2026-03-14', time: '09:00', status: 'scheduled', agentId: 'a2' },
];

export const dashboardStats = {
  totalLeads: 1247,
  leadsToday: 23,
  responseRate: 38,
  qualificationRate: 24,
  schedulingRate: 15,
  conversionRate: 8,
  activeCampaigns: 2,
  activeAgents: 2,
};

export const chartData = {
  leadsByDay: [
    { day: 'Seg', leads: 18 }, { day: 'Ter', leads: 25 }, { day: 'Qua', leads: 15 },
    { day: 'Qui', leads: 32 }, { day: 'Sex', leads: 28 }, { day: 'Sáb', leads: 8 }, { day: 'Dom', leads: 5 },
  ],
  leadsByOrigin: [
    { origin: 'Instagram', count: 420, fill: 'hsl(265, 80%, 60%)' },
    { origin: 'Radar', count: 350, fill: 'hsl(192, 91%, 52%)' },
    { origin: 'CNPJ', count: 280, fill: 'hsl(38, 92%, 50%)' },
    { origin: 'CSV', count: 120, fill: 'hsl(142, 71%, 45%)' },
    { origin: 'Manual', count: 77, fill: 'hsl(330, 70%, 55%)' },
  ],
  funnelData: [
    { stage: 'Capturado', count: 1247 },
    { stage: 'Contato', count: 890 },
    { stage: 'Resposta', count: 474 },
    { stage: 'Qualificado', count: 299 },
    { stage: 'Proposta', count: 187 },
    { stage: 'Reunião', count: 112 },
    { stage: 'Cliente', count: 67 },
  ],
};
