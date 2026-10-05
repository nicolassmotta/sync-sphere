import { AlertTriangle, CheckCircle2, Clock3, ShieldCheck } from 'lucide-react';
import { useText } from '../../i18n/useText';
import { getTransferProviders } from '../../constants/providers';
import { getDisplayPendingCount, getInsertedCount, isActiveTransfer } from './historyPresentation';

const TransferResultSummary = ({ item }) => {
    const { t } = useText();
    const pending = getDisplayPendingCount(item);
    const attention = pending + (item.notFoundCount || 0);
    const active = isActiveTransfer(item);
    const canReview = getTransferProviders(item).targetProvider !== 'file';
    const Icon = active ? Clock3 : attention || item.status === 'failed' || item.sourceTruncated ? AlertTriangle : CheckCircle2;
    const verified = item.destinationVerification?.state === 'verified';
    const title = item.status === 'needs_auth' ? 'Aguardando reconexão' : item.status === 'paused' ? 'Pausada'
        : active ? 'Sua migração continua em andamento' : item.sourceTruncated ? 'A origem não foi lida por completo'
            : attention ? 'Confira as músicas que precisam de você' : item.status === 'failed' ? 'A migração precisa de atenção' : 'Sua migração foi concluída';
    const description = item.status === 'needs_auth' ? 'Reconecte a plataforma em Integrações para continuar a migração.'
        : active ? 'O resultado será atualizado conforme as músicas forem adicionadas.'
            : item.sourceTruncated ? 'Divida a playlist de origem em partes menores antes de migrar novamente.'
                : attention && canReview ? 'Escolha alternativas para as músicas pendentes ou ignore as que não deseja levar.'
                    : item.status === 'failed' || attention ? 'Confira a mensagem da migração antes de tentar novamente.'
                        : 'Confira as faixas adicionadas ou baixe o relatório para guardar o resultado.';
    return <section aria-label={t('Resumo do resultado')} className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
        <div className="flex items-start gap-3 p-4 sm:p-5">
            <Icon aria-hidden="true" size={24} className={`mt-0.5 shrink-0 ${active ? 'text-sky-300' : attention || item.status === 'failed' || item.sourceTruncated ? 'text-amber-200' : 'text-green-300'}`} />
            <div className="min-w-0">
                <h3 className="text-base font-semibold text-white">{t(title)}</h3>
                <p className="mt-1 text-sm leading-6 text-muted">{t(description)}</p>
            </div>
        </div>
        <dl className="grid grid-cols-2 border-t border-white/10 sm:grid-cols-4">
            {[
                ['Adicionadas', getInsertedCount(item), 'text-green-300'],
                ['Aguardando revisão', item.needsReviewCount || 0, 'text-amber-200'],
                ['Não encontradas', item.notFoundCount || 0, 'text-amber-200'],
                ['Ignoradas', item.skippedCount || 0, 'text-muted'],
            ].map(([label, count, color]) => <div key={label} className="px-4 py-3 sm:px-5">
                <dt className="text-xs text-muted">{t(label)}</dt><dd className={`mt-1 text-2xl font-semibold tabular-nums ${count ? color : 'text-muted'}`}>{count}</dd>
            </div>)}
        </dl>
        {item.destinationVerification && <p className="flex items-start gap-2 border-t border-white/10 px-4 py-3 text-xs leading-5 text-muted sm:px-5">
            <ShieldCheck aria-hidden="true" size={16} className={`mt-0.5 shrink-0 ${verified ? 'text-green-300' : 'text-amber-200'}`} />
            {t(verified ? 'Presença e ordem verificadas' : 'Presença ou ordem ainda não confirmadas')}
        </p>}
    </section>;
};

export default TransferResultSummary;
