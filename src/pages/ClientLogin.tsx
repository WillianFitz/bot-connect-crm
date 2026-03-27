import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import { Zap, Eye, EyeOff, Loader2, Bot, Megaphone, GitBranch, Users } from "lucide-react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const FEATURES = [
  { icon: Bot,       label: "Agente de IA",    desc: "Atendimento automático inteligente 24/7" },
  { icon: Megaphone, label: "Disparos",         desc: "Campanhas com funis de mensagens sequenciais" },
  { icon: GitBranch, label: "Funis visuais",    desc: "Monte sequências arrastando blocos" },
  { icon: Users,     label: "Gestão de leads",  desc: "CRM Kanban e extração via Instagram" },
];

export default function ClientLogin() {
  const [username, setUsername]   = useState("");
  const [password, setPassword]   = useState("");
  const [showPass, setShowPass]   = useState(false);
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: api.clientLogin,
    onSuccess: (data) => {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("tenant_id", data.tenantId);
        localStorage.setItem("user", data.username);
        if (data.token) localStorage.setItem("auth_token", data.token);
      }
      navigate("/app");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({ username, password });
  };

  return (
    <div className="min-h-screen flex bg-background overflow-hidden">

      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col items-center justify-center p-12 overflow-hidden">

        {/* Gradient background */}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(145deg, hsl(222 47% 7%) 0%, hsl(222 47% 5%) 100%)" }}
        />

        {/* Glow orbs */}
        <div
          className="absolute top-[-80px] left-[-80px] w-[420px] h-[420px] rounded-full opacity-20 blur-[100px] pointer-events-none"
          style={{ background: "radial-gradient(circle, hsl(192 91% 52%), transparent 70%)" }}
        />
        <div
          className="absolute bottom-[-60px] right-[-60px] w-[360px] h-[360px] rounded-full opacity-15 blur-[90px] pointer-events-none"
          style={{ background: "radial-gradient(circle, hsl(265 80% 60%), transparent 70%)" }}
        />

        {/* Dot grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.035] pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(hsl(210 40% 96%) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        {/* Content */}
        <div className="relative z-10 max-w-md w-full space-y-10">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg"
              style={{ background: "linear-gradient(135deg, hsl(192 91% 52%), hsl(265 80% 60%))" }}
            >
              <Zap className="h-6 w-6 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-3xl font-extrabold tracking-tight text-foreground">
              LeadFlow<span style={{ color: "hsl(192 91% 52%)" }}>AI</span>
            </span>
          </div>

          {/* Tagline */}
          <div className="space-y-3">
            <h2 className="text-4xl font-bold leading-tight text-foreground">
              Automatize sua<br />
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(90deg, hsl(192 91% 52%), hsl(265 80% 60%))" }}
              >
                prospecção com IA
              </span>
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Capture leads, dispare campanhas, atenda automaticamente e feche mais negócios — tudo em um só lugar.
            </p>
          </div>

          {/* Feature list */}
          <div className="space-y-4">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: "hsl(192 91% 52% / 0.12)", border: "1px solid hsl(192 91% 52% / 0.25)" }}
                >
                  <Icon className="h-4 w-4" style={{ color: "hsl(192 91% 52%)" }} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom badge */}
          <div
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs text-muted-foreground"
            style={{ background: "hsl(222 47% 10%)", border: "1px solid hsl(222 30% 16%)" }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full animate-pulse"
              style={{ background: "hsl(142 71% 45%)" }}
            />
            Powered by Cloudflare Workers + OpenAI
          </div>
        </div>
      </div>

      {/* ── Right panel (login form) ── */}
      <div className="flex flex-1 items-center justify-center p-6 relative">

        {/* Mobile bg orb */}
        <div
          className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10 blur-[80px] pointer-events-none lg:hidden"
          style={{ background: "radial-gradient(circle, hsl(192 91% 52%), transparent 70%)" }}
        />

        <div className="w-full max-w-sm space-y-8 relative z-10">

          {/* Mobile logo */}
          <div className="flex flex-col items-center gap-3 lg:hidden">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg"
              style={{ background: "linear-gradient(135deg, hsl(192 91% 52%), hsl(265 80% 60%))" }}
            >
              <Zap className="h-7 w-7 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-2xl font-extrabold text-foreground">
              LeadFlow<span style={{ color: "hsl(192 91% 52%)" }}>AI</span>
            </span>
          </div>

          {/* Card */}
          <div
            className="rounded-2xl p-8 space-y-6"
            style={{
              background: "hsl(222 47% 8%)",
              border: "1px solid hsl(222 30% 16%)",
              boxShadow: "0 24px 64px hsl(222 47% 3% / 0.6)",
            }}
          >
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-foreground">Entrar na plataforma</h1>
              <p className="text-xs text-muted-foreground">Use suas credenciais de acesso</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Usuário</Label>
                <Input
                  autoComplete="username"
                  placeholder="seu.usuario"
                  className="bg-secondary/60 border-border/60 h-10 text-sm focus-visible:ring-1 placeholder:text-muted-foreground/40"
                  style={{ "--ring": "hsl(192 91% 52%)" } as React.CSSProperties}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Senha</Label>
                <div className="relative">
                  <Input
                    type={showPass ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="bg-secondary/60 border-border/60 h-10 text-sm pr-10 focus-visible:ring-1 placeholder:text-muted-foreground/40"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowPass((v) => !v)}
                    tabIndex={-1}
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {mutation.isError && (
                <div
                  className="rounded-lg px-3 py-2.5 text-xs text-red-400"
                  style={{ background: "hsl(0 72% 51% / 0.1)", border: "1px solid hsl(0 72% 51% / 0.25)" }}
                >
                  {(mutation.error as Error).message || "Usuário ou senha inválidos"}
                </div>
              )}

              {/* Submit */}
              <Button
                type="submit"
                className="w-full h-11 text-sm font-semibold mt-2 relative overflow-hidden"
                disabled={mutation.isPending}
                style={{
                  background: mutation.isPending
                    ? "hsl(192 91% 40%)"
                    : "linear-gradient(135deg, hsl(192 91% 52%), hsl(265 80% 60%))",
                  border: "none",
                  color: "hsl(222 47% 6%)",
                }}
              >
                {mutation.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Entrando...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Zap className="h-4 w-4" strokeWidth={2.5} />
                    Entrar
                  </span>
                )}
              </Button>
            </form>
          </div>

          <p className="text-center text-[11px] text-muted-foreground/50 space-x-2">
            <span>© 2026 LeadFlowAI</span>
            <span>·</span>
            <Link to="/terms" className="hover:text-muted-foreground transition-colors">Termos de Uso</Link>
            <span>·</span>
            <Link to="/privacy" className="hover:text-muted-foreground transition-colors">Privacidade</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
