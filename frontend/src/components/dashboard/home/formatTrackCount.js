import { translate as text } from '../../../i18n/index';
export const formatTrackCount = (count = 0) => {
    if (count === 1) return '1 faixa';
    return text("{{value0}} faixas", { value0: count });
};
