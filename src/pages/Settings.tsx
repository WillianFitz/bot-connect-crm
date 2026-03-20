import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Bell, Key, Building2, Loader2, Check, Calendar, Copy, ExternalLink, Link2, Users, Phone, MessageSquare, Trash2, RefreshCw, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function SettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── Minha Conta ──
  const accountQuery = useQuery({
    queryKey: ["account-settings"],
    queryFn: api.getAccountSettings,
  });

  const [tenantName, setTenantName] = useState("");
  const [username, setUsername] = useState("");

  useEffect(() => {
    if (accountQuery.data) {
      setTenantName(accountQuery.data.tenantName);
      setUsername(accountQuery.data.username);
    }
  }, [accountQuery.data]);

  const saveAccountMutation = useMutation({
    mutationFn: () => api.updateAccountSettings({ tenantName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["account-settings"] });
      toast({ title: "Conta atualizada", description: "Nome da empresa salvo com sucesso." });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // ── Senha ──
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const changePasswordMutation = useMutation({
    mutationFn: () => api.changePassword({ currentPassword, newPassword }),
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Senha alterada", description: "Sua senha foi atualizada com sucesso." });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Erro", description: "A nova senha e a confirmação não coincidem.", variant: "destructive" });
      return;
    }
    changePasswordMutation.mutate();
  };

  // ── Notificações ──
  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: api.getSettings,
  });

  const groupsQuery = useQuery({
    queryKey: ["whatsapp-groups"],
    queryFn: api.getGroups,
    retry: false,
    enabled: false,
    staleTime: Infinity,
  });

  const [notifMode, setNotifMode] = useState<"phone" | "group">("phone");
  const [notifPhone, setNotifPhone] = useState("");
  const [notifGroupJid, setNotifGroupJid] = useState("");
  const [groupSearch, setGroupSearch] = useState("");

  useEffect(() => {
    if (settingsQuery.data) {
      setNotifPhone(settingsQuery.data.notification_whatsapp_phone ?? "");
      setNotifGroupJid(settingsQuery.data.notification_group_jid ?? "");
      if (settingsQuery.data.notification_group_jid) {
        setNotifMode("group");
      } else {
        setNotifMode("phone");
      }
    }
  }, [settingsQuery.data]);

  const saveNotifMutation = useMutation({
    mutationFn: () => {
      if (notifMode === "group") {
        return api.updateSettings({ notification_group_jid: notifGroupJid, notification_whatsapp_phone: "" });
      }
      return api.updateSettings({ notification_whatsapp_phone: notifPhone, notification_group_jid: "" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast({ title: "Notificações salvas", description: "Configuração de WhatsApp atualizada." });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6 animate-slide-in w-full max-w-4xl xl:max-w-5xl 2xl:max-w-6xl">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground">Gerencie as configurações da sua conta</p>
      </div>

      <Tabs defaultValue="account" className="space-y-4">
        <TabsList className="bg-secondary border border-border/50 flex-wrap h-auto gap-0.5">
          <TabsTrigger value="account">Minha Empresa</TabsTrigger>
          <TabsTrigger value="security">Segurança</TabsTrigger>
          <TabsTrigger value="notifications">Notificações</TabsTrigger>
          <TabsTrigger value="booking">Agenda Pública</TabsTrigger>
          <TabsTrigger value="whatsapp-official">WhatsApp Oficial</TabsTrigger>
        </TabsList>

        {/* ── Minha Empresa ── */}
        <TabsContent value="account" className="space-y-4">
          <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> Informações da Conta
            </h3>

            {accountQuery.isLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Nome da Empresa</Label>
                  <Input
                    className="mt-1 bg-secondary border-border/50"
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    placeholder="Ex: Empresa XPTO"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">E-mail / Usuário</Label>
                  <Input
                    className="mt-1 bg-secondary border-border/50"
                    value={username}
                    readOnly
                    disabled
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">O e-mail não pode ser alterado.</p>
                </div>
              </div>
            )}

            <Button
              size="sm"
              className="gap-2"
              disabled={saveAccountMutation.isPending || accountQuery.isLoading}
              onClick={() => saveAccountMutation.mutate()}
            >
              {saveAccountMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Salvar
            </Button>
          </div>
        </TabsContent>

        {/* ── Segurança ── */}
        <TabsContent value="security" className="space-y-4">
          <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Key className="h-4 w-4 text-primary" /> Trocar Senha
            </h3>

            <form onSubmit={handleChangePassword} className="grid gap-4 max-w-sm">
              <div>
                <Label className="text-xs text-muted-foreground">Senha atual</Label>
                <Input
                  type="password"
                  className="mt-1 bg-secondary border-border/50"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Nova senha</Label>
                <Input
                  type="password"
                  className="mt-1 bg-secondary border-border/50"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Confirmar nova senha</Label>
                <Input
                  type="password"
                  className="mt-1 bg-secondary border-border/50"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              {changePasswordMutation.isError && (
                <p className="text-xs text-destructive">
                  {(changePasswordMutation.error as Error).message}
                </p>
              )}

              <Button
                type="submit"
                size="sm"
                className="gap-2 w-fit"
                disabled={changePasswordMutation.isPending}
              >
                {changePasswordMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : changePasswordMutation.isSuccess ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Key className="h-4 w-4" />
                )}
                {changePasswordMutation.isSuccess ? "Senha alterada!" : "Alterar senha"}
              </Button>
            </form>
          </div>
        </TabsContent>

        {/* ── Notificações ── */}
        <TabsContent value="notifications" className="space-y-4">
          <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" /> Notificações via WhatsApp
            </h3>
            <p className="text-xs text-muted-foreground">
              Escolha onde receber alertas do sistema (conclusão de campanhas, novos agendamentos, etc.).
            </p>

            {settingsQuery.isLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
              </div>
            ) : (
              <div className="max-w-sm space-y-4">
                {/* Mode selector */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNotifMode("phone")}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium border transition-colors flex-1 justify-center
                      ${notifMode === "phone"
                        ? "border-transparent text-white"
                        : "border-border/50 text-muted-foreground hover:bg-secondary"
                      }`}
                    style={notifMode === "phone" ? { background: "linear-gradient(135deg, hsl(192 91% 52%), hsl(265 80% 60%))" } : undefined}
                  >
                    <Phone className="h-3.5 w-3.5" />
                    Número de telefone
                  </button>
                  <button
                    type="button"
                    onClick={() => { setNotifMode("group"); if (!groupsQuery.data) groupsQuery.refetch(); }}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium border transition-colors flex-1 justify-center
                      ${notifMode === "group"
                        ? "border-transparent text-white"
                        : "border-border/50 text-muted-foreground hover:bg-secondary"
                      }`}
                    style={notifMode === "group" ? { background: "linear-gradient(135deg, hsl(192 91% 52%), hsl(265 80% 60%))" } : undefined}
                  >
                    <Users className="h-3.5 w-3.5" />
                    Grupo do WhatsApp
                  </button>
                </div>

                {notifMode === "phone" ? (
                  <div>
                    <Label className="text-xs text-muted-foreground">Número WhatsApp (com DDI)</Label>
                    <Input
                      className="mt-1 bg-secondary border-border/50"
                      value={notifPhone}
                      onChange={(e) => setNotifPhone(e.target.value)}
                      placeholder="5511999999999"
                    />
                  </div>
                ) : (
                  <div>
                    <Label className="text-xs text-muted-foreground">Grupo do WhatsApp</Label>
                    <div className="flex items-center gap-1 mt-1">
                      <div className="flex-1 relative">
                        {groupsQuery.isLoading ? (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                            <Loader2 className="h-4 w-4 animate-spin" /> Carregando grupos...
                          </div>
                        ) : groupsQuery.isError ? (
                          <p className="text-xs text-destructive py-2">
                            Erro: {(groupsQuery.error as Error)?.message || "Falha ao buscar grupos"}
                          </p>
                        ) : (groupsQuery.data?.length ?? 0) === 0 ? (
                          <p className="text-xs text-muted-foreground py-2">
                            Nenhum grupo encontrado. Clique em atualizar.
                          </p>
                        ) : (
                          <Select value={notifGroupJid} onValueChange={setNotifGroupJid}>
                            <SelectTrigger className="bg-secondary border-border/50 h-9 text-sm">
                              <SelectValue placeholder="Selecione um grupo..." />
                            </SelectTrigger>
                            <SelectContent>
                              <div className="px-2 pb-1 pt-1 sticky top-0 bg-popover z-10">
                                <Input
                                  placeholder="Pesquisar grupo..."
                                  value={groupSearch}
                                  onChange={(e) => setGroupSearch(e.target.value)}
                                  className="h-7 text-xs bg-secondary border-border/50"
                                  onKeyDown={(e) => e.stopPropagation()}
                                />
                              </div>
                              {(groupsQuery.data ?? [])
                                .filter((g) => g.name.toLowerCase().includes(groupSearch.toLowerCase()))
                                .map((g) => (
                                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                ))}
                              {(groupsQuery.data ?? []).filter((g) => g.name.toLowerCase().includes(groupSearch.toLowerCase())).length === 0 && (
                                <p className="text-xs text-muted-foreground px-2 py-2">Nenhum grupo encontrado.</p>
                              )}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 shrink-0 border-border/50"
                        title="Atualizar lista de grupos"
                        onClick={() => { setGroupSearch(""); groupsQuery.refetch(); }}
                        disabled={groupsQuery.isFetching}
                      >
                        <Loader2 className={`h-4 w-4 ${groupsQuery.isFetching ? "animate-spin" : ""}`} />
                      </Button>
                    </div>
                  </div>
                )}

                <Button
                  size="sm"
                  className="gap-2"
                  disabled={saveNotifMutation.isPending}
                  onClick={() => saveNotifMutation.mutate()}
                >
                  {saveNotifMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Salvar
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Agenda Pública ── */}
        <BookingSettingsTab />

        {/* ── WhatsApp Oficial ── */}
        <WhatsappOfficialTab />
      </Tabs>
    </div>
  );
}

function WhatsappOfficialTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const credsQuery = useQuery({
    queryKey: ["wa-official-settings"],
    queryFn: api.getWhatsappOfficialSettings,
  });

  const templatesQuery = useQuery({
    queryKey: ["wa-official-templates"],
    queryFn: api.getWhatsappTemplates,
  });

  const [wabaId, setWabaId] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [accessToken, setAccessToken] = useState("");

  useEffect(() => {
    if (credsQuery.data) {
      setWabaId(credsQuery.data.waba_id ?? "");
      setPhoneNumberId(credsQuery.data.phone_number_id ?? "");
      setAccessToken(credsQuery.data.access_token ?? "");
    }
  }, [credsQuery.data]);

  const saveCredsMut = useMutation({
    mutationFn: () => api.updateWhatsappOfficialSettings({ waba_id: wabaId, phone_number_id: phoneNumberId, access_token: accessToken }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wa-official-settings"] });
      toast({ title: "Credenciais salvas", description: "API Oficial do WhatsApp configurada." });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // New template form
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [tmplName, setTmplName] = useState("");
  const [tmplLanguage, setTmplLanguage] = useState("pt_BR");
  const [tmplCategory, setTmplCategory] = useState("MARKETING");
  const [tmplBodyText, setTmplBodyText] = useState("");

  const createTemplateMut = useMutation({
    mutationFn: () => api.createWhatsappTemplate({ name: tmplName, language: tmplLanguage, category: tmplCategory, body_text: tmplBodyText }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wa-official-templates"] });
      setTmplName(""); setTmplLanguage("pt_BR"); setTmplCategory("MARKETING"); setTmplBodyText("");
      setShowTemplateForm(false);
      toast({ title: "Template enviado", description: "Aguarde a aprovação da Meta." });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const syncTemplateMut = useMutation({
    mutationFn: (id: number) => api.syncWhatsappTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wa-official-templates"] });
      toast({ title: "Status atualizado" });
    },
    onError: (e: Error) => toast({ title: "Erro ao sincronizar", description: e.message, variant: "destructive" }),
  });

  const deleteTemplateMut = useMutation({
    mutationFn: (id: number) => api.deleteWhatsappTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wa-official-templates"] });
      toast({ title: "Template removido" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const importFromMetaMut = useMutation({
    mutationFn: api.importWhatsappTemplatesFromMeta,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["wa-official-templates"] });
      toast({
        title: "Templates sincronizados",
        description: `${data.imported} novos importados, ${data.updated} atualizados de ${data.total} encontrados na Meta.`,
      });
    },
    onError: (e: Error) => toast({ title: "Erro ao importar", description: e.message, variant: "destructive" }),
  });

  const templates = templatesQuery.data ?? [];

  const statusColor = (s: string) => {
    if (s === "APPROVED") return "text-green-600";
    if (s === "REJECTED" || s === "ERROR") return "text-destructive";
    return "text-amber-500";
  };

  return (
    <TabsContent value="whatsapp-official" className="space-y-4">
      {/* Credentials */}
      <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" /> Credenciais da API Oficial (Meta)
        </h3>
        <p className="text-xs text-muted-foreground">
          Configure o acesso ao WhatsApp Business API da Meta. Você encontra essas informações no{" "}
          <span className="font-medium">Meta for Developers → WhatsApp → API Setup</span>.
        </p>

        {credsQuery.isLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 max-w-2xl">
            <div>
              <Label className="text-xs text-muted-foreground">WABA ID (WhatsApp Business Account ID)</Label>
              <Input className="mt-1 bg-secondary border-border/50" value={wabaId} onChange={(e) => setWabaId(e.target.value)} placeholder="123456789012345" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Phone Number ID</Label>
              <Input className="mt-1 bg-secondary border-border/50" value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} placeholder="123456789012345" />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs text-muted-foreground">Access Token (token permanente)</Label>
              <Input type="password" className="mt-1 bg-secondary border-border/50" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder="EAABcde..." />
            </div>
          </div>
        )}

        <Button size="sm" className="gap-2" disabled={saveCredsMut.isPending || credsQuery.isLoading} onClick={() => saveCredsMut.mutate()}>
          {saveCredsMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar credenciais
        </Button>
      </div>

      {/* Templates */}
      <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" /> Templates de Mensagem
          </h3>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={importFromMetaMut.isPending}
              onClick={() => importFromMetaMut.mutate()}
              title="Importa todos os templates já criados na sua conta do Meta Business Manager"
            >
              {importFromMetaMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Importar da Meta
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => setShowTemplateForm((v) => !v)}>
              <Plus className="h-3.5 w-3.5" /> Novo template
            </Button>
          </div>
        </div>

        {showTemplateForm && (
          <div className="border border-border/50 rounded-lg p-4 space-y-3 bg-secondary/30">
            <p className="text-xs text-muted-foreground font-medium">Novo template</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs text-muted-foreground">Nome do template</Label>
                <Input className="mt-1 bg-secondary border-border/50 text-xs" value={tmplName} onChange={(e) => setTmplName(e.target.value)} placeholder="meu_template_vendas" />
                <p className="text-[10px] text-muted-foreground mt-0.5">Apenas letras minúsculas, números e underscores.</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Idioma</Label>
                  <select className="mt-1 w-full rounded-md border border-border/50 bg-secondary text-xs px-2 py-2 focus:outline-none" value={tmplLanguage} onChange={(e) => setTmplLanguage(e.target.value)}>
                    <option value="pt_BR">pt_BR</option>
                    <option value="en_US">en_US</option>
                    <option value="es">es</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Categoria</Label>
                  <select className="mt-1 w-full rounded-md border border-border/50 bg-secondary text-xs px-2 py-2 focus:outline-none" value={tmplCategory} onChange={(e) => setTmplCategory(e.target.value)}>
                    <option value="MARKETING">MARKETING</option>
                    <option value="UTILITY">UTILITY</option>
                    <option value="AUTHENTICATION">AUTHENTICATION</option>
                  </select>
                </div>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Corpo da mensagem</Label>
              <textarea
                className="mt-1 w-full rounded-md border border-border/50 bg-secondary text-xs px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                rows={4}
                value={tmplBodyText}
                onChange={(e) => setTmplBodyText(e.target.value)}
                placeholder={"Olá {{1}}, temos uma oferta especial para você! Acesse: {{2}}"}
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Use {"{{1}}"}, {"{{2}}"} para variáveis. Mapeie-as na campanha ao escolher este template.
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" disabled={!tmplName || !tmplBodyText || createTemplateMut.isPending} onClick={() => createTemplateMut.mutate()}>
                {createTemplateMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                Enviar para aprovação
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowTemplateForm(false)}>Cancelar</Button>
            </div>
          </div>
        )}

        {templatesQuery.isLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
        ) : templates.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum template cadastrado.</p>
        ) : (
          <div className="border border-border/30 rounded-lg overflow-x-auto">
            <table className="w-full text-xs min-w-[540px]">
              <thead className="bg-secondary/50 border-b border-border/40">
                <tr>
                  {["Nome", "Idioma", "Categoria", "Status", "Ações"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-[11px] uppercase text-muted-foreground tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id} className="border-b border-border/20 hover:bg-secondary/30 transition-colors">
                    <td className="px-3 py-2 font-medium text-foreground">{t.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{t.language}</td>
                    <td className="px-3 py-2 text-muted-foreground">{t.category}</td>
                    <td className={`px-3 py-2 font-medium ${statusColor(t.status)}`}>
                      {t.status}
                      {t.rejection_reason && <span className="block text-[10px] font-normal text-muted-foreground truncate max-w-[120px]">{t.rejection_reason}</span>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Sincronizar status com a Meta" disabled={syncTemplateMut.isPending} onClick={() => syncTemplateMut.mutate(t.id)}>
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Remover template" disabled={deleteTemplateMut.isPending} onClick={() => deleteTemplateMut.mutate(t.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </TabsContent>
  );
}

function BookingSettingsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({ queryKey: ["availability-settings"], queryFn: api.getAvailabilitySettings });

  const [enabled, setEnabled] = useState(false);
  const [title, setTitle] = useState("Agende uma conversa");
  const [description, setDescription] = useState("Escolha um horário disponível para conversarmos.");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("18:00");
  const [slotMin, setSlotMin] = useState("30");
  const [advanceDays, setAdvanceDays] = useState("30");
  const [minAdvanceH, setMinAdvanceH] = useState("1");
  const [bookingUrl, setBookingUrl] = useState("");

  useEffect(() => {
    if (query.data) {
      setEnabled(query.data.enabled);
      setTitle(query.data.title);
      setDescription(query.data.description);
      setDays(query.data.days);
      setStart(query.data.start);
      setEnd(query.data.end);
      setSlotMin(String(query.data.slot_min));
      setAdvanceDays(String(query.data.advance_days));
      setMinAdvanceH(String(query.data.min_advance_h));
      setBookingUrl(query.data.booking_url);
    }
  }, [query.data]);

  const saveMut = useMutation({
    mutationFn: () => api.updateAvailabilitySettings({
      enabled, title, description, days,
      start, end,
      slot_min: parseInt(slotMin),
      advance_days: parseInt(advanceDays),
      min_advance_h: parseInt(minAdvanceH),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["availability-settings"] });
      toast({ title: "Agenda pública salva!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  function toggleDay(d: number) {
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  }

  function copyLink() {
    navigator.clipboard.writeText(bookingUrl);
    toast({ title: "Link copiado!", description: "Cole no disparo com {{link_agendamento}} ou compartilhe diretamente." });
  }

  return (
    <TabsContent value="booking" className="space-y-4">
      {/* Link box */}
      {bookingUrl && (
        <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" /> Seu link de agendamento
          </h3>
          <div className="flex gap-2">
            <Input readOnly value={bookingUrl} className="bg-secondary border-border/50 text-xs font-mono" />
            <Button variant="outline" size="icon" className="shrink-0 border-border/50" onClick={copyLink}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="shrink-0 border-border/50" onClick={() => window.open(bookingUrl, "_blank")}>
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Use <code className="bg-secondary px-1 rounded">{"{{link_agendamento}}"}</code> nos textos dos funis e campanhas para inserir este link automaticamente com o telefone do lead.
          </p>
        </div>
      )}

      <div className="rounded-xl border border-border/50 bg-card p-5 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" /> Configurações da Agenda
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{enabled ? "Ativa" : "Inativa"}</span>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </div>

        {query.isLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="text-xs text-muted-foreground">Título da página</Label>
                <Input className="mt-1 bg-secondary border-border/50" value={title}
                  onChange={e => setTitle(e.target.value)} placeholder="Agende uma conversa" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Início</Label>
                  <Input type="time" className="mt-1 bg-secondary border-border/50" value={start}
                    onChange={e => setStart(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Fim</Label>
                  <Input type="time" className="mt-1 bg-secondary border-border/50" value={end}
                    onChange={e => setEnd(e.target.value)} />
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Descrição</Label>
              <Textarea className="mt-1 bg-secondary border-border/50 resize-none text-sm" rows={2}
                value={description} onChange={e => setDescription(e.target.value)} />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Dias disponíveis</Label>
              <div className="flex gap-1.5 flex-wrap">
                {DAY_LABELS.map((d, i) => (
                  <button key={i} onClick={() => toggleDay(i)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors
                      ${days.includes(i)
                        ? "border-transparent text-white"
                        : "border-border/50 text-muted-foreground hover:bg-secondary"
                      }`}
                    style={days.includes(i) ? { background: "linear-gradient(135deg, hsl(192 91% 52%), hsl(265 80% 60%))" } : undefined}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Duração do slot</Label>
                <Select value={slotMin} onValueChange={setSlotMin}>
                  <SelectTrigger className="mt-1 bg-secondary border-border/50 h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["15","30","45","60","90","120"].map(v => (
                      <SelectItem key={v} value={v}>{v} min</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Antecedência mín.</Label>
                <Select value={minAdvanceH} onValueChange={setMinAdvanceH}>
                  <SelectTrigger className="mt-1 bg-secondary border-border/50 h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[["0","Sem mínimo"],["1","1 hora"],["2","2 horas"],["4","4 horas"],["24","1 dia"],["48","2 dias"]].map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Agenda até</Label>
                <Select value={advanceDays} onValueChange={setAdvanceDays}>
                  <SelectTrigger className="mt-1 bg-secondary border-border/50 h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[["7","7 dias"],["14","14 dias"],["30","30 dias"],["60","60 dias"],["90","90 dias"]].map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button size="sm" className="gap-2" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
              {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar configurações
            </Button>
          </div>
        )}
      </div>
    </TabsContent>
  );
}
