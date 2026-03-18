import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export default function Admin() {
  const [tenantName, setTenantName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [document, setDocument] = useState("");
  const queryClient = useQueryClient();

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: api.adminListUsers,
  });

  const mutation = useMutation({
    mutationFn: api.adminCreateTenantUser,
    onSuccess: (data) => {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      tenantName,
      username,
      password,
      document,
    });
  };

  return (
    <div className="space-y-6 animate-slide-in max-w-5xl mx-auto py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin — Contas</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie todas as contas, usuários e acessos do LeadFlowAI.
          </p>
        </div>
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
                    ID da Conta
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] uppercase text-muted-foreground tracking-wide">
                    Usuário
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] uppercase text-muted-foreground tracking-wide">
                    CPF/CNPJ
                  </th>
                  <th className="px-3 py-2 text-right text-[11px] uppercase text-muted-foreground tracking-wide">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {usersQuery.data?.length ? (
                  usersQuery.data.map((u) => (
                    <tr
                      key={u.id}
                      className="border-b border-border/20 hover:bg-secondary/30 transition-colors"
                    >
                      <td className="px-3 py-2 text-xs">
                        <div className="font-medium text-foreground">
                          {u.tenant_name}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs font-mono text-muted-foreground">
                        {u.tenant_id}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {u.username}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {u.document}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => deleteMutation.mutate(u.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))
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

