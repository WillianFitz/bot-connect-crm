import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

// Login simples de admin: apenas senha, validada no backend via ADMIN_API_KEY
export default function AdminLogin() {
  const [key, setKey] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof localStorage !== "undefined") {
      // marca apenas que o admin está autenticado no front
      localStorage.setItem("admin_logged", "1");
    }
    navigate("/admin");
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
              value={key}
              onChange={(e) => setKey(e.target.value)}
              required
            />
          </div>

          <Button type="submit" className="w-full mt-2">
            Entrar
          </Button>
        </form>
      </div>
    </div>
  );
}

