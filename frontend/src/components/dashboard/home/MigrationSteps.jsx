import { useText } from '../../../i18n/useText';
import { Check } from 'lucide-react';

const MIGRATION_STEPS = ['Origem', 'Destino', 'Conexões', 'Playlists', 'Resultado'];
const MigrationSteps = ({ step, onChange }) => {
    const { t } = useText();
    return <nav aria-label={t("Etapas da migração")} className="mb-7 overflow-x-auto">
        <ol className="flex min-w-max gap-2 sm:gap-3">
            {MIGRATION_STEPS.map((label, index) => (
                <li key={label}>
                    <button type="button" onClick={() => onChange(index)} disabled={index > step}
                        aria-current={step === index ? 'step' : undefined}
                        className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${step === index ? 'bg-spotify text-black' : 'border border-white/15 text-gray-200 disabled:text-gray-400'}`}>
                        <span className="grid h-5 w-5 place-items-center" aria-hidden="true">{index < step ? <Check size={16} /> : index + 1}</span>{t(label)}
                    </button>
                </li>
            ))}
        </ol>
    </nav>;
};
export default MigrationSteps;
