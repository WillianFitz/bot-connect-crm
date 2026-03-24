import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Trash2, Ban, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PLAN_LABELS: Record<string, { label: string; className: string }> = {
  starter: { label: "Starter", className: "bg-secondary text-secondary-foreground" },
  plus: { label: "Plus", className: "bg-blue-500/20 text-blue-400" },
  pro: { label: "Pro", className: "bg-primary/20 text-primary" },
};

type AdminUser = {
  id: number;
  tenant_id: string;
  tenant_name: string;
  username: string;
  document: string;
  created_at: string;
  plan: string;
  blocked: number;
};

export default function Admin() {
  const [tenantName, setTenantName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [document, setDocument] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: api.adminListUsers,
  });

  const mutation = useMutation({
    mutationFn: api.adminCreateTenantUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setTenantName("");
      setUsername("");
      setPassword("");
      setDocument("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.adminDeleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const setPlanMutation = useMutation({
    mutationFn: api.adminSetPlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "Plano atualizado com sucesso." });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar plano.", variant: "destructive" });
    },
  });

  const toggleBlockMutation = useMutation({
    mutationFn: api.adminToggleBlock,
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: vars.blocked ? "Conta bloqueada." : "Conta desbloqueada." });
    },
    onError: () => {
      toast({ title: "Erro ao alterar status da conta.", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({ tenantName, username, password, document });
  };

  const users = (usersQuery.data as AdminUser[] | undefined) ?? [];

  return (
    <div className="space-y-6 animate-slide-in max-w-6xl mx-auto py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin — Contas</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie todas as contas, planos e acessos do LeadFlowAI.
          </p>
        </div>
      </div>

      {/* Plans info */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            name: "Starter",
            color: "border-border/50",
            features: [
              "500 leads",
              "Extrator WhatsApp",
              "50 disparos/dia",
              "Inbox + Agente Atendimento",
            ],
          },
          {
            name: "Plus",
            color: "border-blue-500/40",
            features: [
              "2.000 leads",
              "Todos os extratores",
              "200 disparos/dia",
              "Funis + Agente Disparo/Agendamento",
            ],
          },
          {
            name: "Pro",
            color: "border-primary/40",
            features: [
              "Leads ilimitados",
              "Todos os extratores",
              "500 disparos/dia",
              "CRM + Mapa de Calor + Agendamentos",
            ],
          },
        ].map((plan) => (
          <div
            key={plan.name}
            className={`rounded-xl border ${plan.color} bg-card p-4`}
          >
            <div className="text-sm font-semibold text-foreground mb-2">
              {plan.name}
            </div>
            <ul className="space-y-1">
              {plan.features.map((f) => (
                <li key={f} className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-[2fr,1.2fr]">
        <div className="rounded-xl border border-border/50 bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">
            Contas cadastradas
          </h2>
          <div className="border border-border/30 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 border-b border-border/40">
                <tr>
                  <th className="px-3 py-2 text-left text-[11px] uppercase text-muted-foreground tracking-wide">
                    Conta
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] uppercase text-muted-foreground tracking-wide">
                    Usuário
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] uppercase text-muted-foreground tracking-wide">
                    Plano
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] uppercase text-muted-foreground tracking-wide">
                    Status
                  </th>
                  <th className="px-3 py-2 text-right text-[11px] uppercase text-muted-foreground tracking-wide">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.length ? (
                  users.map((u) => {
                    const planInfo = PLAN_LABELS[u.plan] ?? PLAN_LABELS.starter;
                    return (
                      <tr
                        key={u.id}
                        className="border-b border-border/20 hover:bg-secondary/30 transition-colors"
                      >
                        <td className="px-3 py-2 text-xs">
                          <div className="font-medium text-foreground">{u.tenant_name}</div>
                          <div className="text-[10px] font-mono text-muted-foreground/60">{u.tenant_id}</div>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {u.username}
                        </td>
                        <td className="px-3 py-2">
                          <Select
                            value={u.plan ?? "starter"}
                            onValueChange={(val) =>
                              setPlanMutation.mutate({ tenant_id: u.tenant_id, plan: val })
                            }
                          >
                            <SelectTrigger className="h-6 text-[11px] w-24 px-2">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="starter">Starter</SelectItem>
                              <SelectItem value="plus">Plus</SelectItem>
                              <SelectItem value="pro">Pro</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-2">
                          {u.blocked ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-destructive">
                              <Ban className="h-3 w-3" /> Bloqueado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-green-500">
                              <CheckCircle2 className="h-3 w-3" /> Ativo
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-7 w-7 ${u.blocked ? "text-green-500" : "text-yellow-500"}`}
                              title={u.blocked ? "Desbloquear conta" : "Bloquear conta"}
                              onClick={() =>
                                toggleBlockMutation.mutate({
                                  tenant_id: u.tenant_id,
                                  blocked: !u.blocked,
                                })
                              }
                            >
                              {u.blocked ? (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              ) : (
                                <Ban className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              title="Excluir usuário"
                              onClick={() => deleteMutation.mutate(u.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-6 text-center text-xs text-muted-foreground"
                    >
                      Nenhuma conta cadastrada ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-border/50 bg-card p-5 space-y-4"
        >
          <h2 className="text-sm font-semibold text-foreground">
            Nova conta
          </h2>
          <div className="grid gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">
                Nome da conta
              </Label>
              <Input
                className="mt-1 bg-secondary border-border/50"
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                placeholder="Ex: Empresa XPTO"
                required
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">
                Usuário de acesso
              </Label>
              <Input
                className="mt-1 bg-secondary border-border/50"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="email ou login"
                required
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Senha</Label>
              <Input
                type="password"
                className="mt-1 bg-secondary border-border/50"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">
                CPF ou CNPJ do cliente
              </Label>
              <Input
                className="mt-1 bg-secondary border-border/50"
                value={document}
                onChange={(e) => setDocument(e.target.value)}
                placeholder="Somente números"
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full mt-2"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Criando..." : "Criar conta"}
          </Button>

          {mutation.isError && (
            <p className="text-xs text-destructive mt-2">
              {(mutation.error as Error).message}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
