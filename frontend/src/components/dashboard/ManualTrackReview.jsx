import { safeExternalUrl } from '../../utils/safeExternalUrl';
import { useText } from '../../i18n/useText';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Search } from 'lucide-react';
import api from '../../services/api';
import Button from '../ui/Button';
import TextField from '../ui/TextField';

const ManualTrackReview = ({ transferId, track, providerLabel, onBack, onQueued }) => {
    const { t } = useText();
    const [name, setName] = useState(track.name || '');
    const [artist, setArtist] = useState(track.artist || '');
    const [candidate, setCandidate] = useState(null);
    const [busy, setBusy] = useState(null);
    const [message, setMessage] = useState('');
    const request = useRef(null);
    const headingRef = useRef(null);
    const candidateUrl = safeExternalUrl(candidate?.externalUrl);
    useEffect(() => { headingRef.current?.focus(); }, []);

    useEffect(() => () => request.current?.abort(), []);

    const search = async (event) => {
        event.preventDefault();
        setBusy('search');
        setMessage('');
        setCandidate(null);
        request.current = new AbortController();
        try {
            const response = await api.post(`/transfer/${transferId}/tracks/${track.index}/search`,
                { name, artist }, { signal: request.current.signal });
            setCandidate(response.data.data.candidate);
            if (!response.data.data.candidate) setMessage(t("Nenhuma alternativa encontrada. Tente outro título ou artista."));
        } catch (error) {
            if (error.code !== 'ERR_CANCELED') setMessage(error.response?.data?.message || t("Não foi possível buscar uma alternativa."));
        } finally {
            setBusy(null);
        }
    };

    const confirm = async () => {
        setBusy('confirm');
        setMessage('');
        request.current = new AbortController();
        try {
            const response = await api.post(`/transfer/${transferId}/tracks/${track.index}/confirm`,
                { candidateId: candidate.id }, { signal: request.current.signal });
            onQueued(response.data);
        } catch (error) {
            if (error.code !== 'ERR_CANCELED') setMessage(error.response?.data?.message || t("Não foi possível confirmar a escolha."));
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="space-y-5">
            <Button variant="secondary" size="sm" leftIcon={<ArrowLeft size={14} />} onClick={onBack} disabled={Boolean(busy)}>{t("Voltar às faixas")}</Button>
            <div>
                <h3 ref={headingRef} tabIndex={-1} className="font-bold text-white">{t("Escolher alternativa no ")}{t(providerLabel)}</h3>
                <p className="mt-1 break-words text-sm text-muted">{t("Original: ")}{track.name} - {track.artist}</p>
                <p className="mt-2 text-sm text-white/65">{t("Ajuste o título e o artista, confira o resultado e confirme a música desejada.")}</p>
            </div>
            <form onSubmit={search}>
                <fieldset disabled={Boolean(busy)} className="space-y-4">
                    <TextField name="trackName" autoComplete="off" label={t("Título para buscar")} value={name} required maxLength={300}
                        onChange={(event) => { setName(event.target.value); setCandidate(null); }} />
                    <TextField name="trackArtist" autoComplete="off" label={t("Artista para buscar")} value={artist} required maxLength={300}
                        onChange={(event) => { setArtist(event.target.value); setCandidate(null); }} />
                    <Button type="submit" variant="secondary" leftIcon={<Search size={15} />}
                        loading={busy === 'search'} loadingLabel={t("Buscando...")}>{t("Buscar alternativa")}</Button>
                </fieldset>
            </form>
            <div aria-live="polite">
                {message && <p className="text-sm text-yellow-300">{t(message)}</p>}
                {candidate && (
                    <div className="space-y-3 rounded-lg border border-spotify/25 bg-spotify/5 p-4">
                        <p className="break-words font-bold text-white">{candidate.name}</p>
                        <p className="break-words text-sm text-white/70">{candidate.artist}</p>
                        {candidate.durationMs > 0 && (
                            <p className="text-xs text-muted">{t("Duração: ")}{Math.floor(candidate.durationMs / 60000)}:{String(Math.floor(candidate.durationMs / 1000) % 60).padStart(2, '0')}</p>
                        )}
                        {candidateUrl && (
                            <a className="inline-block text-sm text-spotify underline" href={candidateUrl} target="_blank" rel="noreferrer">{t("Conferir na plataforma")}</a>
                        )}
                        <p className="text-xs text-muted">{t("A faixa confirmada será adicionada ao fim da playlist. Se ainda não houver uma playlist, ela será criada.")}</p>
                        <Button leftIcon={<Check size={15} />} onClick={confirm} disabled={Boolean(busy)}
                            loading={busy === 'confirm'} loadingLabel={t("Confirmando...")}>{t("Usar esta música")}</Button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ManualTrackReview;
