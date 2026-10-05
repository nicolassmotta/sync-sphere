import { useText } from '../../i18n/useText';
import { BookOpen, ExternalLink, Terminal } from 'lucide-react';
import Alert from '../ui/Alert';
import Badge from '../ui/Badge';
import Card from '../ui/Card';
import CopySnippet from '../ui/CopySnippet';
import {
    localSetupFlow,
    setupSnippets,
    troubleshootingItems,
    usefulLinks,
} from './localSetupContent';

const LocalSetupGuide = ({ compact = false }) => {
    const { t, locale } = useText();
    const visibleSnippets = compact ? setupSnippets.slice(0, 4) : setupSnippets;

    return (
        <div className="space-y-6">
            <Card className="p-6 sm:p-7">
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <p className="mb-2 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.045] px-3 py-2 text-xs font-bold uppercase text-muted">
                            <BookOpen size={14} className="text-spotify" />{t("Tutorial local")}</p>
                        <h2 className="text-2xl font-black text-white">{t("Fluxo completo de configuração e migração")}</h2>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{t("Siga a sequência abaixo para rodar o SyncSphere na sua máquina, validar integrações e migrar playlists com dependências locais claras.")}</p>
                    </div>
                    <Badge tone="info" size="md">{t("código aberto local")}</Badge>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                    {localSetupFlow.map((step, index) => (
                        <div key={step.title} className="flex gap-4 rounded-lg border border-white/10 bg-black/35 p-4">
                            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.055] text-sm font-black text-white">
                                {index + 1}
                            </div>
                            <div className="min-w-0">
                                <h3 className="font-black text-white">{t(step.title)}</h3>
                                <p className="mt-1 text-sm leading-6 text-muted">{t(step.description)}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>

            <div className="grid gap-5 lg:grid-cols-2">
                {visibleSnippets.map((snippet) => (
                    <section key={snippet.title} className="space-y-3">
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.045]">
                                <Terminal size={17} className="text-spotify" />
                            </div>
                            <div>
                                <h3 className="font-black text-white">{t(snippet.title)}</h3>
                                <p className="mt-1 text-sm leading-6 text-muted">{t(snippet.description)}</p>
                            </div>
                        </div>
                        <CopySnippet code={snippet.code} label={t(snippet.label)} language={snippet.language} />
                    </section>
                ))}
            </div>

            <Alert tone="warning" title={t("Cuidado com segredos")}>{t("`YTMUSIC_COOKIE`, `ENCRYPTION_KEY` e o conteúdo de `backend/data/` (credenciais cifradas) são dados locais sensíveis. Use valores demonstrativos em tutoriais, issues e capturas de tela.")}</Alert>

            {!compact && (
                <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
                    <Card className="p-6">
                        <h3 className="text-xl font-black text-white">{t("Links úteis")}</h3>
                        <div className="mt-4 space-y-3">
                            {usefulLinks.map((link) => (
                                <a
                                    key={link.href}
                                    href={locale === 'en' ? link.href.replace('/docs/README.md', '/docs/en/README.md') : link.href}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white transition-colors hover:border-white/20 hover:bg-white/[0.06]"
                                >
                                    <span>{t(link.label)}</span>
                                    <ExternalLink size={15} className="shrink-0 text-muted" />
                                </a>
                            ))}
                        </div>
                    </Card>

                    <Card className="p-6">
                        <h3 className="text-xl font-black text-white">{t("Solução de problemas rápida")}</h3>
                        <div className="mt-4 grid gap-3">
                            {troubleshootingItems.map((item) => (
                                <div key={item.title} className="rounded-lg border border-white/10 bg-black/35 p-4">
                                    <p className="font-bold text-white">{t(item.title)}</p>
                                    <p className="mt-1 text-sm leading-6 text-muted">{t(item.text)}</p>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default LocalSetupGuide;
