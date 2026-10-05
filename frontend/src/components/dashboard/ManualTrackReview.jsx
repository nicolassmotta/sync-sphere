import { safeExternalUrl } from '../../utils/safeExternalUrl';
import { useText } from '../../i18n/useText';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, ExternalLink, Music2, Search } from 'lucide-react';
import api from '../../services/api';
import { cn } from '../../utils/cn';
import Button from '../ui/Button';
import LoadingState from '../ui/LoadingState';
import TextField from '../ui/TextField';

const REASONS = {
    legacy_decision: 'Decisão antiga sem evidências', title_conflict: 'Título diferente', title_missing: 'Título ausente',
    artist_conflict: 'Artista diferente', artist_missing: 'Artista ausente',
    version_conflict: 'Versão diferente', duration_conflict: 'Duração diferente',
    isrc_conflict: 'ISRC diferente', unavailable: 'Indisponível no destino',
    explicit_conflict: 'Conteúdo explícito ou limpo diferente', ambiguous_candidates: 'Alternativas semelhantes',
};

const duration = (ms) => ms > 0 ? `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}` : '';

const ManualTrackReview = ({ transferId, track, providerLabel, onBack, onQueued, onSelect, selection, correction = false }) => {
    const { t } = useText();
    const [name, setName] = useState(track.name || '');
    const [artist, setArtist] = useState(track.artist || '');
    const [candidates, setCandidates] = useState([]);
    const [selectedId, setSelectedId] = useState(selection?.candidateId || null);
    const [busy, setBusy] = useState(null);
    const [loadingCandidates, setLoadingCandidates] = useState(true);
    const [message, setMessage] = useState('');
    const request = useRef(null);
    const headingRef = useRef(null);
    const selected = candidates.find((candidate) => candidate.id === selectedId);

    useEffect(() => {
        headingRef.current?.focus();
        const controller = new AbortController();
        setLoadingCandidates(true);
        api.get(`/transfer/${transferId}/tracks/${track.index}/${correction ? 'correction-candidates' : 'candidates'}`, { signal: controller.signal })
            .then((response) => { if (!controller.signal.aborted) setCandidates(response.data.data.candidates || []); })
            .catch((error) => { if (!controller.signal.aborted) setMessage(error.response?.data?.message || t('Não foi possível buscar uma alternativa.')); })
            .finally(() => { if (!controller.signal.aborted) setLoadingCandidates(false); });
        return () => { controller.abort(); request.current?.abort(); };
    }, [transferId, track.index, t, correction]);

    const search = async (event) => {
        event.preventDefault();
        setBusy('search');
        setMessage('');
        request.current = new AbortController();
        try {
            const response = await api.post(`/transfer/${transferId}/tracks/${track.index}/${correction ? 'correction-search' : 'search'}`,
                { name, artist }, { signal: request.current.signal });
            const found = response.data.data.candidates || (response.data.data.candidate ? [response.data.data.candidate] : []);
            setCandidates(found);
            setSelectedId(found.length === 1 ? found[0].id : null);
            if (!found.length) setMessage(t('Nenhuma alternativa encontrada. Tente outro título ou artista.'));
        } catch (error) {
            if (error.code !== 'ERR_CANCELED') setMessage(error.response?.data?.message || t('Não foi possível buscar uma alternativa.'));
        } finally { setBusy(null); }
    };

    const choose = (action = 'choose') => {
        const choice = { trackIndex: track.index, action,
            ...(action === 'choose' ? { candidateId: selected.id, revision: selected.revision } : {}) };
        if (onSelect) { onSelect(choice, action === 'choose' ? selected : undefined); onBack(); return; }
        confirm(choice);
    };

    const confirm = async (choice) => {
        setBusy('confirm');
        setMessage('');
        request.current = new AbortController();
        try {
            const path = choice.action === 'choose' ? `/transfer/${transferId}/tracks/${track.index}/confirm` : `/transfer/${transferId}/review`;
            const body = choice.action === 'choose' ? { candidateId: choice.candidateId } : { choices: [choice] };
            const response = await api.post(path, body, { signal: request.current.signal });
            onQueued(response.data);
        } catch (error) {
            if (error.code !== 'ERR_CANCELED') setMessage(error.response?.data?.message || t('Não foi possível confirmar a escolha.'));
        } finally { setBusy(null); }
    };

    return (
        <div className="space-y-5">
            <Button variant="secondary" size="sm" leftIcon={<ArrowLeft size={14} />} onClick={onBack} disabled={Boolean(busy)}>{t('Voltar às faixas')}</Button>
            <div>
                <h3 ref={headingRef} tabIndex={-1} className="text-xl font-semibold text-white">{t('Escolher alternativa no ')}{t(providerLabel)}</h3>
                <p className="mt-2 text-sm text-white/65">{t('Ajuste o título e o artista, confira o resultado e confirme a música desejada.')}</p>
            </div>
            <section aria-label={t('Faixa original')} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <Music2 aria-hidden="true" size={22} className="mt-1 shrink-0 text-muted" />
                <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted">{t('Faixa original')} · {track.index + 1}</p>
                    <p className="mt-1 break-words text-lg font-semibold text-white">{track.name}</p>
                    <p className="break-words text-sm text-muted">{track.artist}</p>
                    <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs">
                        {track.album ? <div><dt className="text-muted">{t('Álbum')}</dt><dd className="break-words text-white">{track.album}</dd></div> : null}
                        <div><dt className="text-muted">{t('Duração')}</dt><dd className="text-white">{duration(track.durationMs) || t('Não informada')}</dd></div>
                        {typeof track.explicit === 'boolean' ? <div><dt className="text-muted">{t('Conteúdo')}</dt><dd className="text-white">{t(track.explicit ? 'Explícito' : 'Sem conteúdo explícito')}</dd></div> : null}
                    </dl>
                </div>
            </section>
            <form onSubmit={search}>
                <fieldset disabled={Boolean(busy) || loadingCandidates} className="grid gap-4 sm:grid-cols-2">
                    <TextField name="trackName" autoComplete="off" label={t('Título para buscar')} value={name} required maxLength={300}
                        onChange={(event) => { setName(event.target.value); setSelectedId(null); }} />
                    <TextField name="trackArtist" autoComplete="off" label={t('Artista para buscar')} value={artist} required maxLength={300}
                        onChange={(event) => { setArtist(event.target.value); setSelectedId(null); }} />
                    <Button type="submit" className="justify-self-start sm:col-span-2" variant="secondary" leftIcon={<Search size={15} />}
                        loading={busy === 'search'} loadingLabel={t('Buscando...')}>{t('Buscar alternativa')}</Button>
                </fieldset>
            </form>
            <div aria-live="polite">{message ? <p className="text-sm text-yellow-300">{t(message)}</p> : null}</div>
            {loadingCandidates ? <LoadingState label={t('Carregando alternativas...')} /> : null}
            {!loadingCandidates && !candidates.length && !message ? <p role="status" className="rounded-lg border border-dashed border-white/20 p-4 text-sm text-muted">{t('Nenhuma alternativa disponível ainda. Busque pelo título e artista acima.')}</p> : null}
            <fieldset disabled={Boolean(busy) || loadingCandidates} className="space-y-4">
                <legend className="mb-3 font-semibold text-white">{t('Alternativas para comparar')}{candidates.length ? ` (${candidates.length})` : ''}</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                {candidates.map((candidate) => {
                    const url = safeExternalUrl(candidate.externalUrl);
                    const delta = candidate.durationMs > 0 && track.durationMs > 0 ? Math.round(Math.abs(candidate.durationMs - track.durationMs) / 1000) : null;
                    return (
                        <div key={candidate.id} className={cn('min-w-0 space-y-3 rounded-xl border p-4 transition-colors', selectedId === candidate.id ? 'border-spotify bg-spotify/10' : 'border-white/15 bg-white/[0.02]')}>
                            <label className="flex cursor-pointer items-start gap-3">
                                <input type="radio" name="alternative" value={candidate.id} checked={selectedId === candidate.id}
                                    aria-describedby={`alternative-details-${candidate.id}`}
                                    onChange={() => setSelectedId(candidate.id)} className="mt-1 h-4 w-4 shrink-0 accent-spotify focus-visible:outline-spotify" />
                                <span className="min-w-0"><span className="block break-words font-bold text-white">{candidate.name || t('Metadados indisponíveis')}</span>
                                    <span className="block break-words text-sm text-white/70">{candidate.artist}</span></span>
                            </label>
                            <div id={`alternative-details-${candidate.id}`} className="space-y-2">
                            <dl className="grid grid-cols-2 gap-3 text-xs">
                                <div className="min-w-0"><dt className="text-muted">{t('Álbum')}</dt><dd className="break-words text-white">{candidate.album || t('Não informado')}</dd></div>
                                <div><dt className="text-muted">{t('Duração')}</dt><dd className="text-white">{duration(candidate.durationMs) || t('Não informada')}</dd>
                                    {delta !== null && delta > 0 ? <dd className={delta > 15 ? 'text-amber-200' : 'text-muted'}>{t('{{value0}} s de diferença', { value0: delta })}</dd> : null}
                                </div>
                                {typeof candidate.explicit === 'boolean' ? <div><dt className="text-muted">{t('Conteúdo')}</dt><dd className="text-white">{t(candidate.explicit ? 'Explícito' : 'Sem conteúdo explícito')}</dd></div> : null}
                            </dl>
                            <ul className="text-xs text-yellow-200">{(candidate.reasons || []).map((reason) => <li key={reason}>{t(REASONS[reason] || 'Evidência insuficiente')}</li>)}</ul>
                            {url ? <a className="inline-flex min-h-9 items-center gap-2 text-sm text-green-300 underline underline-offset-4 focus-visible:outline-spotify" href={url} target="_blank" rel="noreferrer">{t('Conferir na plataforma')}<ExternalLink aria-hidden="true" size={13} /></a> : null}
                            </div>
                        </div>
                    );
                })}
                </div>
                <p className="text-xs text-muted">{t(correction ? 'A correção afeta somente a cópia. A playlist atual será preservada.' : onSelect ? 'Sua escolha entra no lote de revisão. Você pode conferir tudo antes de confirmar.' : 'A faixa confirmada será adicionada ao fim da playlist. Se ainda não houver uma playlist, ela será criada.')}</p>
                <div className="sticky bottom-0 z-10 flex flex-wrap gap-3 border-t border-white/10 bg-surfaceCard py-3">
                    <Button variant="primary" leftIcon={<Check size={15} />} onClick={() => choose()} disabled={!selected || Boolean(busy) || loadingCandidates}
                        loading={busy === 'confirm'} loadingLabel={t('Confirmando...')}>{t('Usar esta música')}</Button>
                    {!correction ? <Button variant="secondary" onClick={() => choose('skip')} disabled={Boolean(busy)}>{t('Ignorar esta faixa')}</Button> : null}
                    <Button variant="secondary" onClick={onBack} disabled={Boolean(busy)}>{t('Nenhuma alternativa serve')}</Button>
                </div>
            </fieldset>
        </div>
    );
};

export default ManualTrackReview;
