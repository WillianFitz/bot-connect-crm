import { Lock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface PlanLockProps {
  minPlan: "plus" | "pro";
  locked: boolean;
  children: React.ReactNode;
}

const PLAN_NAMES: Record<string, string> = {
  plus: "Plus",
  pro: "Pro",
};

const PLAN_FEATURES: Record<string, string[]> = {
  plus: [
    "Extrator Instagram — captura seguidores e bios",
    "Extrator Google Maps — nome, telefone, site e categoria",
    "Extrator CNPJ — dados de empresas cadastradas",
    "Agente de Disparo de prospecção automática",
    "Agente de Agendamento inteligente",
    "Funis de vendas visuais",
    "Até 2.000 leads e 200 disparos/dia",
  ],
  pro: [
    "Tudo do plano Plus",
    "CRM completo com pipeline de vendas",
    "Mapa de Calor de engajamento",
    "Agendamentos avançados",
    "Leads ilimitados e 500 disparos/dia",
  ],
};

export function PlanLock({ minPlan, locked, children }: PlanLockProps) {
  const navigate = useNavigate();
  const planName = PLAN_NAMES[minPlan];
  const features = PLAN_FEATURES[minPlan] ?? [];

  if (!locked) return <>{children}</>;

  return (
    <div className="relative">
      {/* Conteúdo real — desfocado e não interativo */}
      <div
        className="pointer-events-none select-none blur-sm opacity-40 saturate-50"
        aria-hidden="true"
      >
        {children}
      </div>

      {/* Overlay de upgrade */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div className="flex flex-col items-center gap-5 rounded-2xl border border-border bg-card/95 backdrop-blur-sm shadow-2xl p-10 max-w-md w-full mx-4 text-center">
          {/* Ícone */}
          <div className="relative">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 border border-primary/20">
              <Lock className="h-8 w-8 text-primary" />
            </div>
          </div>

          {/* Título */}
          <div className="space-y-1">
            <p className="text-lg font-bold text-foreground">
              Disponível no plano {planName}
            </p>
            <p className="text-sm text-muted-foreground">
              Faça upgrade e desbloqueie este e outros recursos avançados.
            </p>
          </div>

          {/* Lista de features */}
          <ul className="w-full space-y-2 text-left">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Zap className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
          </ul>

          {/* CTA */}
          <Button
            className="w-full gap-2"
            onClick={() => navigate("/app/settings")}
          >
            <Zap className="h-4 w-4" />
            Fazer upgrade para o plano {planName}
          </Button>
        </div>
      </div>
    </div>
  );
}
