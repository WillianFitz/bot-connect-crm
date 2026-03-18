import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || "/api";

export default function AdminLogin() {
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (!res.ok) {
        setError("Chave inválida. Tente novamente.");
        return;
      }
      const data = (await res.json()) as { ok: boolean; token?: string };
      if (data.ok && data.token) {
        localStorage.setItem("admin_token", data.token);
        localStorage.setItem("admin_logged", "1");
        navigate("/admin");
      } else {
        setError("Falha na autenticação. Verifique se JWT_SECRET está configurado.");
      }
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm rounded-xl border border-border/50 bg-card p-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-foreground text-center">
            Login Admin
          </h1>
          <p className="text-xs text-muted-foreground text-center mt-1">
            Acesso restrito ao painel de administração do SaaS.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">
              Chave de admin
            </Label>
            <Input
              className="mt-1 bg-secondary border-border/50"
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          <Button type="submit" className="w-full mt-2" disabled={loading}>
            {loading ? "Verificando..." : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
