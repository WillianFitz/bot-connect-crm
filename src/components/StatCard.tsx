import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down';
}

export function StatCard({ title, value, change, icon: Icon, trend }: StatCardProps) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-5 transition-all hover:border-primary/30 hover:shadow-[var(--shadow-glow)]">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
        <div className="rounded-lg bg-primary/10 p-2">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold text-foreground">{value}</p>
      {change && (
        <p className={`mt-1 text-xs font-medium ${trend === 'up' ? 'text-success' : trend === 'down' ? 'text-destructive' : 'text-muted-foreground'}`}>
          {change}
        </p>
      )}
    </div>
  );
}
