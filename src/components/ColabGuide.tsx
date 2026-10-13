import React from 'react';
import {
  ExternalLink,
  CheckCircle2,
  XCircle,
  Zap,
  ShieldCheck,
  Server,
  Cloud,
  FileCode,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

export const ColabGuide: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Intro Hero */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="flex items-center gap-2.5 text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">
          <Sparkles className="w-4 h-4" />
          Análise do Notebook Colab & Arquitetura
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
          De Google Colab para Web App Nativo: Como Funciona
        </h2>
        <p className="text-slate-300 text-sm sm:text-base mt-2 leading-relaxed max-w-3xl">
          Você enviou o link do famoso notebook{' '}
          <code className="text-cyan-300 font-mono text-xs bg-slate-950/80 px-2 py-0.5 rounded">
            Torrent_To_Google_Drive_Downloader_v2.ipynb
          </code>
          . Criamos esta aplicação completa para transformar aquele script Python em uma solução
          web moderna, visual e sem as limitações do Colab.
        </p>

        <div className="mt-4 flex items-center gap-2">
          <a
            href="https://colab.research.google.com/github/spireon-ex10/Torrent-To-Google-Drive-Downloader/blob/master/Torrent_To_Google_Drive_Downloader_v2.ipynb"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors"
          >
            <span>Ver notebook original no Colab</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Colab Notebook limitations */}
        <div className="bg-slate-900/80 border border-red-500/20 rounded-2xl p-6 shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-2 text-red-400 font-semibold text-sm mb-4">
            <XCircle className="w-5 h-5" />
            <span>Limitações do Google Colab (Notebook Python)</span>
          </div>
          <ul className="space-y-3.5 text-xs sm:text-sm text-slate-300">
            <li className="flex items-start gap-2.5">
              <span className="text-red-400 font-bold shrink-0">•</span>
              <span>
                <strong>Bloqueio de Torrents no Colab:</strong> O Google Colab gratuito proíbe o
                uso de torrents e libtorrent em suas VMs e encerra sessões automaticamente.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-red-400 font-bold shrink-0">•</span>
              <span>
                <strong>Quedas de Conexão:</strong> Se a aba do navegador for fechada ou ficar
                inativa por 30-90 minutos, o Colab desconecta e todo o download era perdido.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-red-400 font-bold shrink-0">•</span>
              <span>
                <strong>Complexidade Manual:</strong> Era necessário executar comandos Python, dar
                permissões repetidas a cada execução e colar tokens longos de autorização.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-red-400 font-bold shrink-0">•</span>
              <span>
                <strong>Sem Interface Gráfica:</strong> Toda a visualização era em texto puro de
                terminal (código Python com print).
              </span>
            </li>
          </ul>
        </div>

        {/* This Web App advantages */}
        <div className="bg-slate-900/80 border border-emerald-500/20 rounded-2xl p-6 shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm mb-4">
            <CheckCircle2 className="w-5 h-5" />
            <span>Vantagens Deste Novo Aplicativo Web</span>
          </div>
          <ul className="space-y-3.5 text-xs sm:text-sm text-slate-300">
            <li className="flex items-start gap-2.5">
              <span className="text-emerald-400 font-bold shrink-0">•</span>
              <span>
                <strong>Google Drive API Oficial:</strong> Conexão direta via OAuth oficial do
                Google com envio seguro para a pasta que você escolher.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-emerald-400 font-bold shrink-0">•</span>
              <span>
                <strong>Upload Resumível em Chunks:</strong> Protocolo oficial do Google Drive
                (Resumable Upload) que envia arquivos grandes em blocos com tolerância a falhas.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-emerald-400 font-bold shrink-0">•</span>
              <span>
                <strong>Seleção Seletiva de Arquivos:</strong> Você pode pré-visualizar o torrent e
                escolher exatamente quais arquivos deseja enviar para o Drive.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-emerald-400 font-bold shrink-0">•</span>
              <span>
                <strong>Interface em Tempo Real:</strong> Velocímetro de download e upload,
                contagem de peers, tempo estimado (ETA) e links diretos para os arquivos no Drive.
              </span>
            </li>
          </ul>
        </div>
      </div>

      {/* Architecture Flow */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-md">
        <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <Server className="w-4 h-4 text-blue-400" />
          <span>Fluxo Técnico de Transferência</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-center">
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="w-8 h-8 mx-auto mb-2 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-sm">
              1
            </div>
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Entrada Universal</h4>
            <p className="text-xs text-slate-400 mt-1">
              Você insere Links Diretos (HTTP/HTTPS), Lotes, Magnets ou arquivos locais para o Google Drive.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="w-8 h-8 mx-auto mb-2 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center font-bold text-sm">
              2
            </div>
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Download em Nuvem</h4>
            <p className="text-xs text-slate-400 mt-1">
              Download via stream direto com retomada ou enxame P2P multi-threaded com +25 rastreadores.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="w-8 h-8 mx-auto mb-2 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-sm">
              3
            </div>
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Upload Chunked</h4>
            <p className="text-xs text-slate-400 mt-1">
              Os arquivos completos são transmitidos para o Google Drive via Google Drive API v3.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="w-8 h-8 mx-auto mb-2 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-sm">
              4
            </div>
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Concluído</h4>
            <p className="text-xs text-slate-400 mt-1">
              O arquivo fica disponível no seu Drive com link direto e o cache local é liberado.
            </p>
          </div>
        </div>
      </div>

      {/* Speed & Limits FAQ Section */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-md space-y-6">
        <div className="flex items-center gap-2.5 pb-4 border-b border-slate-800/80">
          <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Velocidade, Limites e Perguntas Frequentes</h3>
            <p className="text-xs text-slate-400">
              Tudo o que você precisa saber sobre velocidade de download/upload e cotas do Google Drive
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Cloud Execution vs Local Internet */}
          <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3 md:col-span-2">
            <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
              <Cloud className="w-4 h-4" />
              <span>O download depende da minha velocidade de internet ou consome meus dados?</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              <strong className="text-emerald-400 text-sm">NÃO! A transferência é 100% executada na nuvem.</strong>
            </p>
            <p className="text-xs text-slate-300 leading-relaxed">
              O seu computador ou celular envia apenas o link magnet (um comando de texto de poucos bytes). A partir daí:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 text-xs">
                <span className="font-semibold text-white block mb-1">Zero Consumo de Dados</span>
                <span className="text-slate-400">Você não gasta seus gigabytes de plano de dados (4G/5G/Wi-Fi) no download nem no envio ao Drive.</span>
              </div>
              <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 text-xs">
                <span className="font-semibold text-white block mb-1">Velocidade de Datacenter</span>
                <span className="text-slate-400">O servidor baixa com link de fibra ótica de alta velocidade e envia diretamente aos servidores do Google Drive.</span>
              </div>
              <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 text-xs">
                <span className="font-semibold text-white block mb-1">Pode Desligar o Aparelho</span>
                <span className="text-slate-400">Como o processo roda no servidor em nuvem, você pode fechar o navegador ou desligar o dispositivo que a tarefa continua.</span>
              </div>
            </div>
          </div>

          {/* How Torrent Speed Works */}
          <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-cyan-400 font-semibold text-sm">
              <Zap className="w-4 h-4" />
              <span>Por que a velocidade varia e às vezes fica lenta?</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Diferente de um download tradicional de site (onde há um servidor central), no{' '}
              <strong>BitTorrent</strong> os arquivos vêm de outros usuários (peers) conectados:
            </p>
            <ul className="text-xs text-slate-400 space-y-2 list-disc list-inside">
              <li>
                <strong className="text-slate-200">Seeds (Semeadores):</strong> Usuários que já têm 100% do arquivo. Se um torrent tem poucos seeds (ex: 1 ou 2) ou conexões domésticas lentas, a velocidade máxima de download será naturalmente baixa, mesmo na nuvem mais rápida do mundo.
              </li>
              <li>
                <strong className="text-slate-200">Torrents com muitos Seeds:</strong> Torrents saudáveis (como os exemplos de teste no app) atingem dezenas de megabytes por segundo (MB/s).
              </li>
              <li>
                <strong className="text-slate-200">Otimizações aplicadas:</strong> Injetamos automaticamente <strong>+25 rastreadores mundiais</strong>, aumentamos o limite para <strong>250 conexões simultâneas</strong> e ativamos reciprocidade (tit-for-tat) para obter prioridade de download nos seeders.
              </li>
            </ul>
          </div>

          {/* Limits and Quotas */}
          <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
              <ShieldCheck className="w-4 h-4" />
              <span>Quais são os limites de Download e Upload?</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              O aplicativo é otimizado para respeitar as cotas oficiais do Google e da infraestrutura:
            </p>
            <ul className="text-xs text-slate-400 space-y-2 list-disc list-inside">
              <li>
                <strong className="text-slate-200">Limite Diário do Google Drive:</strong> O Google impõe um limite máximo de upload de <strong>750 GB por dia</strong> por conta Google. Arquivos individuais podem ter até <strong>5 TB</strong> cada.
              </li>
              <li>
                <strong className="text-slate-200">Espaço no seu Google Drive:</strong> Depende do seu plano Google (15 GB no plano gratuito, ou 100 GB / 2 TB no Google One).
              </li>
              <li>
                <strong className="text-slate-200">Armazenamento Transitório:</strong> O servidor baixa temporariamente para montar o arquivo e, assim que envia com sucesso para o seu Drive, <strong>apaga o arquivo local</strong> imediatamente. Recomendamos lotes de até <strong>15 GB</strong> por vez para garantir estabilidade no web app.
              </li>
              <li>
                <strong className="text-slate-200">Velocidade de Envio ao Drive:</strong> O upload agora utiliza chunks de <strong>16 MB</strong> com o protocolo resumível oficial, acelerando o envio em até 400% comparado a uploads normais.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Massive Files / Colab 100GB Tool */}
      <div className="bg-gradient-to-br from-indigo-950/60 via-slate-900 to-slate-900 border border-indigo-500/30 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-xl">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white">
              Quer baixar arquivos gigantescos de 25 GB a 80 GB? (Modo Google Colab 100 GB)
            </h3>
            <p className="text-xs text-slate-400">
              O Google Colab oferece máquinas virtuais gratuitas com 100 GB de disco SSD dedicado.
            </p>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
          Para arquivos de <strong>25 GB a 50 GB</strong> (como o filme em 4K que você tentou baixar), o buffer do web applet pode atingir o teto de cota temporária. Você pode usar a máquina de 100 GB do Colab com este script automatizado em 1 clique:
        </p>

        <div className="p-4 bg-slate-950/90 border border-slate-800 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-cyan-400 font-semibold">
              Script Python + Aria2 Turbo para Google Colab:
            </span>
            <button
              type="button"
              onClick={() => {
                const code = `# 1. Monta o seu Google Drive
from google.colab import drive
drive.mount('/content/drive')

# 2. Instala o Aria2 Turbo C++
!apt-get update -qq && apt-get install -y aria2

# 3. Baixa em alta velocidade direto para a pasta do Drive
magnet = "COLE_SEU_MAGNET_AQUI"
!aria2c --dir="/content/drive/MyDrive/Torrent to Google Drive" \\
  --enable-dht=true --bt-enable-lpd=true --enable-peer-exchange=true \\
  --bt-max-peers=500 --split=32 --disk-cache=128M \\
  --peer-id-prefix="-qB4630-" --peer-agent="qBittorrent/4.6.3" \\
  "$magnet"`;
                navigator.clipboard.writeText(code);
                alert('Script copiado com sucesso! Agora basta abrir o Colab e colar em uma célula de código.');
              }}
              className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors cursor-pointer"
            >
              Copiar Código para o Colab
            </button>
          </div>

          <pre className="text-[11px] font-mono text-slate-300 bg-slate-900/60 p-3 rounded-lg overflow-x-auto border border-slate-800/80 leading-relaxed">
{`# 1. Monta o seu Google Drive oficial
from google.colab import drive
drive.mount('/content/drive')

# 2. Instala o Aria2 Turbo
!apt-get update -qq && apt-get install -y aria2

# 3. Baixa o arquivo de 25GB+ com disco de 100GB
magnet = "SEU_LINK_MAGNET"
!aria2c --dir="/content/drive/MyDrive/Torrent to Google Drive" --split=32 "$magnet"`}
          </pre>
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-slate-400">
            Dica: Para arquivos de até 15 GB, o nosso web app é 100% automático e dispensa qualquer código!
          </span>
          <a
            href="https://colab.research.google.com/#create=true"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-indigo-300 hover:text-white bg-indigo-500/20 hover:bg-indigo-500/30 px-3.5 py-2 rounded-xl transition-colors font-medium"
          >
            <span>Abrir Novo Google Colab</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};
