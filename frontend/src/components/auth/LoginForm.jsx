import { useState } from 'react';
import { Mail, Lock, LogIn } from 'lucide-react';
import Button from '../ui/Button';
import TextField from '../ui/TextField';

const LoginForm = ({ onLogin, loading, changeView }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        onLogin({ email, password });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <TextField
                autoComplete="email"
                containerClassName="mt-2"
                label="Endereço de E-mail"
                leadingIcon={<Mail size={18} />}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com.br"
                required
                type="email"
                value={email}
            />
            
            <TextField
                autoComplete="current-password"
                label="Senha de Acesso"
                leadingIcon={<Lock size={18} />}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                type="password"
                value={password}
            />

            <Button
                type="submit" 
                fullWidth
                loading={loading}
                loadingLabel="Entrando..."
                rightIcon={<LogIn size={18} />}
                variant="inverse"
                className="mt-4"
            >
                Entrar no SyncSphere
            </Button>
            
            <div className="mt-6 border-t border-white/10 pt-6 text-center">
                <p className="text-sm text-muted">
                    Ainda não tem conta?{' '}
                    <button 
                        type="button" 
                        onClick={() => changeView('register')} 
                        className="font-bold text-white transition-colors hover:text-spotify focus:outline-none focus-visible:ring-2 focus-visible:ring-spotify"
                    >
                        Criar usuário local
                    </button>
                </p>
            </div>
        </form>
    );
};

export default LoginForm;
