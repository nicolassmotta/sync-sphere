import { useState } from 'react';
import { User, Mail, Lock, UserPlus, ArrowLeft } from 'lucide-react';
import Button from '../ui/Button';
import TextField from '../ui/TextField';

const RegisterForm = ({ onRegister, loading, changeView }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        onRegister({ name, email, password });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <button 
                type="button" 
                onClick={() => changeView('login')}
                className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-muted transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-spotify"
            >
                <ArrowLeft size={14} /> Voltar
            </button>
            
            <TextField
                autoComplete="name"
                label="Como devemos chamar você?"
                leadingIcon={<User size={18} />}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: João da Silva"
                required
                value={name}
            />

            <TextField
                autoComplete="email"
                label="Email profissional ou pessoal"
                leadingIcon={<Mail size={18} />}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com.br"
                required
                type="email"
                value={email}
            />
            
            <TextField
                autoComplete="new-password"
                hint="Use ao menos 6 caracteres."
                label="Escolha uma senha segura"
                leadingIcon={<Lock size={18} />}
                minLength={6}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                type="password"
                value={password}
            />

            <Button
                type="submit" 
                fullWidth
                loading={loading}
                loadingLabel="Criando conta..."
                rightIcon={<UserPlus size={18} />}
                variant="primary"
                className="mt-6"
            >
                Criar minha conta
            </Button>
        </form>
    );
};

export default RegisterForm;
