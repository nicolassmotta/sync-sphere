import { useText } from '../i18n/useText';
import LanguageSelector from '../components/ui/LanguageSelector';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    ArrowRight,
    BookOpen,
    CheckCircle2,
    Code2,
    ListChecks,
    RefreshCw,
    Server,
    Terminal,
} from 'lucide-react';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import CopySnippet from '../components/ui/CopySnippet';
import { SpotifyIcon, YoutubeIcon } from '../components/ui/BrandIcons';
import {
    localSetupFlow,
    setupSnippets,
    troubleshootingItems,
} from '../components/setup/localSetupContent';

const quickSnippets = setupSnippets.filter((snippet) => (
    ['Aplicação local', 'Spotify OAuth (PKCE)', 'YouTube Music cookie', 'Front-end Vite'].includes(snippet.title)
));

const Landing = () => {
    const { t } = useText();
    const navigate = useNavigate();
    const goToApp = () => navigate('/dashboard');
    const goToDemo = () => navigate('/dashboard?demo=1');
    const scrollToTutorial = () => document.getElementById('tutorial-local')?.scrollIntoView({ behavior: 'smooth' });

    return (
        <div className="app-shell min-h-screen overflow-x-hidden text-ink">
            <nav className="sticky top-0 z-50 border-b border-white/10 bg-black/70 backdrop-blur-xl">
                <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-5 md:px-8">
                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        className="flex min-w-0 items-center gap-3 text-left"
                    >
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-spotify/30 bg-spotify/15 text-spotify">
                            <RefreshCw size={21} />
                        </span>
                        <span className="min-w-0">
                            <span className="block text-lg font-extrabold text-white">{t("SyncSphere")}</span>
                            <span className="block truncate text-xs font-semibold text-muted">{t("playlists entre plataformas, localmente")}</span>
                        </span>
                    </button>

                    <div className="flex items-center gap-2"><LanguageSelector />
                        <Button onClick={scrollToTutorial} variant="ghost" size="sm" leftIcon={<BookOpen size={15} />}>{t("Tutorial")}</Button>
                        <Button onClick={goToApp} variant="primary" size="sm" rightIcon={<ArrowRight size={15} />}>{t("Abrir painel")}</Button>
                    </div>
                </div>
            </nav>

            <main className="relative z-10">
                <section className="px-5 py-12 md:px-8 md:py-16">
                    <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
                        <motion.div
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="max-w-3xl"
                        >
                            <Badge tone="info" size="md" icon={<Code2 size={14} />}>{t("código aberto local")}</Badge>
                            <h1 className="mt-5 text-4xl font-black leading-tight text-white md:text-6xl">{t("Suas playlists entre plataformas, na sua máquina.")}</h1>
                            <p className="mt-5 max-w-2xl text-base leading-8 text-muted md:text-lg">{t("Escolha entre Spotify, YouTube Music, Deezer, TIDAL, Apple Music, SoundCloud e Arquivo. Acompanhe cada faixa, retome transferências e revise o resultado. Os dados ficam cifrados na sua instalação local.")}</p>

                            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                                <Button onClick={goToApp} variant="primary" size="lg" rightIcon={<ArrowRight size={18} />}>{t("Abrir painel local")}</Button>
                                <Button onClick={goToDemo} variant="secondary" size="lg">{t("Experimentar sem contas")}</Button>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 18 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="rounded-lg border border-white/10 bg-black/45 p-5 shadow-panel"
                        >
                            <div className="mb-5 flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-xs font-bold uppercase text-white/40">{t("Fluxo guiado")}</p>
                                    <h2 className="mt-1 text-2xl font-black text-white">{t("Da configuração ao histórico")}</h2>
                                </div>
                                <div className="flex items-center gap-2">
                                    <SpotifyIcon className="h-7 w-7 fill-spotify" />
                                    <RefreshCw size={16} className="text-muted" />
                                    <YoutubeIcon className="h-7 w-7 fill-youtube" />
                                </div>
                            </div>

                            <div className="grid gap-3">
                                {localSetupFlow.map((step, index) => (
                                    <div key={step.title} className="flex gap-3 rounded-lg border border-white/10 bg-white/[0.035] p-3">
                                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-black/40 text-xs font-black text-white">
                                            {index + 1}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-white">{t(step.title)}</p>
                                            <p className="mt-1 text-sm leading-6 text-muted">{t(step.description)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                </section>

                <section id="tutorial-local" className="border-y border-white/10 bg-black/25 px-5 py-12 md:px-8 md:py-16">
                    <div className="mx-auto max-w-7xl">
                        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                            <div>
                                <p className="mb-2 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.045] px-3 py-2 text-xs font-bold uppercase text-white/45">
                                    <Terminal size={14} className="text-spotify" />{t("Tutorial no front-end")}</p>
                                <h2 className="text-3xl font-black text-white md:text-4xl">{t("Comandos copiáveis para rodar localmente")}</h2>
                                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{t("Os exemplos usam valores demonstrativos. Preencha segredos e cookies apenas no seu `.env` local.")}</p>
                            </div>
                            <Badge tone="warning" size="md">{t("sem tokens reais")}</Badge>
                        </div>

                        <div className="grid gap-5 lg:grid-cols-2">
                            {quickSnippets.map((snippet) => (
                                <section key={snippet.title} className="space-y-3">
                                    <div className="flex items-start gap-3">
                                        <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.045]">
                                            <Server size={17} className="text-spotify" />
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
                    </div>
                </section>

                <section className="px-5 py-12 md:px-8 md:py-16">
                    <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.8fr_1.2fr]">
                        <div>
                            <p className="mb-2 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.045] px-3 py-2 text-xs font-bold uppercase text-white/45">
                                <ListChecks size={14} className="text-spotify" />{t("Validação")}</p>
                            <h2 className="text-3xl font-black text-white">{t("O painel continua o tutorial.")}</h2>
                            <p className="mt-3 text-sm leading-7 text-muted">{t("A aba Início orienta a configuração, a escolha dos provedores e a seleção de playlists. Você pode experimentar a conversão entre arquivos sem conectar contas.")}</p>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                            {[
                                t("Back-end online/offline via /api/health"),
                                t("Dados e fila locais (sem banco externo)"),
                                t("Sete provedores e configuração por plataforma"),
                                t("Conversão CSV, JSON, M3U e TXT sem contas"),
                                t("Progresso em tempo real via Socket.io"),
                                t("Histórico, pendências e revisão manual de faixas"),
                            ].map((item) => (
                                <div key={item} className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/35 p-4">
                                    <CheckCircle2 size={17} className="shrink-0 text-spotify" />
                                    <span className="text-sm font-semibold text-white/80">{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="px-5 pb-16 md:px-8">
                    <div className="mx-auto max-w-7xl rounded-lg border border-white/10 bg-white/[0.045] p-6">
                        <h2 className="text-2xl font-black text-white">{t("Solução de problemas rápida")}</h2>
                        <div className="mt-5 grid gap-3 md:grid-cols-2">
                            {troubleshootingItems.map((item) => (
                                <div key={item.title} className="rounded-lg border border-white/10 bg-black/35 p-4">
                                    <p className="font-bold text-white">{item.title}</p>
                                    <p className="mt-1 text-sm leading-6 text-muted">{item.text}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
};

export default Landing;
