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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Instagram, MapPin, FileText, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";

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
  const [igUser, setIgUser] = useState("");
  const [igPass, setIgPass] = useState("");
  const [twoFaCode, setTwoFaCode] = useState("");
  const [waiting2FA, setWaiting2FA] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

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

  const igConfigQuery = useQuery({
    queryKey: ["instagramConfig"],
    queryFn: () => api.getInstagramConfig(),
  });

  const loginStartMutation = useMutation({
    mutationFn: (payload: { username: string; password: string }) =>
      api.instagramLoginStart(payload),
    onSuccess: async (data, variables) => {
      if (data.status === "ok") {
        toast({
          title: "Login concluído",
          description: "Login no Instagram feito com sucesso.",
        });
        setWaiting2FA(false);
        setTwoFaCode("");
        setIgPass("");
        // salva só o usuário para exibir na tela
        try {
          await api.saveInstagramConfig({
            username: variables.username,
            password: "********",
          });
          queryClient.invalidateQueries({ queryKey: ["instagramConfig"] });
        } catch {
          // ignore erro de salvar config
        }
      } else if (data.status === "2fa_required") {
        toast({
          title: "2FA necessário",
          description:
            data.message ||
            "Informe o código enviado pelo Instagram para concluir o login.",
        });
        setWaiting2FA(true);
      }
    },
    onError: (err: any) => {
      toast({
        title: "Erro ao iniciar login",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const loginVerifyMutation = useMutation({
    mutationFn: (payload: { code: string }) => api.instagramLoginVerify(payload),
    onSuccess: () => {
      toast({
        title: "Login concluído",
        description: "Código 2FA validado com sucesso. Sessão ativa.",
      });
      setWaiting2FA(false);
      setTwoFaCode("");
      setIgPass("");
    },
    onError: (err: any) => {
      toast({
        title: "Erro ao validar 2FA",
        description: err?.message || "Código inválido ou expirado.",
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
                <CardTitle>Conexão Instagram</CardTitle>
                <CardDescription>
                  Conecte uma conta de Instagram (não oficial) para usar no
                  extrator de seguidores.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1 text-sm">
                    <p className="font-medium">Status da conexão</p>
                    <p className="text-xs text-muted-foreground">
                      {igConfigQuery.data?.username
                        ? `Conectado como ${igConfigQuery.data.username}`
                        : "Nenhuma conta conectada."}
                    </p>
                  </div>
                  <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Instagram className="h-4 w-4 mr-2" />
                        Conectar Instagram
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Conectar Instagram</DialogTitle>
                        <DialogDescription>
                          Faça login como se fosse no próprio Instagram. Usaremos
                          essa sessão apenas para extrair seguidores.
                        </DialogDescription>
                      </DialogHeader>

                      <div className="space-y-4 pt-2">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            Usuário / e-mail
                          </label>
                          <Input
                            placeholder="usuario ou email do Instagram"
                            value={igUser}
                            onChange={(e) => setIgUser(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Senha</label>
                          <Input
                            type="password"
                            placeholder="Senha do Instagram"
                            value={igPass}
                            onChange={(e) => setIgPass(e.target.value)}
                          />
                        </div>

                        <p className="text-xs text-muted-foreground leading-relaxed">
                          As credenciais são usadas apenas pelo serviço de
                          extração no Railway para abrir uma sessão autenticada
                          no Instagram. Use sempre contas não oficiais.
                        </p>

                        <div className="flex flex-col gap-2">
                          <Button
                            onClick={() =>
                              loginStartMutation.mutate({
                                username: igUser,
                                password: igPass,
                              })
                            }
                            disabled={
                              !igUser.trim() ||
                              !igPass.trim() ||
                              loginStartMutation.isPending
                            }
                            className="w-full md:w-auto"
                          >
                            {loginStartMutation.isPending && (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Fazer login
                          </Button>

                          {waiting2FA && (
                            <div className="space-y-2 border-t pt-3 mt-2">
                              <label className="text-sm font-medium">
                                Código 2FA (Instagram)
                              </label>
                              <div className="flex flex-col md:flex-row gap-2">
                                <Input
                                  placeholder="Código recebido por SMS/app/e-mail"
                                  value={twoFaCode}
                                  onChange={(e) =>
                                    setTwoFaCode(e.target.value)
                                  }
                                />
                                <Button
                                  variant="outline"
                                  onClick={() =>
                                    loginVerifyMutation.mutate({
                                      code: twoFaCode,
                                    })
                                  }
                                  disabled={
                                    !twoFaCode.trim() ||
                                    loginVerifyMutation.isPending
                                  }
                                >
                                  {loginVerifyMutation.isPending && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  )}
                                  Confirmar código
                                </Button>
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                Abra o Instagram (app ou e-mail), copie o
                                código enviado e cole aqui para concluir o
                                login.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                {igConfigQuery.data && (
                  <p className="text-[11px] text-muted-foreground">
                    Status atual:{" "}
                    {igConfigQuery.data.username
                      ? `Usuário configurado (${igConfigQuery.data.username}).`
                      : "Nenhum login salvo ainda."}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Extrator de seguidores do Instagram</CardTitle>
                <CardDescription>
                  Depois de configurar o login acima, escolha um perfil público
                  para iniciar a extração dos seguidores.
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
                  são feitas pelo serviço no Railway. Aqui você apenas dispara
                  o job e acompanha o status.
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

