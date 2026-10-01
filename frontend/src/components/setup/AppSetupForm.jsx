import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Button from '../ui/Button';
import TextField from '../ui/TextField';
import CopySnippet from '../ui/CopySnippet';

const AppSetupForm = ({ providerId, onSaved }) => {
    const [clientId, setClientId] = useState('');
    const [redirectUri, setRedirectUri] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        let cancelled = false;
        api.get(`/system/providers/${providerId}/setup`).then(({ data }) => {
            if (!cancelled) setRedirectUri(data.data.redirectUri);
        }).catch(() => { if (!cancelled) setError('Não foi possível carregar a configuração. Atualize a página.'); });
        return () => { cancelled = true; };
    }, [providerId]);
    const save = async () => {
        setSaving(true);
        setError('');
        try {
            await api.put(`/system/providers/${providerId}/setup`, { clientId: clientId.trim() });
            setClientId('');
            toast.success('Aplicativo configurado. Agora autorize sua conta.');
            await onSaved();
        } catch (failure) { setError(failure.response?.data?.message || 'Não foi possível salvar o Client ID.'); }
        finally { setSaving(false); }
    };
    return (
        <div className="space-y-4">
            <p className="text-sm text-muted">No painel de desenvolvedores da plataforma, crie um aplicativo e cadastre este endereço de retorno exatamente como aparece:</p>
            {redirectUri && <CopySnippet code={redirectUri} label="Endereço de retorno" />}
            <TextField name="clientId" spellCheck={false} label="Client ID do seu aplicativo" value={clientId} onChange={(event) => setClientId(event.target.value)} error={error} hint="O Client ID identifica o aplicativo criado por você. Não é sua senha da plataforma." autoComplete="off" />
            <Button onClick={save} loading={saving} loadingLabel="Salvando..." disabled={!clientId.trim()} variant="primary">Salvar e continuar</Button>
        </div>
    );
};
export default AppSetupForm;
