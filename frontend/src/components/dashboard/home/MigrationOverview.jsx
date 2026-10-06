import { ArrowRight, AudioLines, CheckCircle2, Headphones, PlayCircle, ShieldCheck } from 'lucide-react';
import { useText } from '../../../i18n/useText';
import Button from '../../ui/Button';
import ProviderIcon from '../../ui/ProviderIcon';
import ProviderPairCard from './ProviderPairCard';
import ActiveTransferCard from './ActiveTransferCard';

const MigrationOverview = ({
    children, headingRef, providers, source, target, onProvidersChange,
    selectedCount, selectedTrackCount, readyToTransfer, isTransferring,
    onReviewTransfer, onOpenIntegrations, onStartDemo, demoLoading, integrationsLoading,
    progress, progressMessage, connectionState, transfers, onResumeTransfer, onOpenHistory,
}) => {
    const { t } = useText();
    const ready = source.canRead && target.canWrite;
    return <>
        <header className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
                <p className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-green-300"><AudioLines aria-hidden="true" size={17} />{t('Seu espaço de música')}</p>
                <h1 ref={headingRef} tabIndex={-1} className="max-w-3xl text-4xl font-extrabold leading-[1.12] tracking-tight text-white lg:text-5xl">{t('Sua música, sem fronteiras.')}</h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-muted">{t('Conecte suas plataformas, escolha as playlists e acompanhe cada música.')}</p>
            </div>
            <Button variant="secondary" leftIcon={<PlayCircle aria-hidden="true" size={18} />} onClick={onStartDemo} loading={demoLoading} loadingLabel={t('Carregando exemplo...')} disabled={integrationsLoading}>{t('Experimentar sem contas')}</Button>
        </header>
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0 space-y-6">
                <ProviderPairCard providers={providers} sourceProvider={source.id} targetProvider={target.id} onChange={onProvidersChange} />
                {children}
            </div>
            <aside aria-label={t('Resumo da migração')} className="min-w-0 space-y-5 xl:sticky xl:top-24">
                <section className="music-route-card elevated-card overflow-hidden p-5 sm:p-6">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="text-lg font-bold text-white">{t('Sua próxima migração')}</h2>
                        <Headphones aria-hidden="true" size={20} className="text-muted" />
                    </div>
                    <div className="relative my-7 flex items-center justify-between gap-3">
                        {[source, target].map((provider, index) => <div key={index} className="min-w-0 flex-1 text-center">
                            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-white/15 bg-black/25 shadow-panel"><ProviderIcon providerId={provider.id} size="lg" /></div>
                            <p className="mt-3 text-xs text-muted">{t(index === 0 ? 'Origem' : 'Destino')}</p>
                            <p className="mt-1 break-words text-sm font-semibold text-white">{t(provider.label)}</p>
                        </div>)}
                        <ArrowRight aria-hidden="true" size={20} className="absolute left-1/2 top-5 -translate-x-1/2 text-muted" />
                    </div>
                    <dl className="mb-5 flex justify-between gap-4 rounded-xl border border-white/10 bg-black/20 p-4">
                        <div><dt className="text-xs text-muted">{t('Playlists')}</dt><dd className="mt-1 text-2xl font-bold tabular-nums text-white">{selectedCount}</dd></div>
                        <div className="text-right"><dt className="text-xs text-muted">{t('Músicas na seleção')}</dt><dd className="mt-1 text-2xl font-bold tabular-nums text-white">{selectedTrackCount}</dd></div>
                    </dl>
                    <p className="mb-4 flex items-start gap-2 text-sm leading-6 text-muted"><CheckCircle2 aria-hidden="true" size={16} className={`mt-1 shrink-0 ${ready ? 'text-green-300' : 'text-amber-200'}`} />
                        {t(!source.canRead ? 'Conecte a origem para carregar suas playlists.' : !target.canWrite ? 'Conecte o destino para receber suas músicas.' : selectedCount ? 'Tudo pronto. Confira sua seleção antes de migrar.' : 'Escolha uma ou mais playlists para continuar.')}
                    </p>
                    <Button fullWidth variant="primary" disabled={ready && (!readyToTransfer || isTransferring)} onClick={ready ? onReviewTransfer : onOpenIntegrations} rightIcon={<ArrowRight aria-hidden="true" size={16} />}>{t(ready ? 'Conferir e migrar' : 'Preparar conexões')}</Button>
                    <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-muted"><ShieldCheck aria-hidden="true" size={15} className="mt-0.5 shrink-0 text-green-300" />{t('Suas playlists de origem serão preservadas.')}</p>
                    {target.validation?.write === 'experimental' && <p className="mt-4 rounded-lg border border-amber-300/20 bg-amber-300/5 p-3 text-xs leading-5 text-amber-100">{t('Escrita experimental. Confira o guia da plataforma antes de usar uma conta real.')}</p>}
                </section>
                <ActiveTransferCard isTransferring={isTransferring} progress={progress} progressMessage={progressMessage} connectionState={connectionState} transfers={transfers} onResume={onResumeTransfer} onOpenIntegrations={onOpenIntegrations} onOpenHistory={onOpenHistory} />
            </aside>
        </div>
    </>;
};

export default MigrationOverview;
