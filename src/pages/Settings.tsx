import { Save, Globe, Bell, Shield, Database, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SettingsPage() {
  return (
    <div className="space-y-6 animate-slide-in w-full max-w-4xl xl:max-w-5xl 2xl:max-w-6xl">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground">Gerencie as configurações do sistema</p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="bg-secondary border border-border/50">
          <TabsTrigger value="general">Geral</TabsTrigger>
          <TabsTrigger value="integrations">Integrações</TabsTrigger>
          <TabsTrigger value="notifications">Notificações</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Globe className="h-4 w-4 text-primary" /> Informações da Conta</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label className="text-xs text-muted-foreground">Nome da Empresa</Label><Input className="mt-1 bg-secondary border-border/50" defaultValue="Minha Empresa" /></div>
              <div><Label className="text-xs text-muted-foreground">Email</Label><Input className="mt-1 bg-secondary border-border/50" defaultValue="admin@empresa.com" /></div>
            </div>
            <Button size="sm" className="gap-2"><Save className="h-4 w-4" /> Salvar</Button>
          </div>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4">
          <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Key className="h-4 w-4 text-primary" /> APIs & Integrações</h3>
            {[
              { name: 'WhatsApp API', desc: 'Conecte sua conta do WhatsApp Business', connected: false },
              { name: 'Instagram DM', desc: 'Integre com Instagram Direct', connected: false },
              { name: 'Google Sheets', desc: 'Sincronize agendamentos com Google Sheets', connected: true },
              { name: 'Cloudflare Workers', desc: 'Backend API endpoint', connected: true },
            ].map(int => (
              <div key={int.name} className="flex items-center justify-between py-3 border-b border-border/30 last:border-0">
                <div>
                  <p className="text-sm font-medium text-foreground">{int.name}</p>
                  <p className="text-xs text-muted-foreground">{int.desc}</p>
                </div>
                <Button variant={int.connected ? "outline" : "default"} size="sm" className="border-border/50">
                  {int.connected ? 'Conectado' : 'Conectar'}
                </Button>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Bell className="h-4 w-4 text-primary" /> Notificações</h3>
            {['Novo lead capturado', 'Resposta recebida', 'Reunião agendada', 'Lead qualificado'].map(notif => (
              <div key={notif} className="flex items-center justify-between py-2">
                <span className="text-sm text-foreground">{notif}</span>
                <Switch defaultChecked />
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
