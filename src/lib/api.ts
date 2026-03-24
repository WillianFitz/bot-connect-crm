const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || "/api";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token =
    typeof localStorage !== "undefined" ? localStorage.getItem("auth_token") || undefined : undefined;
  const tenantId =
    (window as any)?.TENANT_ID ||
    (typeof localStorage !== "undefined" ? localStorage.getItem("tenant_id") || undefined : undefined);

  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : tenantId ? { "x-tenant-id": tenantId } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = await res.json();
      if (data && typeof data.error === "string") {
        message = data.error;
      }
    } catch {
      // ignore
    }
    throw new Error(message || "Erro na requisição");
  }

  if (res.status === 204) {
    return undefined as unknown as T;
  }

  return (await res.json()) as T;
}

export const api = {
  getTenantPlan: () => request<{ plan: string }>("/tenant/plan"),

  getWhatsappConnection: () =>
    request<{
      type: string;
      status: string;
      agent_enabled: number;
      reply_all: number;
    }>("/connections/whatsapp"),

  getWhatsappQr: () =>
    request<{ qr: string | null; error?: string }>("/connections/whatsapp/qr"),

  logoutWhatsappInstance: () =>
    request<{ ok: boolean; error?: string }>("/connections/whatsapp/logout", {
      method: "POST",
    }),

  deleteWhatsappInstance: () =>
    request<{ ok: boolean; error?: string }>("/connections/whatsapp/instance", {
      method: "DELETE",
    }),

  testWhatsapp: (payload: { number: string; text?: string }) =>
    request<{ ok: boolean; error?: string }>("/connections/whatsapp/test", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateWhatsappConnection: (payload: {
    status?: string;
    agent_enabled?: boolean;
    reply_all?: boolean;
  }) =>
    request<{ ok: true }>("/connections/whatsapp", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  getLeadFolders: () =>
    request<Array<{ id: number; name: string }>>("/lead-folders"),

  createLeadFolder: (name: string) =>
    request<{ id: number; name: string }>("/lead-folders", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  renameLeadFolder: (id: number, name: string) =>
    request<{ ok: true }>(`/lead-folders?id=${id}`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    }),

  deleteLeadFolder: (id: number) =>
    request<{ ok: true }>(`/lead-folders?id=${id}`, {
      method: "DELETE",
    }),

  getLeadsCount: () =>
    request<{ count: number }>("/leads?countOnly=1"),

  getLeads: (params: { q?: string; folderId?: string | null } = {}) => {
    const sp = new URLSearchParams();
    if (params.q) sp.set("q", params.q);
    if (params.folderId) sp.set("folderId", params.folderId);
    return request<
      Array<{
        id: number;
        company: string;
        phone: string;
        folder_id: number | null;
        folder_name?: string | null;
        created_at: string;
      }>
    >(`/leads?${sp.toString()}`);
  },

  createLead: (payload: {
    company: string;
    phone: string;
    folder_id: number | null;
  }) =>
    request<{
      id: number;
      company: string;
      phone: string;
      folder_id: number | null;
      folder_name?: string | null;
      created_at: string;
    }>("/leads", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  deleteLead: (id: number) =>
    request<{ ok: true }>(`/leads?id=${id}`, { method: "DELETE" }),

  updateLead: (id: number, payload: { company: string; phone: string; folder_id: number | null }) =>
    request<{ ok: true }>(`/leads?id=${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  getCampaigns: () => request<any[]>("/campaigns"),
  getCampaign: (id: number) =>
    request<any>(`/campaigns/${id}`),
  createCampaign: (payload: any) =>
    request<any>("/campaigns", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateCampaign: (id: number, payload: any) =>
    request<any>(`/campaigns/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteCampaign: (id: number) =>
    request<{ ok: true }>(`/campaigns/${id}`, { method: "DELETE" }),
  runCampaigns: (options?: { ignoreWindow?: boolean }) =>
    request<{
      ok: boolean;
      processed: number;
      campaigns: Array<{ campaignId: number; name: string; sent: number; errors: number; errorDetails: string[] }>;
      errorSummary?: string[];
    }>(`/campaigns/run${options?.ignoreWindow ? "?ignoreWindow=1" : ""}`, { method: "POST" }),

  getSettings: () =>
    request<{ notification_whatsapp_phone: string; notification_group_jid: string }>("/settings"),
  updateSettings: (payload: { notification_whatsapp_phone?: string; notification_group_jid?: string }) =>
    request<{ ok: boolean }>("/settings", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  getGroups: () =>
    request<Array<{ id: string; name: string }>>("/groups"),
  getNotificationSettings: () =>
    request<{ notification_whatsapp_phone: string; notification_group_jid: string }>("/settings"),
  saveNotificationSettings: (data: { notification_whatsapp_phone?: string; notification_group_jid?: string }) =>
    request<{ ok: boolean }>("/settings", { method: "PUT", body: JSON.stringify(data) }),

  // Booking / Availability
  getAvailabilitySettings: () =>
    request<{
      enabled: boolean; title: string; description: string;
      days: number[]; start: string; end: string;
      slot_min: number; advance_days: number; min_advance_h: number;
      booking_url: string;
    }>("/settings/availability"),
  updateAvailabilitySettings: (payload: {
    enabled?: boolean; title?: string; description?: string;
    days?: number[]; start?: string; end?: string;
    slot_min?: number; advance_days?: number; min_advance_h?: number;
  }) => request<{ ok: true }>("/settings/availability", { method: "PUT", body: JSON.stringify(payload) }),

  getAccountSettings: () =>
    request<{ tenantName: string; username: string }>("/settings/account"),
  updateAccountSettings: (payload: { tenantName: string }) =>
    request<{ ok: true }>("/settings/account", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  changePassword: (payload: { currentPassword: string; newPassword: string }) =>
    request<{ ok: true }>("/settings/password", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  getCrmColumns: () =>
    request<Array<{ id: number; name: string; position: number; color: string | null; wip_limit: number | null }>>(
      "/crm/columns",
    ),
  createCrmColumn: (payload: { name: string; position?: number; color?: string }) =>
    request<{ id: number; name: string; position: number; color: string | null; wip_limit: number | null }>("/crm/columns", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateCrmColumn: (id: number, payload: { name?: string; color?: string; wip_limit?: number | null; position?: number }) =>
    request<{ id: number; name: string; position: number; color: string | null; wip_limit: number | null }>(`/crm/columns/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteCrmColumn: (id: number) =>
    request<{ ok: true }>(`/crm/columns/${id}`, { method: "DELETE" }),

  getCrmLeads: () =>
    request<
      Array<{
        id: number;
        lead_id: number;
        column_id: number;
        position: number;
        company: string;
        phone: string;
        column_name: string;
        tags: string | null;
        deal_value: number | null;
        notes: string | null;
        assignee: string | null;
        moved_at: string | null;
        heat_score: number | null;
        heat_label: "cold" | "warm" | "hot" | "fire" | null;
      }>
    >("/crm/leads"),

  moveCrmLead: (payload: { id: number; column_id: number; position: number }) =>
    request<{ ok: true }>("/crm/leads", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  createCrmLead: (payload: { lead_id: number; column_id: number }) =>
    request<{ ok: true; id: number }>("/crm/leads", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  deleteCrmLead: (id: number) =>
    request<{ ok: true }>(`/crm/leads?id=${id}`, {
      method: "DELETE",
    }),

  updateCrmLeadMeta: (
    id: number,
    payload: { tags?: string[]; deal_value?: number | null; notes?: string | null; assignee?: string | null },
  ) =>
    request<{ ok: true }>(`/crm/leads/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  getCrmPipelineStats: () =>
    request<{
      columns: Array<{ id: number; name: string; color: string | null; position: number; lead_count: number; total_value: number }>;
      totalDeals: number;
      totalValue: number;
    }>("/crm/pipeline-stats"),

  getDashboardStats: () =>
    request<{
      leadsTotal: number;
      leadsWithPhone: number;
      leadsLast7Days: Array<{ date: string; count: number }>;
      campaigns: Array<{ id: number; name: string; status: string; total_leads: number; sent: number; errors: number }>;
      campaignsActive: number;
      campaignsTotal: number;
      totalSent: number;
      totalErrors: number;
    }>("/dashboard/stats"),

  // Appointments
  getAppointments: (month?: string) => {
    const qs = month ? `?month=${month}` : "";
    return request<Array<{
      id: number;
      lead_id: number | null;
      title: string;
      description: string | null;
      scheduled_at: string;
      type: string;
      status: string;
      reminder_minutes: number;
      reminder_sent: number;
      lead_name: string | null;
      lead_phone: string | null;
      created_at: string;
    }>>(`/appointments${qs}`);
  },
  createAppointment: (payload: {
    lead_id?: number | null;
    title: string;
    description?: string;
    scheduled_at: string;
    type?: string;
    status?: string;
    reminder_minutes?: number;
  }) => request<{ ok: true; id: number }>("/appointments", { method: "POST", body: JSON.stringify(payload) }),
  updateAppointment: (id: number, payload: {
    lead_id?: number | null;
    title?: string;
    description?: string;
    scheduled_at?: string;
    type?: string;
    status?: string;
    reminder_minutes?: number;
  }) => request<{ ok: true }>(`/appointments/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteAppointment: (id: number) =>
    request<{ ok: true }>(`/appointments/${id}`, { method: "DELETE" }),

  getAgentMedia: () =>
    request<
      Array<{
        id: number;
        media_id: string;
        file_name: string;
        media_type: string;
        url: string;
        created_at: string;
      }>
    >("/agents/atendimento/media"),

  uploadAgentMedia: async (file: File, mediaId: string) => {
    const token = typeof localStorage !== "undefined" ? localStorage.getItem("auth_token") || undefined : undefined;
    const tenantId = (window as any)?.TENANT_ID ||
      (typeof localStorage !== "undefined" ? localStorage.getItem("tenant_id") || undefined : undefined);
    const form = new FormData();
    form.append("file", file);
    form.append("media_id", mediaId);
    form.append("file_name", file.name);
    const res = await fetch(
      `${(import.meta.env.VITE_API_BASE_URL as string | undefined) || "/api"}/agents/atendimento/media`,
      {
        method: "POST",
        headers: token
          ? { Authorization: `Bearer ${token}` }
          : tenantId ? { "x-tenant-id": tenantId } : {},
        body: form,
      },
    );
    if (!res.ok) {
      let msg = res.statusText;
      try { const d = await res.json(); if (d?.error) msg = d.error; } catch { /* noop */ }
      throw new Error(msg);
    }
    return res.json() as Promise<{ ok: true; id: number; url: string }>;
  },

  deleteAgentMedia: (id: number) =>
    request<{ ok: true }>(`/agents/atendimento/media?id=${id}`, {
      method: "DELETE",
    }),

  clearAgentMemory: (agentId: "disparo" | "atendimento" | "agendamento" | "all" = "atendimento") =>
    request<{ ok: true }>(`/agents/${agentId}/clear-memory`, {
      method: "POST",
    }),

  getAgents: () => request<any[]>("/agents"),
  saveAgents: (agents: any[]) =>
    request<{ ok: true; count: number }>("/agents", {
      method: "PUT",
      body: JSON.stringify(agents),
    }),

  // Admin
  adminCreateTenantUser: (payload: {
    tenantId?: string;
    tenantName: string;
    username: string;
    password: string;
    document: string;
  }) => {
    const adminToken = typeof localStorage !== "undefined" ? localStorage.getItem("admin_token") || "" : "";
    return request<{ ok: true; tenantId: string }>("/admin/create-tenant-user", {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(payload),
    });
  },

  adminListUsers: () => {
    const adminToken = typeof localStorage !== "undefined" ? localStorage.getItem("admin_token") || "" : "";
    return request<
      Array<{
        id: number;
        tenant_id: string;
        tenant_name: string;
        username: string;
        document: string;
        created_at: string;
        plan: string;
        blocked: number;
      }>
    >("/admin/users", {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
  },

  adminDeleteUser: (id: number) => {
    const adminToken = typeof localStorage !== "undefined" ? localStorage.getItem("admin_token") || "" : "";
    return request<{ ok: true }>(`/admin/users?id=${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
  },

  adminSetPlan: (payload: { tenant_id: string; plan: string }) => {
    const adminToken = typeof localStorage !== "undefined" ? localStorage.getItem("admin_token") || "" : "";
    return request<{ ok: true }>("/admin/set-plan", {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(payload),
    });
  },

  adminToggleBlock: (payload: { tenant_id: string; blocked: boolean }) => {
    const adminToken = typeof localStorage !== "undefined" ? localStorage.getItem("admin_token") || "" : "";
    return request<{ ok: true }>("/admin/toggle-block", {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(payload),
    });
  },

  clientLogin: (payload: { username: string; password: string }) =>
    request<{ ok: true; tenantId: string; username: string; token?: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // IA
  runDisparoAgent: () =>
    request<{ mensagem: string }>("/ai/disparo", {
      method: "POST",
    }),

  runAtendimentoAgent: (payload: { message: string }) =>
    request<{ resposta: string }>("/ai/atendimento", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  runAgendamentoAgent: (payload: { message: string }) =>
    request<{ resposta: string }>("/ai/agendamento", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // Funis de Prospecção
  getFunnels: () =>
    request<Array<{
      id: number;
      name: string;
      status: string;
      version: number;
      created_at: string;
      updated_at: string;
      steps: Array<{ id: number; position: number; type: string; content: string | null; wait_seconds: number | null; caption: string | null }>;
    }>>("/funnels"),

  getFunnel: (id: number) =>
    request<{
      id: number;
      name: string;
      status: string;
      version: number;
      created_at: string;
      updated_at: string;
      steps: Array<{ id: number; position: number; type: string; content: string | null; wait_seconds: number | null; caption: string | null }>;
    }>(`/funnels/${id}`),

  createFunnel: (data: {
    name: string;
    status?: string;
    steps: Array<{ type: string; content?: string; wait_seconds?: number; caption?: string; position: number }>;
  }) =>
    request<{ id: number; name: string; status: string; version: number; created_at: string; steps: unknown[] }>("/funnels", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateFunnel: (id: number, data: {
    name?: string;
    status?: string;
    steps?: Array<{ type: string; content?: string; wait_seconds?: number; caption?: string; position: number }>;
  }) =>
    request<{ id: number; name: string; status: string; version: number; updated_at: string; steps: unknown[] }>(`/funnels/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteFunnel: (id: number) =>
    request<{ ok: true }>(`/funnels/${id}`, { method: "DELETE" }),

  uploadFunnelMedia: async (file: File): Promise<{ ok: true; url: string }> => {
    const token = typeof localStorage !== "undefined" ? localStorage.getItem("auth_token") || undefined : undefined;
    const tenantId = (window as any)?.TENANT_ID ||
      (typeof localStorage !== "undefined" ? localStorage.getItem("tenant_id") || undefined : undefined);
    const form = new FormData();
    form.append("file", file);
    const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || "/api";
    const res = await fetch(`${BASE_URL}/funnels/upload`, {
      method: "POST",
      headers: token
        ? { Authorization: `Bearer ${token}` }
        : tenantId ? { "x-tenant-id": tenantId } : {},
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Erro no upload" })) as { error?: string };
      throw new Error(err?.error ?? "Erro no upload");
    }
    return res.json();
  },

  // Ferramentas - Instagram
  startInstagramExtraction: (payload: { profile: string }) =>
    request<{ ok: true; jobId: number }>("/tools/instagram/start", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  listInstagramJobs: () =>
    request<
      Array<{
        id: number;
        profile: string;
        status: string;
        total_leads: number;
        created_at: string;
        updated_at: string;
        error_message?: string | null;
      }>
    >("/tools/instagram/jobs"),

  getInstagramConfig: () =>
    request<{
      username: string | null;
      hasPassword: boolean;
      extensionToken?: string;
    }>("/tools/instagram/config"),

  getGmapsConfig: () =>
    request<{ extensionToken: string }>("/tools/gmaps/config"),

  getWhatsappConfig: () =>
    request<{ extensionToken: string }>("/tools/whatsapp/config"),

  getCnpjConfig: () =>
    request<{ extensionToken: string }>("/tools/cnpj/config"),

  // Lead Heat Map
  getLeadsHeat: () =>
    request<any[]>("/leads/heat"),

  analyzeLeadHeat: (id: number) =>
    request<{ ok: boolean; heat_score: number; heat_label: string; heat_summary: string; heat_signals: string[] }>(
      `/leads/${id}/heat-analyze`,
      { method: "POST" }
    ),

  analyzeAllLeadsHeat: () =>
    request<{ ok: boolean; analyzed: number }>("/leads/heat/analyze-all", {
      method: "POST",
    }),

  clearLeadConversation: (id: number, _phone: string) =>
    request<{ ok: boolean }>(`/leads/${id}/conversation`, {
      method: "DELETE",
    }),

  // ── Inbox de Atendimento Humano ───────────────────────────────────────────
  getInboxHandoffs: () =>
    request<Array<{
      phone: string;
      contact_name: string | null;
      last_message: string | null;
      last_message_role: string | null;
      last_message_at: string | null;
      bot_status: "active" | "paused";
      message_count: number;
    }>>("/inbox"),

  dismissInbox: (phone: string) =>
    request<{ ok: boolean }>(`/inbox/${encodeURIComponent(phone)}`, { method: "DELETE" }),

  resumeInboxBot: (phone: string) =>
    request<{ ok: boolean }>(`/inbox/${encodeURIComponent(phone)}/resume`, { method: "PUT" }),

  getInboxMessages: (phone: string) =>
    request<Array<{
      role: "user" | "assistant";
      content: string;
      created_at: string;
    }>>(`/inbox/${encodeURIComponent(phone)}/messages`),

  replyInbox: (phone: string, message: string) =>
    request<{ ok: boolean }>(`/inbox/${encodeURIComponent(phone)}/reply`, {
      method: "POST",
      body: JSON.stringify({ message }),
    }),

  resolveInbox: (phone: string) =>
    request<{ ok: boolean }>(`/inbox/${encodeURIComponent(phone)}/resolve`, {
      method: "PUT",
    }),

  createInboxHandoff: (payload: { phone: string; contact_name?: string }) =>
    request<{ ok: boolean; id: number }>("/inbox", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  pauseInboxBot: (phone: string) =>
    request<{ ok: boolean }>(`/inbox/${encodeURIComponent(phone)}/pause`, {
      method: "PUT",
    }),

  // Bot pauses por lead (tela de Leads)
  getBotPauses: () => request<string[]>("/bot-pauses"),
  pauseLeadBot: (phone: string) =>
    request<{ ok: boolean }>(`/bot-pauses?phone=${encodeURIComponent(phone)}`, { method: "PUT" }),
  resumeLeadBot: (phone: string) =>
    request<{ ok: boolean }>(`/bot-pauses?phone=${encodeURIComponent(phone)}`, { method: "DELETE" }),

  // WhatsApp Oficial (Meta)
  getWhatsappOfficialSettings: () =>
    request<{ waba_id: string; phone_number_id: string; access_token: string }>("/settings/whatsapp-official"),
  updateWhatsappOfficialSettings: (payload: { waba_id?: string; phone_number_id?: string; access_token?: string }) =>
    request<{ ok: boolean }>("/settings/whatsapp-official", { method: "PUT", body: JSON.stringify(payload) }),

  getWhatsappTemplates: () =>
    request<Array<{
      id: number;
      meta_template_id: string | null;
      name: string;
      language: string;
      category: string;
      body_text: string;
      status: string;
      rejection_reason: string | null;
      created_at: string;
      updated_at: string;
    }>>("/whatsapp-templates"),

  createWhatsappTemplate: (payload: { name: string; language?: string; category?: string; body_text: string }) =>
    request<{ id: number; meta_template_id: string | null; name: string; status: string }>("/whatsapp-templates", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  syncWhatsappTemplate: (id: number) =>
    request<{ id: number; status: string; rejection_reason: string | null }>(`/whatsapp-templates/${id}/sync`, {
      method: "POST",
    }),

  deleteWhatsappTemplate: (id: number) =>
    request<{ ok: boolean }>(`/whatsapp-templates/${id}`, { method: "DELETE" }),

  importWhatsappTemplatesFromMeta: () =>
    request<{ ok: boolean; imported: number; updated: number; total: number }>("/whatsapp-templates/import-from-meta", {
      method: "POST",
    }),
};

