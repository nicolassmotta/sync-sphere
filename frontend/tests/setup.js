import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import i18n from '../src/i18n';

afterEach(cleanup);
beforeEach(async () => { await i18n.changeLanguage('pt-BR'); });
