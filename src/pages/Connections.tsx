import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, PhoneCall } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export default function Connections() {
  const queryClient = useQueryClient();

  const [qr, setQr] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [testNumber, setTestNumber] = useState("");
  const [testError, setTestError] = useState<string | null>(null);

  const connectionQuery = useQuery({
    queryKey: ["whatsapp-connection"],
    queryFn: api.getWhatsappConnection,
    refetchInterval: 3000,
  });

  const updateMutation = useMutation({
    mutationFn: api.updateWhatsappConnection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-connection"] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: api.logoutWhatsappInstance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-connection"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteWhatsappInstance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-connection"] });
    },
  });

  const testMutation = useMutation({
    mutationFn: (payload: { number: string }) => api.testWhatsapp(payload),
  });

  const data = connectionQuery.data;
  const isConnected = data?.status === "connected";

  // Fecha o modal de QR automaticamente quando conectar
  useEffect(() => {
    if (isConnected && qrOpen) {
      setQrOpen(false);
      setQr(null);
      setQrError(null);
    }
  }, [isConnected, qrOpen]);

  async function handleShowQr() {
    setQrLoading(true);
    setQrError(null);
    try {
      const res = await api.getWhatsappQr();
      if (!res.qr) {
        setQr(null);
        setQrError(
          res.error ||
            "QR ainda não disponível. Abra o painel da Evolution API para verificar a instância e tente novamente em alguns segundos.",
        );
      } else {
        setQr(res.qr);
        setQrOpen(true);
      }
    } catch (err: any) {
      setQrError(err?.message || "Erro ao buscar QR.");
    } finally {
      setQrLoading(false);
    }
  }

  return (
    <div className="space-y-6 animate-slide-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Conexões</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie a conexão do seu WhatsApp com o bot.
        </p>
      </div>

      <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <PhoneCall className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Conexão WhatsApp
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Para melhor experiência e maior estabilidade na conexão,
                recomendamos utilizar o WhatsApp Business.
              </p>
            </div>
          </div>
          <Badge
            variant="secondary"
            className={
              isConnected
                ? "bg-success/20 text-success text-[10px]"
                : "text-[10px]"
            }
          >
            {isConnected ? "Conectado" : "Desconectado"}
          </Badge>
        </div>

        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Clique em{" "}
            <span className="font-semibold">“Ver QR para conectar”</span>{" "}
            para gerar o QR code da sua instância Evolution API e conectar o
            WhatsApp Business.
          </p>

          <div className="flex items-center justify-between border border-border/40 rounded-lg px-3 py-2">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground">
                Agente de atendimento ligado?
              </p>
              <p className="text-[11px] text-muted-foreground">
                Desative para apenas disparos, sem agente de IA.
              </p>
            </div>
            <Switch
              checked={!!data?.agent_enabled}
              onCheckedChange={(checked) =>
                updateMutation.mutate({
                  agent_enabled: checked,
                  status: data?.status,
                  reply_all: !!data?.reply_all,
                })
              }
            />
          </div>

          <div className="flex items-center justify-between border border-border/40 rounded-lg px-3 py-2 gap-3 flex-wrap">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground">
                Enviar mensagem de teste
              </p>
              <p className="text-[11px] text-muted-foreground">
                Digite um número WhatsApp (com DDI + DDD) para validar se a
                conexão está funcionando.
              </p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Input
                className="h-8 text-xs"
                placeholder="DDD + número (ex.: 46991209988)"
                value={testNumber}
                onChange={(e) => setTestNumber(e.target.value)}
              />
              <Button
                type="button"
                size="sm"
                className="h-8 px-3 text-xs"
                disabled={testMutation.isPending || !testNumber.trim()}
                onClick={async () => {
                  setTestError(null);
                  try {
                    const res = await testMutation.mutateAsync({
                      number: testNumber.trim(),
                    });
                    if (!res.ok && res.error) {
                      setTestError(res.error);
                    } else {
                      setTestError("Mensagem de teste enviada com sucesso.");
                    }
                  } catch (err: any) {
                    setTestError(err?.message || "Erro ao enviar mensagem de teste.");
                  }
                }}
              >
                {testMutation.isPending && (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                )}
                Testar
              </Button>
            </div>
          </div>
          {testError && (
            <p className="text-[11px] text-red-500 mt-1">{testError}</p>
          )}

          <div className="flex items-center justify-between border border-border/40 rounded-lg px-3 py-2">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground">
                Responder Todos?
              </p>
              <p className="text-[11px] text-muted-foreground">
                Se ligado responderá leads de todas origens.
              </p>
            </div>
            <Switch
              checked={!!data?.reply_all}
              onCheckedChange={(checked) =>
                updateMutation.mutate({
                  reply_all: checked,
                  status: data?.status,
                  agent_enabled: !!data?.agent_enabled,
                })
              }
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 gap-3 flex-wrap">
          {isConnected && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={logoutMutation.isPending}
                onClick={() => logoutMutation.mutate()}
              >
                {logoutMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Desconectar (logout)
              </Button>

              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="gap-2"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
              >
                {deleteMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Excluir instância / trocar número
              </Button>
            </>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleShowQr}
            disabled={qrLoading}
          >
            {qrLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            Ver QR para conectar
          </Button>
        </div>
      </div>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Escaneie o QR do WhatsApp</DialogTitle>
            <DialogDescription className="text-xs">
              Abra o WhatsApp Business no seu celular &gt; Dispositivos
              conectados &gt; Conectar um dispositivo e aponte a câmera para
              este QR code.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center gap-3 py-4">
            {qr ? (
              <img
                src={qr}
                alt="QR Code WhatsApp"
                className="rounded-lg border border-border/50 bg-white"
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                QR ainda não disponível. Feche e tente novamente em alguns
                segundos.
              </p>
            )}
            {qrError && (
              <p className="text-xs text-red-500 text-center">{qrError}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


