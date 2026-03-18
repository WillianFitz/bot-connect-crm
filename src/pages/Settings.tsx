import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Bell, Key, Building2, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

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

  const [notifPhone, setNotifPhone] = useState("");

  useEffect(() => {
    if (settingsQuery.data) {
      setNotifPhone(settingsQuery.data.notification_whatsapp_phone ?? "");
    }
  }, [settingsQuery.data]);

  const saveNotifMutation = useMutation({
    mutationFn: () => api.updateSettings({ notification_whatsapp_phone: notifPhone }),
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
        <TabsList className="bg-secondary border border-border/50">
          <TabsTrigger value="account">Minha Empresa</TabsTrigger>
          <TabsTrigger value="security">Segurança</TabsTrigger>
          <TabsTrigger value="notifications">Notificações</TabsTrigger>
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
              Informe o número que receberá alertas do sistema (erros de campanha, novos leads, etc.).
            </p>

            {settingsQuery.isLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
              </div>
            ) : (
              <div className="max-w-sm space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Número WhatsApp (com DDI)</Label>
                  <Input
                    className="mt-1 bg-secondary border-border/50"
                    value={notifPhone}
                    onChange={(e) => setNotifPhone(e.target.value)}
                    placeholder="5511999999999"
                  />
                </div>

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
      </Tabs>
    </div>
  );
}
