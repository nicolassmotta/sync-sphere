import { useState } from 'react';
import { Download, LifeBuoy, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { downloadFile, getDownloadError } from '../../utils/downloadFile';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import TextField from '../ui/TextField';

const topics = [
    { title: 'O aplicativo não abre', text: 'Abra Iniciar na pasta do SyncSphere e mantenha essa janela aberta. Se a porta estiver ocupada, encerre a outra instância ou confira Configuração avançada.', action: 'Guia de instalação', href: 'https://github.com/nicolassmotta/sync-sphere/blob/main/docs/getting-started.md' },
    { title: 'Minha conexão expirou', text: 'Seu progresso continua salvo. Conecte novamente a plataforma indicada; as correspondências já encontradas serão preservadas.', action: 'Abrir conexões', tab: 'integrations' },
    { title: 'A migração está pausada', text: 'A plataforma pode limitar as buscas. Confira o horário de retomada no resultado. O aplicativo tenta continuar automaticamente enquanto estiver aberto.', action: 'Acompanhar migração', tab: 'home' },
    { title: 'Algumas músicas não foram encontradas', text: 'Catálogos podem ter versões diferentes. Abra os detalhes no Histórico e use Escolher alternativa para revisar título e artista.', action: 'Abrir histórico', tab: 'history' },
    { title: 'A playlist ultrapassou o limite de leitura', text: 'Divida a playlist em partes menores e comece novas migrações. Quando o aplicativo detecta corte por limite, ele recusa a migração antes de criar o destino.', action: 'Conferir limites', href: 'https://github.com/nicolassmotta/sync-sphere/blob/main/docs/usage.md#limites-atuais' },
    { title: 'Os dados locais não podem ser abertos', text: 'Preserve a pasta de dados e a chave original. Confira se abriu a instalação correta. Não gere outra chave sobre seus dados. Um backup protegido pode ser restaurado com o aplicativo fechado.', action: 'Guia de recuperação', href: 'https://github.com/nicolassmotta/sync-sphere/blob/main/docs/backups.md' },
];

const SupportCenter = ({ onOpenTab }) => {
    const [diagnostic, setDiagnostic] = useState(null);
    const [loading, setLoading] = useState(false);
    const [backupOpen, setBackupOpen] = useState(false);
    const [password, setPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [creating, setCreating] = useState(false);
    const [backupError, setBackupError] = useState('');
    const previewDiagnostic = async () => {
        setLoading(true);
        try { setDiagnostic((await api.get('/system/diagnostic')).data.data); }
        catch (error) { toast.error(error.response?.data?.message || 'Não foi possível preparar o diagnóstico.'); }
        finally { setLoading(false); }
    };
    const closeBackup = () => { if (!creating) { setBackupOpen(false); setPassword(''); setConfirmation(''); setBackupError(''); } };
    const createBackup = async () => {
        setCreating(true);
        setBackupError('');
        try {
            const response = await api.post('/system/backups', { password }, { responseType: 'blob' });
            downloadFile(response.data, `syncsphere-backup-${new Date().toISOString().slice(0, 10)}.ssb`);
            setBackupOpen(false);
            toast.success('Backup protegido baixado. Guarde o arquivo e a senha em locais seguros.');
        } catch (error) { setBackupError(await getDownloadError(error, 'Não foi possível criar o backup.')); }
        finally { setCreating(false); setPassword(''); setConfirmation(''); }
    };
    return (
        <div className="space-y-6">
            <section className="elevated-card p-5 sm:p-7">
                <h2 className="text-2xl font-semibold text-white">Veja uma primeira migração</h2>
                <p className="my-3 text-sm leading-7 text-muted">Demonstração com dados fictícios, sem acessar contas de música. Você também pode ler a sequência abaixo.</p>
                <video controls preload="none" width="1280" height="960" poster="/tutorials/primeira-migracao.png" aria-label="Demonstração da primeira migração, com legendas em português" className="aspect-[4/3] h-auto w-full rounded-lg border border-white/15 bg-black">
                    <source src="/tutorials/primeira-migracao.mp4" type="video/mp4" />
                    <source src="/tutorials/primeira-migracao.webm" type="video/webm" />
                    <track kind="captions" src="/tutorials/primeira-migracao.vtt" srcLang="pt-BR" label="Português" default />
                    Seu navegador não conseguiu abrir o vídeo. Use as instruções de texto abaixo.
                </video>
                <details className="mt-4"><summary className="cursor-pointer font-semibold text-white">Ler a descrição da demonstração</summary>
                    <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-7 text-gray-200">
                        <li>No Início, use Experimentar sem contas.</li><li>Confira Minha primeira playlist, com três ocorrências e uma repetição.</li>
                        <li>Use Conferir e migrar e confirme Migrar 1 playlist.</li><li>Acompanhe o resultado de três músicas adicionadas.</li>
                        <li>Abra o Histórico e os detalhes para baixar a playlist ou um relatório.</li>
                    </ol>
                </details>
            </section>
            <section className="elevated-card p-5 sm:p-7">
                <h2 className="flex items-center gap-3 text-2xl font-semibold text-white"><LifeBuoy aria-hidden="true" /> Como podemos ajudar?</h2>
                <p className="mt-3 text-sm leading-6 text-muted">Escolha o que está acontecendo. Seus dados continuam neste computador.</p>
                <div className="mt-5 space-y-3">
                    {topics.map((topic) => <details key={topic.title} className="rounded-lg border border-white/15 p-4">
                        <summary className="cursor-pointer font-semibold text-white">{topic.title}</summary>
                        <p className="my-4 text-sm leading-7 text-gray-200">{topic.text}</p>
                        {topic.tab ? <Button size="sm" onClick={() => onOpenTab(topic.tab)}>{topic.action}</Button>
                            : <a className="text-sm font-semibold text-spotify underline underline-offset-4" href={topic.href} target="_blank" rel="noreferrer">{topic.action} (abre outra aba)</a>}
                    </details>)}
                </div>
            </section>
            <section className="elevated-card p-5 sm:p-7">
                <h2 className="flex items-center gap-3 text-2xl font-semibold text-white"><ShieldCheck aria-hidden="true" /> Proteja seus dados</h2>
                <p className="mt-3 text-sm leading-7 text-muted">O backup inclui histórico, fila, playlists de arquivo e credenciais salvas pelo painel. Ele será cifrado com uma senha escolhida por você. Configurações exclusivas do arquivo .env não entram no pacote.</p>
                <Button className="mt-4" onClick={() => setBackupOpen(true)} leftIcon={<Download size={16} />}>Criar backup protegido</Button>
                <details className="mt-5 rounded-lg border border-white/15 p-4">
                    <summary className="cursor-pointer font-semibold text-white">Como restaurar meu backup?</summary>
                    <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-7 text-gray-200">
                        <li>Encerre o SyncSphere e guarde uma cópia da instalação atual.</li>
                        <li>Na pasta do aplicativo, abra <strong>Restaurar-backup</strong>. Na instalação pelo código, use <code>npm run backup:restore -- --interactive</code>.</li>
                        <li>Selecione o arquivo .ssb, confirme RESTAURAR e informe a senha. A restauração substitui os dados locais pelo conteúdo do backup.</li>
                        <li>Abra o aplicativo novamente e confira o Histórico. Conexões vencidas podem precisar de nova autorização.</li>
                    </ol>
                    <p className="mt-4 text-sm text-amber-100">A senha não pode ser recuperada pelo aplicativo. A restauração é bloqueada enquanto outra instância estiver usando os dados.</p>
                </details>
            </section>
            <section className="elevated-card p-5 sm:p-7">
                <h2 className="text-2xl font-semibold text-white">Pedir ajuda à comunidade</h2>
                <p className="my-3 text-sm leading-7 text-muted">Prepare um diagnóstico, confira o conteúdo e escolha se quer anexá-lo à sua issue. Nada será enviado automaticamente.</p>
                <Button onClick={previewDiagnostic} loading={loading} loadingLabel="Preparando...">Revisar diagnóstico</Button>
                <a className="ml-4 inline-block py-3 text-sm font-semibold text-spotify underline underline-offset-4" href="https://github.com/nicolassmotta/sync-sphere/issues/new/choose" target="_blank" rel="noreferrer">Abrir uma issue (abre outra aba)</a>
            </section>
            <Modal isOpen={Boolean(diagnostic)} onClose={() => setDiagnostic(null)} title="Revise antes de compartilhar" description="O diagnóstico exclui credenciais, logs, caminhos, nomes de playlists e dados de conta. Confira o texto abaixo."
                footer={<Button onClick={() => downloadFile(JSON.stringify(diagnostic, null, 2), 'syncsphere-diagnostico.json')}>Baixar diagnóstico</Button>}>
                <pre className="whitespace-pre-wrap break-words rounded-lg bg-black/40 p-4 text-xs leading-6 text-gray-200">{JSON.stringify(diagnostic, null, 2)}</pre>
            </Modal>
            <Modal isOpen={backupOpen} onClose={closeBackup} title="Criar backup protegido" description="Escolha uma senha longa e guarde-a fora do arquivo de backup. Aguarde as transferências terminarem antes de continuar."
                footer={<Button variant="primary" onClick={createBackup} loading={creating} loadingLabel="Protegendo backup..." disabled={password.length < 12 || password !== confirmation}>Proteger e baixar</Button>}>
                <div className="space-y-4">
                    <TextField type="password" name="backupPassword" label="Senha do backup" value={password} onChange={(event) => setPassword(event.target.value)} hint="Pelo menos 12 caracteres. A senha não fica salva no aplicativo." autoComplete="new-password" disabled={creating} />
                    <TextField type="password" name="backupConfirmation" label="Repita a senha" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" disabled={creating} error={confirmation && confirmation !== password ? 'As senhas ainda não coincidem.' : undefined} />
                    {backupError && <p role="alert" className="text-sm text-red-200">{backupError}</p>}
                </div>
            </Modal>
        </div>
    );
};
export default SupportCenter;
