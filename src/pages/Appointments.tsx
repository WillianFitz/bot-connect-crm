import { mockAppointments } from "@/data/mock";
import { CalendarCheck, Phone, Building2, Clock, CheckCircle2, XCircle, AlertCircle, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const statusConfig = {
  scheduled: { label: 'Agendado', icon: Clock, className: 'bg-primary/20 text-primary' },
  completed: { label: 'Concluído', icon: CheckCircle2, className: 'bg-success/20 text-success' },
  cancelled: { label: 'Cancelado', icon: XCircle, className: 'bg-destructive/20 text-destructive' },
  no_show: { label: 'Não Compareceu', icon: AlertCircle, className: 'bg-warning/20 text-warning' },
};

export default function Appointments() {
  return (
    <div className="space-y-6 animate-slide-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Agendamentos</h1>
          <p className="text-sm text-muted-foreground">Reuniões agendadas pelos agentes de IA</p>
        </div>
        <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Novo Agendamento</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {mockAppointments.map(apt => {
          const config = statusConfig[apt.status];
          const StatusIcon = config.icon;

          return (
            <div key={apt.id} className="rounded-xl border border-border/50 bg-card p-5 hover:border-primary/20 transition-all">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-foreground">{apt.leadName}</h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Building2 className="h-3 w-3" /> {apt.company}
                  </p>
                </div>
                <Badge variant="secondary" className={`text-[10px] ${config.className}`}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {config.label}
                </Badge>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <CalendarCheck className="h-4 w-4 text-primary" />
                  <span className="text-foreground">{new Date(apt.date).toLocaleDateString('pt-BR')} às {apt.time}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{apt.phone}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
