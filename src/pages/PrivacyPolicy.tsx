import { Link } from "react-router-dom";
import { Zap, ArrowLeft } from "lucide-react";

export default function PrivacyPolicy() {
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
          <h1 className="text-3xl font-bold mb-1">Política de Privacidade</h1>
          <p className="text-sm text-muted-foreground">Última atualização: março de 2026</p>
        </div>

        <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">1. Introdução</h2>
            <p>
              Esta Política de Privacidade descreve como a LeadFlowAI coleta, usa, armazena e protege
              os dados pessoais dos usuários da Plataforma, em conformidade com a Lei Geral de Proteção
              de Dados (LGPD — Lei 13.709/2018) e o Marco Civil da Internet (Lei 12.965/2014).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">2. Dados que Coletamos</h2>
            <p><strong className="text-foreground">Dados de conta:</strong> nome de empresa, nome de usuário e senha (armazenada em formato hash com PBKDF2 — nunca em texto puro).</p>
            <p><strong className="text-foreground">Dados de leads:</strong> nome/empresa, telefone e informações extras fornecidas pelo próprio Cliente ou importadas pelas extensões. Esses dados pertencem ao Cliente e são armazenados de forma isolada por conta (multi-tenant).</p>
            <p><strong className="text-foreground">Conversas de WhatsApp:</strong> mensagens trocadas entre o bot e os contatos do Cliente, necessárias para o funcionamento do agente de IA e do histórico no inbox.</p>
            <p><strong className="text-foreground">Dados de uso:</strong> logs técnicos para diagnóstico de erros. Não rastreamos comportamento de navegação para fins publicitários.</p>
            <p><strong className="text-foreground">Dados de pagamento:</strong> processados exclusivamente pelo Stripe. A LeadFlowAI não armazena números de cartão ou dados financeiros.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">3. Base Legal para o Tratamento (LGPD)</h2>
            <ul className="list-disc list-inside space-y-1">
              <li><strong className="text-foreground">Execução de contrato</strong> (Art. 7º, V): dados necessários para prestar o serviço contratado.</li>
              <li><strong className="text-foreground">Legítimo interesse</strong> (Art. 7º, IX): logs técnicos para segurança e diagnóstico.</li>
              <li><strong className="text-foreground">Consentimento</strong> (Art. 7º, I): comunicações de marketing e atualizações, quando solicitadas.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">4. Como Usamos os Dados</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Prestar e melhorar os serviços da Plataforma.</li>
              <li>Processar pagamentos e gerenciar assinaturas.</li>
              <li>Garantir a segurança das contas (autenticação, rate limiting).</li>
              <li>Fornecer suporte técnico quando solicitado.</li>
            </ul>
            <p>Não vendemos, compartilhamos ou comercializamos dados pessoais de Clientes com terceiros para fins publicitários.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">5. Compartilhamento de Dados</h2>
            <p>Os dados são compartilhados apenas com:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong className="text-foreground">Cloudflare:</strong> infraestrutura de hospedagem (Workers, D1, R2, Pages).</li>
              <li><strong className="text-foreground">OpenAI:</strong> mensagens de conversas para processamento pelo agente de IA (conforme os Termos da OpenAI).</li>
              <li><strong className="text-foreground">Stripe:</strong> dados de pagamento para processamento de cobranças.</li>
              <li><strong className="text-foreground">Evolution API / Meta:</strong> envio e recebimento de mensagens via WhatsApp.</li>
            </ul>
            <p>Todos os subprocessadores acima possuem suas próprias políticas de privacidade e estão sujeitos a obrigações contratuais de proteção de dados.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">6. Armazenamento e Segurança</h2>
            <p>
              Os dados são armazenados no banco de dados Cloudflare D1 (SQLite distribuído) e em armazenamento
              de objetos Cloudflare R2, com isolamento rigoroso por tenant. As comunicações são criptografadas
              em trânsito via HTTPS/TLS. Senhas são armazenadas com hash PBKDF2 (10.000 iterações).
            </p>
            <p>
              Adotamos medidas técnicas de segurança como autenticação JWT, rate limiting, validação de input
              e separação de dados por tenant. Ainda assim, nenhum sistema é 100% inviolável.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">7. Seus Direitos (LGPD — Art. 18)</h2>
            <p>Como titular de dados pessoais, você tem direito a:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong className="text-foreground">Confirmação e acesso:</strong> saber quais dados temos sobre você.</li>
              <li><strong className="text-foreground">Correção:</strong> atualizar dados incompletos ou incorretos.</li>
              <li><strong className="text-foreground">Exclusão:</strong> solicitar a exclusão permanente de todos os seus dados — disponível diretamente no painel em <strong>Configurações → Segurança → Excluir minha conta</strong>. A exclusão é irreversível e ocorre imediatamente.</li>
              <li><strong className="text-foreground">Portabilidade:</strong> solicitar seus dados em formato estruturado.</li>
              <li><strong className="text-foreground">Revogação de consentimento:</strong> a qualquer momento, para os tratamentos baseados em consentimento.</li>
            </ul>
            <p>
              Para exercer estes direitos ou esclarecer dúvidas, entre em contato pelo suporte da Plataforma.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">8. Retenção de Dados</h2>
            <p>
              Os dados são mantidos enquanto a conta estiver ativa. Após o encerramento da conta, todos os
              dados são excluídos permanentemente de nossos sistemas em até 30 dias. Dados necessários para
              obrigações legais ou fiscais podem ser retidos pelo prazo exigido por lei.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">9. Cookies e Rastreamento</h2>
            <p>
              A Plataforma utiliza o localStorage do navegador para manter a sessão autenticada (token JWT
              e identificador de tenant). Não utilizamos cookies de rastreamento ou plataformas de análise
              de comportamento de terceiros.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">10. Alterações desta Política</h2>
            <p>
              Esta Política pode ser atualizada periodicamente. Notificaremos alterações relevantes via
              aviso na Plataforma. O uso continuado após a notificação constitui aceitação da versão atualizada.
            </p>
          </section>

        </div>

        <div className="border-t border-border/50 pt-6 flex gap-4 text-xs text-muted-foreground">
          <Link to="/terms" className="hover:text-foreground transition-colors">Termos de Uso</Link>
          <Link to="/login" className="hover:text-foreground transition-colors">Voltar ao login</Link>
        </div>
      </div>
    </div>
  );
}
