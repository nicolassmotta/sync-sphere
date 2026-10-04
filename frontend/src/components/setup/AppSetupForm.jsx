import { useText } from '../../i18n/useText';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Button from '../ui/Button';
import TextField from '../ui/TextField';
import CopySnippet from '../ui/CopySnippet';

const AppSetupForm = ({ providerId, onSaved }) => {
    const { t } = useText();
    const [clientId, setClientId] = useState('');
    const [redirectUri, setRedirectUri] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const inputRef = useRef(null);
    useEffect(() => {
        let cancelled = false;
        api.get(`/system/providers/${providerId}/setup`).then(({ data }) => {
            if (!cancelled) setRedirectUri(data.data.redirectUri);
        }).catch(() => { if (!cancelled) setError(t("Não foi possível carregar a configuração. Atualize a página.")); });
        return () => { cancelled = true; };
    }, [providerId, t]);
    const save = async (event) => {
        event.preventDefault();
        if (saving || !clientId.trim()) return;
        setSaving(true);
        setError('');
        try {
            await api.put(`/system/providers/${providerId}/setup`, { clientId: clientId.trim() });
            setClientId('');
            toast.success(t("Aplicativo configurado. Agora autorize sua conta."));
            await onSaved?.();
        } catch (failure) { setError(failure.response?.data?.message || t("Não foi possível salvar o Client ID.")); inputRef.current?.focus(); }
        finally { setSaving(false); }
    };
    return (
        <form onSubmit={save} className="space-y-4">
            <p className="text-sm text-muted">{t("No painel de desenvolvedores da plataforma, crie um aplicativo e cadastre este endereço de retorno exatamente como aparece:")}</p>
            {redirectUri && <CopySnippet code={redirectUri} label={t("Endereço de retorno")} />}
            <TextField ref={inputRef} maxLength={200} name="clientId" spellCheck={false} label={t("Client ID do seu aplicativo")} value={clientId} onChange={(event) => setClientId(event.target.value)} error={error} hint={t("O Client ID identifica o aplicativo criado por você. Não é sua senha da plataforma.")} autoComplete="off" />
            <Button type="submit" loading={saving} loadingLabel={t("Salvando...")} disabled={!clientId.trim()} variant="primary">{t("Salvar e continuar")}</Button>
        </form>
    );
};
export default AppSetupForm;
