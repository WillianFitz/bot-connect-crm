import { useState } from "react";
import { mockLeads } from "@/data/mock";
import { Lead, LeadOrigin, LeadStatus } from "@/types";
import { Search, Plus, Upload, Filter, MoreHorizontal, Instagram, Building2, FileText, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const statusLabels: Record<LeadStatus, string> = {
  captured: 'Capturado', first_contact: 'Primeiro Contato', response_received: 'Resposta',
  qualified: 'Qualificado', proposal_sent: 'Proposta', meeting_scheduled: 'Reunião', client: 'Cliente',
};

const statusColors: Record<LeadStatus, string> = {
  captured: 'bg-muted text-muted-foreground', first_contact: 'bg-primary/20 text-primary',
  response_received: 'bg-accent/20 text-accent', qualified: 'bg-warning/20 text-warning',
  proposal_sent: 'bg-accent/20 text-accent', meeting_scheduled: 'bg-success/20 text-success', client: 'bg-success/20 text-success',
};

const originIcons: Record<LeadOrigin, React.ReactNode> = {
  instagram: <Instagram className="h-3.5 w-3.5" />, radar: <Building2 className="h-3.5 w-3.5" />,
  cnpj: <FileText className="h-3.5 w-3.5" />, csv: <Upload className="h-3.5 w-3.5" />, manual: <User className="h-3.5 w-3.5" />,
};

export default function Leads() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [originFilter, setOriginFilter] = useState<string>("all");

  const filtered = mockLeads.filter(l => {
    const matchSearch = l.name.toLowerCase().includes(search.toLowerCase()) || l.company.toLowerCase().includes(search.toLowerCase()) || l.email.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || l.status === statusFilter;
    const matchOrigin = originFilter === "all" || l.origin === originFilter;
    return matchSearch && matchStatus && matchOrigin;
  });

  return (
    <div className="space-y-6 animate-slide-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leads</h1>
          <p className="text-sm text-muted-foreground">{mockLeads.length} leads no sistema</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2 border-border/50">
            <Upload className="h-4 w-4" /> Importar CSV
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" /> Novo Lead
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border/50 max-w-lg">
              <DialogHeader>
                <DialogTitle>Cadastrar Lead</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3 mt-4">
                {['Nome', 'Empresa', 'Telefone', 'WhatsApp', 'Email', 'Instagram', 'Cidade', 'Estado', 'Segmento', 'CNPJ'].map(field => (
                  <div key={field}>
                    <Label className="text-xs text-muted-foreground">{field}</Label>
                    <Input className="mt-1 bg-secondary border-border/50" placeholder={field} />
                  </div>
                ))}
              </div>
              <Button className="mt-4 w-full">Salvar Lead</Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9 bg-secondary border-border/50" placeholder="Buscar por nome, empresa ou email..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] bg-secondary border-border/50"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent className="bg-popover border-border/50">
            <SelectItem value="all">Todos Status</SelectItem>
            {Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={originFilter} onValueChange={setOriginFilter}>
          <SelectTrigger className="w-[150px] bg-secondary border-border/50"><SelectValue placeholder="Origem" /></SelectTrigger>
          <SelectContent className="bg-popover border-border/50">
            <SelectItem value="all">Todas Origens</SelectItem>
            <SelectItem value="instagram">Instagram</SelectItem>
            <SelectItem value="radar">Radar</SelectItem>
            <SelectItem value="cnpj">CNPJ</SelectItem>
            <SelectItem value="csv">CSV</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-secondary/50">
              {['Nome', 'Empresa', 'Contato', 'Origem', 'Segmento', 'Status', 'Tags', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(lead => (
              <tr key={lead.id} className="border-b border-border/30 hover:bg-secondary/30 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground">{lead.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{lead.company}</td>
                <td className="px-4 py-3">
                  <div className="text-xs text-muted-foreground">{lead.email}</div>
                  <div className="text-xs text-muted-foreground">{lead.phone}</div>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    {originIcons[lead.origin]} {lead.origin}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{lead.segment}</td>
                <td className="px-4 py-3">
                  <Badge variant="secondary" className={`text-[10px] ${statusColors[lead.status]}`}>{statusLabels[lead.status]}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">{lead.tags.map(t => <Badge key={t} variant="outline" className="text-[10px] border-border/50">{t}</Badge>)}</div>
                </td>
                <td className="px-4 py-3"><MoreHorizontal className="h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
