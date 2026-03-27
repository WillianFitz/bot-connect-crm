import { Link } from "react-router-dom";
import { Zap, ArrowLeft } from "lucide-react";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">

        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/login" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar ao login
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: "linear-gradient(135deg, hsl(192 91% 52%), hsl(265 80% 60%))" }}
          >
            <Zap className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-2xl font-extrabold">
            LeadFlow<span style={{ color: "hsl(192 91% 52%)" }}>AI</span>
          </span>
        </div>

        <div>
          <h1 className="text-3xl font-bold mb-1">Termos de Uso</h1>
          <p className="text-sm text-muted-foreground">Última atualização: março de 2026</p>
        </div>

        <div className="space-y-6 text-sm text-muted-foreground leading-relaxed prose-headings:text-foreground">

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">1. Aceitação dos Termos</h2>
            <p>
              Ao acessar e utilizar a plataforma LeadFlowAI ("Plataforma"), você ("Usuário" ou "Cliente") concorda com estes
              Termos de Uso e com nossa Política de Privacidade. Caso não concorde com alguma disposição, não utilize a Plataforma.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">2. Descrição do Serviço</h2>
            <p>
              LeadFlowAI é uma plataforma SaaS que oferece ferramentas de gestão de leads, automação de atendimento via WhatsApp
              com inteligência artificial, disparo de campanhas, funis de mensagens e CRM Kanban. A Plataforma é fornecida como
              serviço, sem instalação local, acessível via navegador web.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">3. Condições de Uso do WhatsApp</h2>
            <p>
              O uso de funcionalidades de disparo em massa via WhatsApp ("Campanhas") está sujeito aos{" "}
              <strong className="text-foreground">Termos de Serviço do WhatsApp</strong> e às políticas da Meta Platforms Inc.
              O Cliente é o único responsável pelo conteúdo das mensagens enviadas e pelo cumprimento das regras da plataforma.
            </p>
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-400">
              <strong>Aviso importante:</strong> O disparo de mensagens em massa pode resultar em bloqueio ou banimento do número
              de WhatsApp pelo WhatsApp/Meta, independentemente de qualquer ação da LeadFlowAI. A LeadFlowAI não se responsabiliza
              por banimentos, restrições ou perdas decorrentes do uso de campanhas de disparo em massa.
            </p>
            <p>
              O Cliente declara que possui consentimento dos destinatários para receber mensagens, em conformidade com a
              Lei 13.709/2018 (LGPD) e com o Marco Civil da Internet (Lei 12.965/2014).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">4. Responsabilidades do Usuário</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Utilizar a Plataforma em conformidade com a legislação brasileira vigente.</li>
              <li>Não enviar mensagens de spam, conteúdo ilegal, enganoso ou ofensivo.</li>
              <li>Manter suas credenciais de acesso em sigilo, sendo responsável por toda atividade realizada com sua conta.</li>
              <li>Garantir que os dados de contatos importados foram obtidos de forma lícita e com consentimento.</li>
              <li>Não utilizar a Plataforma para práticas que violem direitos de terceiros.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">5. Limitação de Responsabilidade</h2>
            <p>
              A LeadFlowAI não se responsabiliza por: (i) danos indiretos, lucros cessantes ou perda de dados decorrentes
              do uso da Plataforma; (ii) interrupções de serviço causadas por terceiros (WhatsApp, provedores de nuvem, OpenAI);
              (iii) resultados comerciais decorrentes de campanhas de marketing realizadas pelo Cliente.
            </p>
            <p>
              A Plataforma é fornecida "como está" ("as is"), sem garantias de disponibilidade ininterrupta ou de resultados
              específicos.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">6. Planos e Pagamentos</h2>
            <p>
              Os planos de assinatura, preços e limites estão descritos na página de planos da Plataforma. A cobrança é
              processada via Stripe. O cancelamento pode ser feito a qualquer momento pelo painel, com efeito ao final do
              período já pago.
            </p>
            <p>
              Não realizamos reembolsos proporcionais para cancelamentos antecipados, salvo nas hipóteses previstas pelo
              Código de Defesa do Consumidor (Lei 8.078/1990).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">7. Propriedade Intelectual</h2>
            <p>
              Todo o código, design, marcas e conteúdo da Plataforma são de propriedade exclusiva da LeadFlowAI. O uso
              da Plataforma não confere ao Cliente qualquer direito de propriedade intelectual sobre ela.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">8. Encerramento de Conta</h2>
            <p>
              O Cliente pode solicitar o encerramento de sua conta a qualquer momento por meio das configurações da Plataforma.
              Ao encerrar, todos os dados do Cliente serão excluídos permanentemente, conforme a{" "}
              <Link to="/privacy" className="underline text-foreground">Política de Privacidade</Link>.
            </p>
            <p>
              A LeadFlowAI reserva-se o direito de encerrar contas que violem estes Termos, mediante notificação prévia
              sempre que possível.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">9. Alterações dos Termos</h2>
            <p>
              Podemos atualizar estes Termos periodicamente. Notificaremos alterações relevantes por e-mail ou via aviso
              na Plataforma. O uso continuado após a notificação constitui aceitação dos novos termos.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">10. Lei Aplicável e Foro</h2>
            <p>
              Estes Termos são regidos pela legislação brasileira. Fica eleito o foro da comarca de domicílio do Cliente
              para dirimir eventuais controvérsias, salvo se houver disposição legal em contrário.
            </p>
          </section>

        </div>

        <div className="border-t border-border/50 pt-6 flex gap-4 text-xs text-muted-foreground">
          <Link to="/privacy" className="hover:text-foreground transition-colors">Política de Privacidade</Link>
          <Link to="/login" className="hover:text-foreground transition-colors">Voltar ao login</Link>
        </div>
      </div>
    </div>
  );
}
