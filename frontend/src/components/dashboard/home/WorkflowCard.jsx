import { useText } from '../../../i18n/useText';
import { ListMusic } from 'lucide-react';

const workflowSteps = [
    {
        label: '1',
        title: 'Back-end local',
        text: 'Suba a API Express; dados ficam em arquivos locais e a fila roda no processo.',
    },
    {
        label: '2',
        title: 'Integrações',
        text: 'Conecte a plataforma de origem e a de destino na aba Integrações.',
    },
    {
        label: '3',
        title: 'Migração',
        text: 'Escolha playlists, inicie a transferência e acompanhe cada faixa.',
    },
];

const WorkflowCard = ({ sourceLabel, targetLabel }) => {
    const { t } = useText();
    return <div className="elevated-card p-6">
        <div className="mb-6 flex items-center justify-between">
            <div>
                <p className="text-xs font-bold uppercase text-white/40">{t("Como funciona")}</p>
                <h3 className="mt-1 text-xl font-black text-white">{t("Fluxo local resumido")}</h3>
            </div>
            <ListMusic className="text-spotify" size={24} />
        </div>

        <div className="space-y-3">
            {workflowSteps.map((step, index) => (
                <div key={step.label} className="flex gap-4 rounded-lg border border-white/10 bg-black/30 p-4">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/10 text-sm font-black text-white">
                        {index + 1}
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase text-spotify">{t("Passo ")}{t(step.label)}</p>
                        <h4 className="mt-1 font-black text-white">{t(step.title)}</h4>
                        <p className="mt-1 text-sm leading-6 text-muted">{t(step.text)}</p>
                    </div>
                </div>
            ))}
            <div className="rounded-lg border border-white/10 bg-black/30 p-4">
                <p className="text-xs font-bold uppercase text-spotify">{t("Direção atual")}</p>
                <h4 className="mt-1 font-black text-white">{sourceLabel} -&gt; {targetLabel}</h4>
                <p className="mt-1 text-sm leading-6 text-muted">{t("A transferência cria a saída conforme as capacidades do destino selecionado.")}</p>
            </div>
        </div>
    </div>;
};

export default WorkflowCard;
