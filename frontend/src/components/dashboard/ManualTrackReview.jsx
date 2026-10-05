import { safeExternalUrl } from '../../utils/safeExternalUrl';
import { useText } from '../../i18n/useText';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Search } from 'lucide-react';
import api from '../../services/api';
import Button from '../ui/Button';
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
    const [message, setMessage] = useState('');
    const request = useRef(null);
    const headingRef = useRef(null);
    const selected = candidates.find((candidate) => candidate.id === selectedId);

    useEffect(() => {
        headingRef.current?.focus();
        const controller = new AbortController();
        api.get(`/transfer/${transferId}/tracks/${track.index}/${correction ? 'correction-candidates' : 'candidates'}`, { signal: controller.signal })
            .then((response) => { if (!controller.signal.aborted) setCandidates(response.data.data.candidates || []); })
            .catch((error) => { if (!controller.signal.aborted) setMessage(error.response?.data?.message || t('Não foi possível buscar uma alternativa.')); });
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
        if (onSelect) { onSelect(choice); onBack(); return; }
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
                <h3 ref={headingRef} tabIndex={-1} className="font-bold text-white">{t('Escolher alternativa no ')}{t(providerLabel)}</h3>
                <p className="mt-1 break-words text-sm text-muted">{t('Original: ')}{track.name} - {track.artist} {duration(track.durationMs)}</p>
                <p className="mt-2 text-sm text-white/65">{t('Ajuste o título e o artista, confira o resultado e confirme a música desejada.')}</p>
            </div>
            <form onSubmit={search}>
                <fieldset disabled={Boolean(busy)} className="space-y-4">
                    <TextField name="trackName" autoComplete="off" label={t('Título para buscar')} value={name} required maxLength={300}
                        onChange={(event) => { setName(event.target.value); setSelectedId(null); }} />
                    <TextField name="trackArtist" autoComplete="off" label={t('Artista para buscar')} value={artist} required maxLength={300}
                        onChange={(event) => { setArtist(event.target.value); setSelectedId(null); }} />
                    <Button type="submit" variant="secondary" leftIcon={<Search size={15} />}
                        loading={busy === 'search'} loadingLabel={t('Buscando...')}>{t('Buscar alternativa')}</Button>
                </fieldset>
            </form>
            <div aria-live="polite">{message ? <p className="text-sm text-yellow-300">{t(message)}</p> : null}</div>
            <fieldset disabled={Boolean(busy)} className="space-y-3">
                <legend className="mb-3 font-semibold">{t('Alternativas para comparar')}</legend>
                {candidates.map((candidate) => {
                    const url = safeExternalUrl(candidate.externalUrl);
                    return (
                        <div key={candidate.id} className="space-y-2 rounded-lg border border-spotify/25 bg-spotify/5 p-4">
                            <label className="flex cursor-pointer items-start gap-3">
                                <input type="radio" name="alternative" value={candidate.id} checked={selectedId === candidate.id}
                                    aria-describedby={`alternative-details-${candidate.id}`}
                                    onChange={() => setSelectedId(candidate.id)} className="mt-1 accent-spotify" />
                                <span className="min-w-0"><span className="block break-words font-bold text-white">{candidate.name || t('Metadados indisponíveis')}</span>
                                    <span className="block break-words text-sm text-white/70">{candidate.artist}</span></span>
                            </label>
                            <div id={`alternative-details-${candidate.id}`} className="space-y-2">
                            {candidate.album ? <p className="break-words text-sm text-muted">{candidate.album}</p> : null}
                            {candidate.durationMs > 0 ? <p className="text-xs text-muted">{t('Duração: ')}{duration(candidate.durationMs)}</p> : null}
                            <ul className="text-xs text-yellow-200">{(candidate.reasons || []).map((reason) => <li key={reason}>{t(REASONS[reason] || 'Evidência insuficiente')}</li>)}</ul>
                            {url ? <a className="inline-block text-sm text-spotify underline" href={url} target="_blank" rel="noreferrer">{t('Conferir na plataforma')}</a> : null}
                            </div>
                        </div>
                    );
                })}
                <p className="text-xs text-muted">{t('A faixa confirmada será adicionada ao fim da playlist. Se ainda não houver uma playlist, ela será criada.')}</p>
                <div className="flex flex-wrap gap-3">
                    <Button leftIcon={<Check size={15} />} onClick={() => choose()} disabled={!selected || Boolean(busy)}
                        loading={busy === 'confirm'} loadingLabel={t('Confirmando...')}>{t('Usar esta música')}</Button>
                    {!correction ? <Button variant="secondary" onClick={() => choose('skip')} disabled={Boolean(busy)}>{t('Ignorar esta faixa')}</Button> : null}
                    <Button variant="secondary" onClick={onBack} disabled={Boolean(busy)}>{t('Nenhuma alternativa serve')}</Button>
                </div>
            </fieldset>
        </div>
    );
};

export default ManualTrackReview;
