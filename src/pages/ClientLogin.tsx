import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function ClientLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: api.clientLogin,
    onSuccess: (data) => {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("tenant_id", data.tenantId);
        localStorage.setItem("user", data.username);
      }
      navigate("/");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({ username, password });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm rounded-xl border border-border/50 bg-card p-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-foreground text-center">
            Login do Cliente
          </h1>
          <p className="text-xs text-muted-foreground text-center mt-1">
            Acesse seu painel de prospecção e CRM.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Usuário</Label>
            <Input
              className="mt-1 bg-secondary border-border/50"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
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

          <Button
            type="submit"
            className="w-full mt-2"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Entrando..." : "Entrar"}
          </Button>

          {mutation.isError && (
            <p className="text-xs text-destructive mt-2 text-center">
              {(mutation.error as Error).message || "Erro ao fazer login"}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

