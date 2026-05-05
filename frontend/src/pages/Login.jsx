import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { AudioLines, CheckCircle2, RefreshCw, ShieldCheck } from 'lucide-react';

// Formulários
import LoginForm from '../components/auth/LoginForm';
import RegisterForm from '../components/auth/RegisterForm';

const Login = () => {
    const [authView, setAuthView] = useState('login'); // valores internos: login, register
    const [loading, setLoading] = useState(false);
    const [shakeAuth, setShakeAuth] = useState(false); // Gatilho de animação de erro

    const navigate = useNavigate();
    const loginAction = useAuthStore((state) => state.login);

    const triggerErrorShake = () => {
        setShakeAuth(true);
        setTimeout(() => setShakeAuth(false), 500);
    }

    const handleLogin = async ({ email, password }) => {
        if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            toast.error('O formato do email não é válido.');
            triggerErrorShake();
            return;
        }
        if (password.length < 6) {
            toast.error('Sua senha tem pelo menos 6 caracteres.');
            triggerErrorShake();
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('/auth/login', { email, password });
            loginAction(response.data.data.user); 
            toast.success('Login local realizado.');
            navigate('/dashboard'); 
        } catch (err) {
            const serverMessage = !err.response
                ? 'Não foi possível conectar ao SyncSphere agora. Tente novamente em instantes.'
                : (err.response?.data?.message || 'Não foi possível entrar. Confira seus dados e tente novamente.');
            toast.error(serverMessage);
            triggerErrorShake();
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async ({ name, email, password }) => {
        if (name.trim().length <= 2) {
            toast.error('Use um nome com mais de 2 letras.');
            triggerErrorShake();
            return;
        }
        if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            toast.error('O formato do email não é válido.');
            triggerErrorShake();
            return;
        }
        if (password.length < 6) {
            toast.error('Sua senha deve ter pelo menos 6 caracteres.');
            triggerErrorShake();
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('/auth/register', { name, email, password });
            loginAction(response.data.data.user); 
            toast.success(`Usuário local criado: ${name}.`);
            navigate('/dashboard'); 
        } catch (err) {
            const serverMessage = !err.response
                ? 'Não foi possível conectar ao SyncSphere agora. Tente novamente em instantes.'
                : (err.response?.data?.message || 'Falha ao criar conta. Tente novamente.');
            toast.error(serverMessage);
            triggerErrorShake();
        } finally {
            setLoading(false);
        }
    };

    // Variantes do Framer Motion
    const fadeContainer = {
        hidden: { opacity: 0, scale: 0.95 },
        visible: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: "easeOut" } },
        exit: { opacity: 0, scale: 1.05, transition: { duration: 0.3 } }
    };

    const slideVariants = {
        enter: (direction) => {
            return {
                x: direction > 0 ? 100 : -100,
                opacity: 0
            };
        },
        center: {
            zIndex: 1,
            x: 0,
            opacity: 1
        },
        exit: (direction) => {
            return {
                zIndex: 0,
                x: direction < 0 ? 100 : -100,
                opacity: 0
            };
        }
    };

    // Determina a direção da transição baseada na visão atual
    const direction = authView === 'register' ? 1 : 0;

    return (
        <motion.div
            className="app-shell relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={fadeContainer}
        >
            <div className="relative z-10 grid w-full max-w-6xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
                <motion.section
                    initial={{ opacity: 0, x: -24 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.12 }}
                    className="elevated-card hidden min-h-[620px] overflow-hidden p-8 lg:block"
                >
                    <div className="flex items-center gap-3">
                        <div className="grid h-11 w-11 place-items-center rounded-lg border border-spotify/30 bg-spotify/15 text-spotify">
                            <RefreshCw size={22} />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-white">SyncSphere</p>
                            <p className="text-xs text-muted">configuração local e migração</p>
                        </div>
                    </div>

                    <div className="mt-14">
                        <p className="mb-4 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.055] px-3 py-2 text-xs font-bold text-white/75">
                            <ShieldCheck size={15} className="text-spotify" />
                            Sessão local
                        </p>
                        <h1 className="max-w-xl text-5xl font-black leading-tight text-white">
                            Entre para acessar o painel e validar o ambiente.
                        </h1>
                        <p className="mt-5 max-w-lg text-base leading-7 text-muted">
                            A sessão continua em cookie HttpOnly. O painel mostra configuração, integrações, progresso e histórico.
                        </p>
                    </div>

                    <div className="mt-14 grid gap-4">
                        {[
                            ['Back-end', 'Saúde e prontidão', 'text-spotify'],
                            ['Integrações', 'Spotify OAuth e YTMUSIC_COOKIE', 'text-red-300'],
                            ['Fila', 'BullMQ + Socket.io', 'text-cyan-300'],
                        ].map(([label, status, color], index) => (
                            <motion.div
                                key={label}
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.25 + index * 0.1 }}
                                className="data-card flex items-center justify-between p-4"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-white/10">
                                        <AudioLines className={color} size={20} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-white">{label}</p>
                                        <p className="text-xs text-muted">{status}</p>
                                    </div>
                                </div>
                                <CheckCircle2 size={18} className={color} />
                            </motion.div>
                        ))}
                    </div>
                </motion.section>

                <motion.section
                    className="elevated-card relative w-full overflow-hidden p-7 sm:p-8"
                    animate={shakeAuth ? { x: [-10, 10, -10, 10, -5, 5, 0] } : {}}
                    transition={{ duration: 0.4 }}
                >
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-spotify to-transparent" />

                    <div className="relative z-10 mb-8 mt-1 text-center">
                        <motion.div
                            initial={{ rotate: -35, opacity: 0, scale: 0.9 }}
                            animate={{ rotate: 0, opacity: 1, scale: 1 }}
                            transition={{ delay: 0.2 }}
                            className="mb-5 flex justify-center text-spotify"
                        >
                            <div className="glass-effect grid h-16 w-16 place-items-center rounded-lg border-spotify/25 bg-black/45">
                                <RefreshCw size={34} strokeWidth={2.2} className="text-spotify" />
                            </div>
                        </motion.div>
                        <h2 className="text-3xl font-extrabold text-white">SyncSphere</h2>

                        {authView === 'login' && <p className="mt-2 text-sm text-muted">Acesse o painel local de migração.</p>}
                        {authView === 'register' && <p className="mt-2 text-sm text-spotify">Crie um usuário local para isolar suas transferências.</p>}
                    </div>

                    <div className="relative z-10 w-full">
                        <AnimatePresence mode="wait" custom={direction}>
                            <motion.div
                                key={authView}
                                custom={direction}
                                variants={slideVariants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                transition={{
                                    x: { type: "spring", stiffness: 300, damping: 30 },
                                    opacity: { duration: 0.2 }
                                }}
                                className="w-full"
                            >
                                {authView === 'login' && (
                                    <LoginForm
                                        onLogin={handleLogin}
                                        loading={loading}
                                        changeView={setAuthView}
                                    />
                                )}

                                {authView === 'register' && (
                                    <RegisterForm
                                        onRegister={handleRegister}
                                        loading={loading}
                                        changeView={setAuthView}
                                    />
                                )}

                            </motion.div>
                        </AnimatePresence>
                    </div>
                </motion.section>
            </div>
        </motion.div>
    );
};

export default Login;
