import { useText } from '../i18n/useText';
import LanguageSelector from '../components/ui/LanguageSelector';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    ArrowRight,
    CheckCircle2,
    Code2,
    LifeBuoy,
    ListChecks,
    PlayCircle,
    RefreshCw,
    Server,
    Terminal,
} from 'lucide-react';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import CopySnippet from '../components/ui/CopySnippet';
import ProviderIcon from '../components/ui/ProviderIcon';
import {
    setupSnippets,
    troubleshootingItems,
} from '../components/setup/localSetupContent';

const developerSnippets = setupSnippets.filter((snippet) => (
    ['Aplicação local', 'Front-end Vite'].includes(snippet.title)
));

// Quem vê esta página já está com o aplicativo rodando: o conteúdo explica o uso, não a instalação.
const howItWorks = [
    { title: 'Escolha origem e destino', description: 'Spotify, YouTube Music, Deezer, TIDAL, Apple Music, SoundCloud ou um arquivo CSV, JSON, M3U ou TXT.' },
    { title: 'Conecte só o necessário', description: 'Cada plataforma mostra o passo a passo. As credenciais ficam cifradas neste computador.' },
    { title: 'Marque as playlists', description: 'Busque pelo nome, confira as faixas antes e migre várias de uma vez.' },
    { title: 'Confira o resultado', description: 'Acompanhe cada faixa, escolha alternativas para as não encontradas e baixe o relatório.' },
];

const features = [
    'Sem conta do SyncSphere e sem banco de dados',
    'Credenciais e histórico cifrados neste computador',
    'Retoma de onde parou se a plataforma limitar as buscas ou a conexão expirar',
    'Revisão manual das músicas não encontradas',
    'Importa e exporta CSV, JSON, M3U e TXT',
    'Interface em português e inglês',
];

const PROVIDER_IDS = ['spotify', 'youtubeMusic', 'deezer', 'tidal', 'appleMusic', 'soundcloud', 'file'];

const Landing = () => {
    const { t } = useText();
    const navigate = useNavigate();
    const goToApp = () => navigate('/dashboard');
    const goToDemo = () => navigate('/dashboard?demo=1');

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
                            <span className="hidden truncate text-xs font-semibold text-muted sm:block">{t("playlists entre plataformas, localmente")}</span>
                        </span>
                    </button>

                    <div className="flex items-center gap-2"><LanguageSelector />
                        <Button aria-label={t("Abrir painel")} onClick={goToApp} variant="primary" size="sm" rightIcon={<ArrowRight size={15} />}><span className="hidden sm:inline">{t("Abrir painel")}</span></Button>
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
                                <Button onClick={goToDemo} variant="secondary" size="lg" leftIcon={<PlayCircle size={18} />}>{t("Experimentar sem contas")}</Button>
                            </div>
                            <p className="mt-4 inline-flex items-center gap-2 text-sm text-muted">
                                <Server size={15} aria-hidden="true" className="text-spotify" />{t("O aplicativo já está rodando neste computador. Mantenha a janela do terminal aberta enquanto usa.")}</p>
                            <ul className="mt-6 flex flex-wrap gap-2" aria-label={t("Plataformas disponíveis")}>
                                {PROVIDER_IDS.map((id) => <li key={id} className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-black/35" title={id === 'file' ? t("Arquivo") : undefined}>
                                    <ProviderIcon providerId={id} size="sm" />
                                </li>)}
                            </ul>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 18 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="rounded-lg border border-white/10 bg-black/45 p-5 shadow-panel"
                        >
                            <div className="mb-5">
                                <p className="text-xs font-bold uppercase text-muted">{t("Fluxo guiado")}</p>
                                <h2 className="mt-1 text-2xl font-black text-white">{t("Como funciona")}</h2>
                            </div>

                            <ol className="grid gap-3">
                                {howItWorks.map((step, index) => (
                                    <li key={step.title} className="flex gap-3 rounded-lg border border-white/10 bg-white/[0.035] p-4">
                                        <div aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-black/40 text-xs font-black text-white">
                                            {index + 1}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-white">{t(step.title)}</p>
                                            <p className="mt-1 text-sm leading-6 text-muted">{t(step.description)}</p>
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        </motion.div>
                    </div>
                </section>

                <section className="border-y border-white/10 bg-black/25 px-5 py-12 md:px-8 md:py-16">
                    <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.8fr_1.2fr]">
                        <div>
                            <p className="mb-2 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.045] px-3 py-2 text-xs font-bold uppercase text-muted">
                                <ListChecks size={14} className="text-spotify" />{t("Feito para uso local")}</p>
                            <h2 className="text-3xl font-black text-white">{t("Suas contas e dados ficam com você.")}</h2>
                            <p className="mt-3 text-sm leading-7 text-muted">{t("O SyncSphere roda no seu computador e conversa direto com as plataformas. Nada passa por um servidor do projeto.")}</p>
                        </div>

                        <ul className="grid gap-3 md:grid-cols-2">
                            {features.map((item) => (
                                <li key={item} className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/35 p-4">
                                    <CheckCircle2 size={17} aria-hidden="true" className="shrink-0 text-spotify" />
                                    <span className="text-sm font-semibold text-white/80">{t(item)}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>

                <section className="px-5 py-12 md:px-8 md:py-16">
                    <div className="mx-auto max-w-7xl rounded-lg border border-white/10 bg-white/[0.045] p-6">
                        <h2 className="flex items-center gap-3 text-2xl font-black text-white"><LifeBuoy size={22} aria-hidden="true" className="text-spotify" />{t("Problemas comuns")}</h2>
                        <div className="mt-5 grid gap-3 md:grid-cols-2">
                            {troubleshootingItems.map((item) => (
                                <div key={item.title} className="rounded-lg border border-white/10 bg-black/35 p-4">
                                    <p className="font-bold text-white">{t(item.title)}</p>
                                    <p className="mt-1 text-sm leading-6 text-muted">{t(item.text)}</p>
                                </div>
                            ))}
                        </div>
                        <p className="mt-5 text-sm text-muted">{t("Mais orientação no painel, em Ajuda e segurança.")}</p>
                    </div>
                </section>

                <section className="px-5 pb-16 md:px-8">
                    <details className="mx-auto max-w-7xl rounded-lg border border-white/10 bg-black/25 p-6">
                        <summary className="cursor-pointer text-lg font-bold text-white">
                            <Terminal size={17} aria-hidden="true" className="mr-2 inline text-spotify" />{t("Para quem desenvolve")}</summary>
                        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">{t("Comandos para instalar pelo código e para editar a interface com atualização automática. Os exemplos usam valores demonstrativos.")}</p>
                        <div className="mt-5 grid gap-5 lg:grid-cols-2">
                            {developerSnippets.map((snippet) => (
                                <section key={snippet.title} className="space-y-3">
                                    <div>
                                        <h3 className="font-black text-white">{t(snippet.title)}</h3>
                                        <p className="mt-1 text-sm leading-6 text-muted">{t(snippet.description)}</p>
                                    </div>
                                    <CopySnippet code={snippet.code} label={t(snippet.label)} language={snippet.language} />
                                </section>
                            ))}
                        </div>
                    </details>
                </section>
            </main>
        </div>
    );
};

export default Landing;
