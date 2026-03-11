import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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

  const connectionQuery = useQuery({
    queryKey: ["whatsapp-connection"],
    queryFn: api.getWhatsappConnection,
  });

  const updateMutation = useMutation({
    mutationFn: api.updateWhatsappConnection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-connection"] });
    },
  });

  const data = connectionQuery.data;
  const isConnected = data?.status === "connected";

  async function handleShowQr() {
    setQrLoading(true);
    setQrError(null);
    try {
      const res = await api.getWhatsappQr();
      if (!res.qr) {
        setQr(null);
        setQrError(
          res.error || "QR ainda não disponível. Aguarde alguns segundos e tente novamente.",
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

  const qrImageUrl =
    qr != null
      ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
          qr,
        )}`
      : null;

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
            <span className="font-semibold">“Ver QR para conectar”</span> para
            abrir o código no próprio sistema e escanear com seu WhatsApp
            Business.
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
          <Button
            className="gap-2"
            variant={isConnected ? "outline" : "default"}
            size="sm"
            disabled={updateMutation.isPending}
            onClick={() =>
              updateMutation.mutate({
                status: isConnected ? "disconnected" : "connected",
                agent_enabled: !!data?.agent_enabled,
                reply_all: !!data?.reply_all,
              })
            }
          >
            {updateMutation.isPending && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            {isConnected ? "Excluir / Desconectar" : "Marcar como conectado"}
          </Button>

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
              este código.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center gap-3 py-4">
            {qrImageUrl ? (
              <img
                src={qrImageUrl}
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


