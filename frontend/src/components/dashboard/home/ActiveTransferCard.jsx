import { motion } from 'framer-motion';
import { Disc3, Gauge } from 'lucide-react';

const ActiveTransferCard = ({ isTransferring, progress, progressMessage }) => (
    <div className="elevated-card p-6">
        <div className="mb-5 flex items-center justify-between">
            <div>
                <p className="text-xs font-bold uppercase text-white/40">Migração ativa</p>
                <h3 className="mt-1 text-xl font-black text-white">{progress}% concluído</h3>
            </div>
            <Gauge className="text-spotify" size={24} />
        </div>

        <div className="mb-4 h-3 overflow-hidden rounded-full bg-white/10">
            <motion.div
                className="h-full rounded-full bg-gradient-to-r from-spotify to-youtube"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ type: 'spring', bounce: 0, duration: 0.9 }}
            />
        </div>
        <p className="text-sm font-semibold leading-6 text-white/70">
            {isTransferring ? (progressMessage || 'Sincronizando faixas...') : 'Nenhuma transferência em execução.'}
        </p>

        <div className="mt-5 flex items-center gap-4 rounded-lg border border-white/10 bg-black/30 p-4">
            <div className="grid h-11 w-11 place-items-center rounded-lg border border-white/10 bg-white/[0.04]">
                <Disc3 className={isTransferring ? 'animate-spinSlow text-youtube' : 'text-muted'} size={22} />
            </div>
            <div>
                <p className="text-sm font-black text-white">{isTransferring ? 'Copiando suas músicas' : 'Pronto para começar'}</p>
                <p className="mt-1 text-xs font-semibold text-muted">Progresso atualizado automaticamente</p>
            </div>
        </div>
    </div>
);

export default ActiveTransferCard;
