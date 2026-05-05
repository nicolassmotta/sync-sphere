import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';

const NotFound = () => {
    const navigate = useNavigate();

    return (
        <div className="app-shell relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 text-white">
            <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center relative z-10 max-w-lg"
            >
                <h1 className="mb-4 bg-gradient-to-b from-white to-gray-600 bg-clip-text text-[130px] font-black leading-none text-transparent md:text-[150px]">
                    404
                </h1>
                <h2 className="mb-4 text-3xl font-black">Esta faixa não foi encontrada</h2>
                <p className="mb-10 text-lg leading-8 text-muted">
                    Parece que você navegou para fora da órbita do sistema. A página que você está procurando foi removida ou não existe.
                </p>

                <button 
                    onClick={() => navigate('/')}
                    className="inline-flex items-center gap-2 rounded-lg bg-white px-8 py-4 font-extrabold text-black transition-transform hover:scale-105 hover:bg-gray-200"
                >
                    <ArrowLeft size={20} /> Voltar para a Base
                </button>
            </motion.div>
        </div>
    );
};

export default NotFound;
