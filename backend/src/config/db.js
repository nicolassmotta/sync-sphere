import './loadEnv.js';
import mongoose from 'mongoose';
import logger from '../utils/logger.js';

const connectDB = async () => {
    try {
        const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/spotify_to_yt';
        await mongoose.connect(uri);
        logger.info('[Banco] MongoDB conectado com sucesso!');
    } catch (error) {
        logger.error(`[Erro de banco] Falha ao conectar ao banco de dados: ${error.message}`);
        // Em um sistema real, a aplicação não deve iniciar sem banco
        throw error;
    }
};

export default connectDB;
