const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || "/api";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const tenantId =
    (window as any)?.TENANT_ID ||
    (typeof localStorage !== "undefined"
      ? localStorage.getItem("tenant_id") || undefined
      : undefined);

  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(tenantId ? { "x-tenant-id": tenantId } : {}),
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
  getWhatsappConnection: () =>
    request<{
      type: string;
      status: string;
      agent_enabled: number;
      reply_all: number;
    }>("/connections/whatsapp"),

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

  getCampaigns: () => request<any[]>("/campaigns"),
  createCampaign: (payload: any) =>
    request<any>("/campaigns", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getCrmColumns: () =>
    request<Array<{ id: number; name: string; position: number }>>(
      "/crm/columns",
    ),
  createCrmColumn: (payload: { name: string; position?: number }) =>
    request<{ id: number; name: string; position: number }>("/crm/columns", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

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
      }>
    >("/crm/leads"),

  moveCrmLead: (payload: { id: number; column_id: number; position: number }) =>
    request<{ ok: true }>("/crm/leads", {
      method: "PUT",
      body: JSON.stringify(payload),
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
  }) =>
    request<{ ok: true; tenantId: string }>("/admin/create-tenant-user", {
      method: "POST",
      headers: {
        "x-admin-key":
          (import.meta.env.VITE_ADMIN_API_KEY as string | undefined) || "",
      },
      body: JSON.stringify(payload),
    }),

  adminListUsers: () =>
    request<
      Array<{
        id: number;
        tenant_id: string;
        tenant_name: string;
        username: string;
        document: string;
        created_at: string;
      }>
    >("/admin/users", {
      method: "GET",
      headers: {
        "x-admin-key":
          (import.meta.env.VITE_ADMIN_API_KEY as string | undefined) || "",
      },
    }),

  adminDeleteUser: (id: number) =>
    request<{ ok: true }>(`/admin/users?id=${id}`, {
      method: "DELETE",
      headers: {
        "x-admin-key":
          (import.meta.env.VITE_ADMIN_API_KEY as string | undefined) || "",
      },
    }),

  clientLogin: (payload: { username: string; password: string }) =>
    request<{ ok: true; tenantId: string; username: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

