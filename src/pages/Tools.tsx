import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import JSZip from "jszip";
import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Instagram, MapPin, FileText, MessageCircle, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "outline" | "default" }> =
    {
      pending: { label: "Pendente", variant: "outline" },
      running: { label: "Em execução", variant: "default" },
      completed: { label: "Concluído", variant: "default" },
      error: { label: "Erro", variant: "outline" },
    };

  const data = map[status] || { label: status, variant: "outline" };

  return (
    <Badge variant={data.variant} className="text-xs">
      {data.label}
    </Badge>
  );
}

const EXTENSION_FILES = [
  "manifest.json",
  "background.js",
  "content-script.js",
  "injected.js",
  "dashboard.html",
  "dashboard.js",
  "popup.html",
  "popup.js",
  "icon16.png",
  "icon48.png",
  "icon128.png",
];

const WHATSAPP_EXTENSION_FILES = [
  "manifest.json",
  "background.js",
  "content-script.js",
  "dashboard.html",
  "dashboard.js",
  "popup.html",
  "popup.js",
  "icon16.png",
  "icon48.png",
  "icon128.png",
];

const GMAPS_EXTENSION_FILES = [
  "manifest.json",
  "background.js",
  "content-script.js",
  "dashboard.html",
  "dashboard.js",
  "popup.html",
  "popup.js",
  "icon16.png",
  "icon48.png",
  "icon128.png",
];

export default function Tools() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [downloadExtensionPending, setDownloadExtensionPending] = useState(false);
  const [downloadGmapsPending, setDownloadGmapsPending] = useState(false);
  const [downloadWhatsappPending, setDownloadWhatsappPending] = useState(false);
  const tenantId =
    (typeof window !== "undefined" &&
      window.localStorage.getItem("tenant_id")) ||
    "";

  const { data: jobs, isLoading: isLoadingJobs } = useQuery({
    queryKey: ["instagramJobs"],
    queryFn: () => api.listInstagramJobs(),
  });

  const igConfigQuery = useQuery({
    queryKey: ["instagramConfig"],
    queryFn: () => api.getInstagramConfig(),
  });

  const gmapsConfigQuery = useQuery({
    queryKey: ["gmapsConfig"],
    queryFn: () => api.getGmapsConfig(),
  });

  const whatsappConfigQuery = useQuery({
    queryKey: ["whatsappConfig"],
    queryFn: () => api.getWhatsappConfig(),
  });

  async function handleDownloadExtension() {
    const tid = tenantId || (typeof window !== "undefined" && window.localStorage.getItem("tenant_id"));
    const token = igConfigQuery.data?.extensionToken;
    if (!tid || !token) {
      toast({
        title: "Não foi possível gerar a extensão",
        description: "Faça login e garanta que o Token da extensão está disponível. Recarregue a página.",
        variant: "destructive",
      });
      return;
    }
    const apiBase =
      (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ||
      window.location.origin.replace(/\/$/, "");
    const baseWithoutApi = apiBase.replace(/\/api\/?$/, "") || apiBase;
    const webhookUrl = `${baseWithoutApi}/api/tools/instagram/push-leads`;
    const frontBase = window.location.origin.replace(/\/$/, "");
    setDownloadExtensionPending(true);
    try {
      const zip = new JSZip();
      zip.file(
        "config.json",
        JSON.stringify({
          tenantId: String(tid),
          extensionToken: String(token),
          webhookUrl,
        })
      );
      for (const name of EXTENSION_FILES) {
        const res = await fetch(`${frontBase}/extensions/instagram/${name}`);
        if (res.ok) {
          const blob = await res.blob();
          zip.file(name, blob);
        }
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "instagram-extractor.zip";
      a.click();
      URL.revokeObjectURL(url);
      toast({
        title: "Extensão baixada",
        description:
          "Descompacte o ZIP, abra o Chrome em Extensões > Modo desenvolvedor > Carregar sem compactação e selecione a pasta. A extensão já virá configurada para sua conta.",
      });
    } catch (e) {
      toast({
        title: "Erro ao gerar extensão",
        description: (e as Error)?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setDownloadExtensionPending(false);
    }
  }

  async function handleDownloadGmapsExtension() {
    const tid = tenantId;
    const token = gmapsConfigQuery.data?.extensionToken;
    if (!tid || !token) {
      toast({
        title: "Não foi possível gerar a extensão",
        description: "Faça login e garanta que o Token está disponível. Recarregue a página.",
        variant: "destructive",
      });
      return;
    }
    const apiBase =
      (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ||
      window.location.origin.replace(/\/$/, "");
    const baseWithoutApi = apiBase.replace(/\/api\/?$/, "") || apiBase;
    const webhookUrl = `${baseWithoutApi}/api/tools/gmaps/push-leads`;
    const frontBase = window.location.origin.replace(/\/$/, "");
    setDownloadGmapsPending(true);
    try {
      const zip = new JSZip();
      zip.file(
        "config.json",
        JSON.stringify({ tenantId: String(tid), extensionToken: String(token), webhookUrl }),
      );
      for (const name of GMAPS_EXTENSION_FILES) {
        const res = await fetch(`${frontBase}/extensions/gmaps/${name}`);
        if (res.ok) {
          const blob = await res.blob();
          zip.file(name, blob);
        }
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "gmaps-extractor.zip";
      a.click();
      URL.revokeObjectURL(url);
      toast({
        title: "Extensão baixada",
        description:
          "Descompacte o ZIP, abra o Chrome em Extensões > Modo desenvolvedor > Carregar sem compactação e selecione a pasta.",
      });
    } catch (e) {
      toast({
        title: "Erro ao gerar extensão",
        description: (e as Error)?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setDownloadGmapsPending(false);
    }
  }

  async function handleDownloadWhatsappExtension() {
    const tid = tenantId;
    const token = whatsappConfigQuery.data?.extensionToken;
    if (!tid || !token) {
      toast({
        title: "Não foi possível gerar a extensão",
        description: "Faça login e garanta que o Token está disponível. Recarregue a página.",
        variant: "destructive",
      });
      return;
    }
    const apiBase =
      (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ||
      window.location.origin.replace(/\/$/, "");
    const baseWithoutApi = apiBase.replace(/\/api\/?$/, "") || apiBase;
    const webhookUrl = `${baseWithoutApi}/api/tools/whatsapp/push-leads`;
    const frontBase = window.location.origin.replace(/\/$/, "");
    setDownloadWhatsappPending(true);
    try {
      const zip = new JSZip();
      zip.file("config.json", JSON.stringify({ tenantId: String(tid), extensionToken: String(token), webhookUrl }));
      for (const name of WHATSAPP_EXTENSION_FILES) {
        const res = await fetch(`${frontBase}/extensions/whatsapp/${name}`);
        if (res.ok) { const blob = await res.blob(); zip.file(name, blob); }
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "whatsapp-extractor.zip"; a.click();
      URL.revokeObjectURL(url);
      toast({
        title: "Extensão baixada",
        description: "Descompacte o ZIP e carregue no Chrome (Extensões → Modo desenvolvedor → Carregar sem compactação).",
      });
    } catch (e) {
      toast({ title: "Erro ao gerar extensão", description: (e as Error)?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setDownloadWhatsappPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Ferramentas</h1>
        <p className="text-sm text-muted-foreground">
          Conecte fontes externas e extraia leads automaticamente.
        </p>
      </div>

      <Tabs defaultValue="instagram" className="space-y-4">
        <TabsList>
          <TabsTrigger value="instagram" className="flex items-center gap-2">
            <Instagram className="h-4 w-4" />
            Extrator Instagram
          </TabsTrigger>
          <TabsTrigger value="maps" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Extrator Google Maps
          </TabsTrigger>
          <TabsTrigger value="cnpj" className="flex items-center gap-2" disabled>
            <FileText className="h-4 w-4" />
            Extrator CNPJ (em breve)
          </TabsTrigger>
          <TabsTrigger value="whatsapp-groups" className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Extrator WhatsApp
          </TabsTrigger>
        </TabsList>

        <TabsContent value="instagram">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 w-full">
            <Card>
              <CardHeader>
                <CardTitle>Conexão Instagram</CardTitle>
                <CardDescription>
                  Use a extensão de navegador para capturar seguidores do
                  Instagram e enviar diretamente para sua base de leads.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Button
                    type="button"
                    onClick={handleDownloadExtension}
                    disabled={downloadExtensionPending || !tenantId || !igConfigQuery.data?.extensionToken}
                    className="w-full"
                  >
                    {downloadExtensionPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Baixar extensão (já configurada para sua conta)
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    O ZIP virá com o ID da sua conta e Token já preenchidos. Assim os leads
                    não vão para outra conta. Descompacte e carregue em Extensões
                    (modo desenvolvedor) no Chrome.
                  </p>
                </div>

                <div className="space-y-3 text-sm">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Se você já instalou a extensão por outro meio, use os dados abaixo
                    na aba Configuração da extensão (Token e Webhook são obrigatórios).
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium">
                    ID da Conta (já incluso no download; só altere se instalou a extensão manualmente)
                  </label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={tenantId || ""}
                      className="text-xs"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        if (tenantId) {
                          navigator.clipboard.writeText(tenantId);
                          toast({
                            title: "ID da Conta copiado",
                            description:
                              "Cole o ID da Conta na configuração da extensão.",
                          });
                        }
                      }}
                    >
                      <span className="text-xs">Copiar</span>
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium">
                    Token da extensão (obrigatório para funcionar)
                  </label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={igConfigQuery.data?.extensionToken || ""}
                      className="text-xs"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        if (igConfigQuery.data?.extensionToken) {
                          navigator.clipboard.writeText(
                            igConfigQuery.data.extensionToken,
                          );
                          toast({
                            title: "Token copiado",
                            description: "Cole o token na configuração da extensão.",
                          });
                        }
                      }}
                    >
                      <span className="text-xs">Copiar</span>
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium">
                    URL do Webhook (para enviar os leads)
                  </label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={`${window.location.origin.replace(
                        /\/$/,
                        "",
                      )}/api/tools/instagram/push-leads`}
                      className="text-xs"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        const url = `${window.location.origin.replace(
                          /\/$/,
                          "",
                        )}/api/tools/instagram/push-leads`;
                        navigator.clipboard.writeText(url);
                        toast({
                          title: "Webhook copiado",
                          description:
                            "Cole essa URL na configuração da extensão.",
                        });
                      }}
                    >
                      <span className="text-xs">Copiar</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Histórico de importações</CardTitle>
                <CardDescription>
                  Leads enviados pela extensão do Instagram aparecem aqui.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingJobs ? (
                  <div className="flex items-center justify-center py-8 text-sm text-muted-foreground gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando...
                  </div>
                ) : !jobs || jobs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma importação ainda. Use a extensão no Instagram para
                    capturar seguidores e enviar para sua base.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                    {jobs.map((job) => (
                      <div
                        key={job.id}
                        className="flex items-start justify-between rounded-md border bg-card px-3 py-2 text-sm"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {job.profile}
                            </span>
                            <StatusBadge status={job.status} />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Leads capturados:{" "}
                            <span className="font-semibold">
                              {job.total_leads}
                            </span>
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Criado em: {new Date(job.created_at).toLocaleString(
                              "pt-BR",
                            )}
                          </p>
                          {job.error_message && (
                            <p className="text-[11px] text-red-500">
                              Erro: {job.error_message}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="maps">
          <div className="grid gap-6 md:grid-cols-2 w-full">
            <Card>
              <CardHeader>
                <CardTitle>Extrator Google Maps</CardTitle>
                <CardDescription>
                  Busque empresas no Google Maps (ex.: "advogados em BH"), extraia nome, telefone,
                  site e categoria automaticamente e envie para sua base de leads.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Button
                    type="button"
                    onClick={handleDownloadGmapsExtension}
                    disabled={downloadGmapsPending || !tenantId || !gmapsConfigQuery.data?.extensionToken}
                    className="w-full"
                  >
                    {downloadGmapsPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Baixar extensão (já configurada para sua conta)
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Descompacte o ZIP e carregue em Extensões (modo desenvolvedor) no Chrome.
                    A extensão já vem com seu ID e Token configurados.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium">ID da Conta</label>
                  <div className="flex gap-2">
                    <Input readOnly value={tenantId || ""} className="text-xs" />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        if (tenantId) {
                          navigator.clipboard.writeText(tenantId);
                          toast({ title: "ID da Conta copiado" });
                        }
                      }}
                    >
                      <span className="text-xs">Copiar</span>
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium">Token da extensão</label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={gmapsConfigQuery.data?.extensionToken || ""}
                      className="text-xs"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        if (gmapsConfigQuery.data?.extensionToken) {
                          navigator.clipboard.writeText(gmapsConfigQuery.data.extensionToken);
                          toast({ title: "Token copiado" });
                        }
                      }}
                    >
                      <span className="text-xs">Copiar</span>
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium">URL do Webhook</label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={`${window.location.origin.replace(/\/$/, "")}/api/tools/gmaps/push-leads`}
                      className="text-xs"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        const url = `${window.location.origin.replace(/\/$/, "")}/api/tools/gmaps/push-leads`;
                        navigator.clipboard.writeText(url);
                        toast({ title: "Webhook copiado" });
                      }}
                    >
                      <span className="text-xs">Copiar</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Como usar</CardTitle>
                <CardDescription>Passo a passo para extrair leads do Google Maps</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="space-y-1">
                  <p className="font-medium text-foreground">1. Baixe e instale a extensão</p>
                  <p className="text-xs">Clique em "Baixar extensão", descompacte e carregue no Chrome (Extensões → Modo desenvolvedor → Carregar sem compactação).</p>
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-foreground">2. Abra o Dashboard da extensão</p>
                  <p className="text-xs">Clique no ícone da extensão no Chrome e em "Abrir Dashboard".</p>
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-foreground">3. Digite o termo de busca</p>
                  <p className="text-xs">Exemplo: <em>"advogados em Belo Horizonte"</em> ou <em>"clínicas de estética São Paulo"</em>. Defina a quantidade de leads e uma pasta opcional.</p>
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-foreground">4. Clique em Iniciar extração</p>
                  <p className="text-xs">A extensão abrirá o Google Maps, fará o scroll automático e entrará em cada empresa para extrair telefone, site e categoria.</p>
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-foreground">5. Envie para o LeadFlowAI</p>
                  <p className="text-xs">Clique em "Enviar leads com telefone" para importar os resultados para sua base de leads.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="whatsapp-groups">
          <div className="grid gap-6 md:grid-cols-2 w-full">
            <Card>
              <CardHeader>
                <CardTitle>Extrator WhatsApp</CardTitle>
                <CardDescription>
                  Extraia participantes de grupos do WhatsApp Web, colete números de telefone
                  automaticamente e envie para sua base de leads.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Button
                    type="button"
                    onClick={handleDownloadWhatsappExtension}
                    disabled={downloadWhatsappPending || !tenantId || !whatsappConfigQuery.data?.extensionToken}
                    className="w-full"
                  >
                    {downloadWhatsappPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Baixar extensão (já configurada para sua conta)
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Descompacte o ZIP e carregue no Chrome (Extensões → Modo desenvolvedor → Carregar sem compactação).
                    A extensão já vem com seu ID e Token configurados.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium">ID da Conta</label>
                  <div className="flex gap-2">
                    <Input readOnly value={tenantId || ""} className="text-xs" />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => { if (tenantId) { navigator.clipboard.writeText(tenantId); toast({ title: "ID da Conta copiado" }); } }}
                    >
                      <span className="text-xs">Copiar</span>
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium">Token da extensão</label>
                  <div className="flex gap-2">
                    <Input readOnly value={whatsappConfigQuery.data?.extensionToken || ""} className="text-xs" />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        if (whatsappConfigQuery.data?.extensionToken) {
                          navigator.clipboard.writeText(whatsappConfigQuery.data.extensionToken);
                          toast({ title: "Token copiado" });
                        }
                      }}
                    >
                      <span className="text-xs">Copiar</span>
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium">URL do Webhook</label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={`${window.location.origin.replace(/\/$/, "")}/api/tools/whatsapp/push-leads`}
                      className="text-xs"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        const url = `${window.location.origin.replace(/\/$/, "")}/api/tools/whatsapp/push-leads`;
                        navigator.clipboard.writeText(url);
                        toast({ title: "Webhook copiado" });
                      }}
                    >
                      <span className="text-xs">Copiar</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Como usar</CardTitle>
                <CardDescription>Passo a passo para extrair leads de grupos do WhatsApp</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="space-y-1">
                  <p className="font-medium text-foreground">1. Baixe e instale a extensão</p>
                  <p className="text-xs">Clique em "Baixar extensão", descompacte e carregue no Chrome (Extensões → Modo desenvolvedor → Carregar sem compactação).</p>
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-foreground">2. Abra o WhatsApp Web</p>
                  <p className="text-xs">Acesse web.whatsapp.com e entre no grupo desejado.</p>
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-foreground">3. Abra as Informações do grupo</p>
                  <p className="text-xs">Clique no nome do grupo no topo da conversa para abrir o painel de informações com a lista de participantes.</p>
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-foreground">4. Abra o Dashboard da extensão</p>
                  <p className="text-xs">Clique no ícone da extensão no Chrome e em "Abrir Dashboard". Defina uma pasta (opcional) e clique em "Iniciar extração".</p>
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-foreground">5. Envie para o LeadFlowAI</p>
                  <p className="text-xs">Clique em "Enviar leads com telefone" para importar os participantes com número para sua base de leads.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

