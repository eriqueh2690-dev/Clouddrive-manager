import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Smartphone, Download, QrCode, X, Check, ExternalLink, HelpCircle } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // If already installed in standalone mode, show subtle installed badge or nothing
  if (isInstalled) {
    return (
      <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 font-medium">
        <Check className="w-3.5 h-3.5" />
        <span>App Instalado</span>
      </div>
    );
  }

  const handleAction = async () => {
    if (isInstallable) {
      const ok = await install();
      if (!ok) {
        setShowModal(true);
      }
    } else {
      setShowModal(true);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleAction}
        className="inline-flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-950/30 transition-all cursor-pointer active:scale-95 border border-emerald-400/30"
      >
        <Smartphone className="w-4 h-4 text-emerald-200" />
        <span>Instalar no Android</span>
        <span className="hidden md:inline-block px-1.5 py-0.2 bg-white/20 text-[10px] font-bold rounded-md">
          APK
        </span>
      </button>

      {/* Android Installation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative space-y-5">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Instalar App no Android (APK)</h3>
                <p className="text-xs text-slate-400">
                  Execute como aplicativo nativo na gaveta de apps do seu celular
                </p>
              </div>
            </div>

            <div className="space-y-3.5 text-xs text-slate-300">
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0">
                  1
                </span>
                <div>
                  <strong className="text-white block mb-0.5">Abra no Google Chrome do seu celular</strong>
                  <span>Acesse o link do app diretamente pelo navegador Chrome no seu Android.</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0">
                  2
                </span>
                <div>
                  <strong className="text-white block mb-0.5">Toque nos 3 Pontinhos do Chrome</strong>
                  <span>
                    No canto superior direito, toque no menu <strong>⋮</strong> e selecione{' '}
                    <span className="text-cyan-300 font-semibold">"Instalar aplicativo"</span> (ou{' '}
                    <span className="text-cyan-300 font-semibold">"Adicionar à tela inicial"</span>).
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 font-bold flex items-center justify-center shrink-0">
                  3
                </span>
                <div>
                  <strong className="text-white block mb-0.5">O Android compila o WebAPK nativo</strong>
                  <span>
                    O Android cria o pacote APK nativo no seu aparelho. O app ganha ícone próprio na tela de início, abre em tela cheia sem barra de endereço e com desempenho acelerado!
                  </span>
                </div>
              </div>
            </div>

            {/* Direct Link Copier */}
            <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-2">
              <span className="text-[11px] text-slate-400 font-medium block">
                Link do App para abrir no celular:
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={window.location.href}
                  className="w-full bg-slate-900 border border-slate-800 text-slate-300 text-xs px-3 py-2 rounded-lg font-mono truncate focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg shrink-0 transition-colors cursor-pointer"
                >
                  {copied ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>

            {/* Native Android Project (.APK) box */}
            <div className="p-4 bg-gradient-to-r from-blue-950/40 via-indigo-950/40 to-slate-900 border border-blue-500/30 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-cyan-400" />
                  Projeto Android Nativo Gradle (Pasta /android)
                </span>
                <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded font-mono">
                  APK Nativo
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                O código nativo do Android está pronto na pasta <code className="text-cyan-300 bg-slate-950 px-1 py-0.5 rounded font-mono text-[10px]">/android</code>. Para gerar o <strong>app-debug.apk</strong> em segundos, execute no terminal:
              </p>
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between gap-2 font-mono text-[11px] text-emerald-400">
                <span className="truncate">cd android &amp;&amp; gradlew assembleDebug</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText("cd android && gradlew assembleDebug");
                    alert("Comando copiado! Cole no seu terminal para compilar o APK.");
                  }}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] rounded shrink-0 cursor-pointer"
                >
                  Copiar
                </button>
              </div>
              <p className="text-[10px] text-slate-400">
                O arquivo APK será gerado em: <code className="text-slate-300 font-mono">android/app/build/outputs/apk/debug/app-debug.apk</code>
              </p>
            </div>

            {/* Direct APK Builder / Downloader via Google & Microsoft PWABuilder */}
            <div className="p-3.5 bg-indigo-950/40 border border-indigo-500/30 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-indigo-400" />
                  Gerar arquivo instalador .APK avulso
                </span>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded font-mono">
                  PWABuilder
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Se você precisa do arquivo <strong>.apk</strong> bruto assinado para enviar via WhatsApp/Telegram ou instalar por sideloading, você pode gerá-lo em 1 clique pela ferramenta oficial da Google/Microsoft:
              </p>
              <div className="flex gap-2">
                <a
                  href={`https://www.pwabuilder.com/reportcard?site=${encodeURIComponent(window.location.origin)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer text-center"
                >
                  <span>Baixar APK via PWABuilder</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <a
                  href="/manifest.json"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors cursor-pointer text-center"
                  title="Abrir manifest.json"
                >
                  <span>Ver Manifesto</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer text-center"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
