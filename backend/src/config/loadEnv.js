import dotenv from 'dotenv';

// Permite execução isolada sem carregar credenciais da instalação local.
dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || '.env' });
