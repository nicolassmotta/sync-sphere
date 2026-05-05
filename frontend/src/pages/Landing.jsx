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
    ['Back-end local', 'Spotify OAuth', 'YouTube Music cookie', 'Front-end local'].includes(snippet.title)
));

const Landing = () => {
    const navigate = useNavigate();
    const goToLogin = () => navigate('/login');
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
                            <span className="block text-lg font-extrabold text-white">SyncSphere</span>
                            <span className="block truncate text-xs font-semibold text-muted">local Spotify -&gt; YouTube Music</span>
                        </span>
                    </button>

                    <div className="flex items-center gap-2">
                        <Button onClick={scrollToTutorial} variant="ghost" size="sm" leftIcon={<BookOpen size={15} />}>
                            Tutorial
                        </Button>
                        <Button onClick={goToLogin} variant="primary" size="sm" rightIcon={<ArrowRight size={15} />}>
                            Abrir painel
                        </Button>
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
                            <Badge tone="info" size="md" icon={<Code2 size={14} />}>
                                código aberto local
                            </Badge>
                            <h1 className="mt-5 text-4xl font-black leading-tight text-white md:text-6xl">
                                SyncSphere: migrador local Spotify -&gt; YouTube Music
                            </h1>
                            <p className="mt-5 max-w-2xl text-base leading-8 text-muted md:text-lg">
                                Rode o back-end, valide MongoDB/Redis, conecte Spotify por OAuth, configure YTMUSIC_COOKIE e acompanhe a migração pelo painel.
                            </p>

                            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                                <Button onClick={goToLogin} variant="primary" size="lg" rightIcon={<ArrowRight size={18} />}>
                                    Abrir painel local
                                </Button>
                                <Button onClick={scrollToTutorial} variant="secondary" size="lg" leftIcon={<Terminal size={18} />}>
                                    Ver comandos
                                </Button>
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
                                    <p className="text-xs font-bold uppercase text-white/40">Fluxo guiado</p>
                                    <h2 className="mt-1 text-2xl font-black text-white">Da configuração ao histórico</h2>
                                </div>
                                <div className="flex items-center gap-2">
                                    <SpotifyIcon className="h-7 w-7 fill-spotify" />
                                    <ArrowRight size={16} className="text-muted" />
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
                                            <p className="font-bold text-white">{step.title}</p>
                                            <p className="mt-1 text-sm leading-6 text-muted">{step.description}</p>
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
                                    <Terminal size={14} className="text-spotify" />
                                    Tutorial no front-end
                                </p>
                                <h2 className="text-3xl font-black text-white md:text-4xl">Comandos copiáveis para rodar localmente</h2>
                                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                                    Os exemplos usam valores demonstrativos. Preencha segredos e cookies apenas no seu `.env` local.
                                </p>
                            </div>
                            <Badge tone="warning" size="md">sem tokens reais</Badge>
                        </div>

                        <div className="grid gap-5 lg:grid-cols-2">
                            {quickSnippets.map((snippet) => (
                                <section key={snippet.title} className="space-y-3">
                                    <div className="flex items-start gap-3">
                                        <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.045]">
                                            <Server size={17} className="text-spotify" />
                                        </div>
                                        <div>
                                            <h3 className="font-black text-white">{snippet.title}</h3>
                                            <p className="mt-1 text-sm leading-6 text-muted">{snippet.description}</p>
                                        </div>
                                    </div>
                                    <CopySnippet code={snippet.code} label={snippet.label} language={snippet.language} />
                                </section>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="px-5 py-12 md:px-8 md:py-16">
                    <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.8fr_1.2fr]">
                        <div>
                            <p className="mb-2 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.045] px-3 py-2 text-xs font-bold uppercase text-white/45">
                                <ListChecks size={14} className="text-spotify" />
                                Validação
                            </p>
                            <h2 className="text-3xl font-black text-white">O painel continua o tutorial.</h2>
                            <p className="mt-3 text-sm leading-7 text-muted">
                                Depois do login local, a aba Início mostra checklist de back-end, MongoDB, Redis, Spotify, YTMUSIC_COOKIE, seleção, fila e histórico.
                            </p>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                            {[
                                'Back-end online/offline',
                                'MongoDB e Redis via /api/ready',
                                'Spotify OAuth conectado/desconectado',
                                'YTMUSIC_COOKIE configurado/não configurado',
                                'Progresso em tempo real via Socket.io',
                                'Histórico de migrações e falhas',
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
                        <h2 className="text-2xl font-black text-white">Solução de problemas rápida</h2>
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
