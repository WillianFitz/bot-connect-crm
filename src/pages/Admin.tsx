import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function Admin() {
  const [tenantName, setTenantName] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [document, setDocument] = useState("");

  const mutation = useMutation({
    mutationFn: api.adminCreateTenantUser,
    onSuccess: (data) => {
      // salva tenant_id no navegador para testes desse cliente
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("tenant_id", data.tenantId);
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      tenantId: tenantId || undefined,
      tenantName,
      username,
      password,
      document,
    });
  };

  return (
    <div className="space-y-6 animate-slide-in max-w-xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Admin - Clientes</h1>
        <p className="text-sm text-muted-foreground">
          Cadastre usuário e senha dos seus clientes (multiempresa).
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-border/50 bg-card p-5 space-y-4"
      >
        <div className="grid gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">
              Nome da empresa
            </Label>
            <Input
              className="mt-1 bg-secondary border-border/50"
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
              placeholder="Empresa XPTO"
              required
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">
              ID da empresa (opcional)
            </Label>
            <Input
              className="mt-1 bg-secondary border-border/50"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              placeholder="Deixe em branco para gerar automático"
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
          {mutation.isPending ? "Salvando..." : "Criar cliente"}
        </Button>

        {mutation.isSuccess && (
          <p className="text-xs text-success mt-2">
            Cliente criado com sucesso. Tenant ID:{" "}
            <span className="font-mono">{mutation.data.tenantId}</span>
          </p>
        )}
        {mutation.isError && (
          <p className="text-xs text-destructive mt-2">
            {(mutation.error as Error).message}
          </p>
        )}
      </form>
    </div>
  );
}

