import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Instagram, MapPin, FileText, Users } from "lucide-react";
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

export default function Tools() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState("");

  const { data: jobs, isLoading: isLoadingJobs } = useQuery({
    queryKey: ["instagramJobs"],
    queryFn: () => api.listInstagramJobs(),
  });

  const startMutation = useMutation({
    mutationFn: (payload: { profile: string }) =>
      api.startInstagramExtraction(payload),
    onSuccess: () => {
      toast({
        title: "Extração iniciada",
        description:
          "O job foi criado. Aguarde alguns minutos e atualize para ver novos leads.",
      });
      setProfile("");
      queryClient.invalidateQueries({ queryKey: ["instagramJobs"] });
    },
    onError: (err: any) => {
      toast({
        title: "Erro ao iniciar extração",
        description: err?.message || "Tente novamente em instantes.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ferramentas</h1>
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
          <TabsTrigger value="maps" className="flex items-center gap-2" disabled>
            <MapPin className="h-4 w-4" />
            Extrator Maps (em breve)
          </TabsTrigger>
          <TabsTrigger value="cnpj" className="flex items-center gap-2" disabled>
            <FileText className="h-4 w-4" />
            Extrator CNPJ (em breve)
          </TabsTrigger>
          <TabsTrigger
            value="whatsapp-groups"
            className="flex items-center gap-2"
            disabled
          >
            <Users className="h-4 w-4" />
            Grupos WhatsApp (em breve)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="instagram">
          <div className="grid gap-6 md:grid-cols-[1.2fr,1.8fr]">
            <Card>
              <CardHeader>
                <CardTitle>Extrator de seguidores do Instagram</CardTitle>
                <CardDescription>
                  Faça login no seu serviço de extração (Railway) e dispare
                  extrações por perfil para capturar telefones dos seguidores.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Usuário / @perfil do Instagram
                  </label>
                  <Input
                    placeholder="ex.: @meu_cliente_oficial"
                    value={profile}
                    onChange={(e) => setProfile(e.target.value)}
                  />
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  A autenticação no Instagram e a execução real da extração
                  serão feitas pelo serviço que vamos subir no Railway. Aqui
                  você apenas dispara o job e acompanha o status.
                </p>

                <Button
                  onClick={() => startMutation.mutate({ profile })}
                  disabled={!profile.trim() || startMutation.isPending}
                  className="w-full md:w-auto"
                >
                  {startMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Iniciar extração
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Histórico de extrações</CardTitle>
                <CardDescription>
                  Acompanhe o status dos jobs de extração e quantos leads foram
                  importados para sua base.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingJobs ? (
                  <div className="flex items-center justify-center py-8 text-sm text-muted-foreground gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando jobs...
                  </div>
                ) : !jobs || jobs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum job de extração ainda. Dispare seu primeiro job ao
                    lado.
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
      </Tabs>
    </div>
  );
}

