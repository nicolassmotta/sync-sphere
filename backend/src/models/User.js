import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { encryptText, decryptText } from '../utils/crypto.js';

/**
 * @typedef {Object} User
 * @description Esquema principal de Usuários (`userSchema`). Armazena credenciais locais encriptadas 
 * e abriga tokens de serviços OAuth.
 * As senhas usam `select: false` para nunca vazarem nos `.find()`.
 */
const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'O nome é obrigatório'],
        },
        email: {
            type: String,
            required: [true, 'O email é obrigatório'],
            unique: true,
            lowercase: true,
        },
        password: {
            type: String,
            required: [true, 'A senha é obrigatória'],
            minlength: 6,
            select: false, // Evita que a senha seja enviada para o front-end acidentalmente.
        },
        spotifyToken: {
            type: String, // Criptografado automaticamente no banco de dados via Mongoose
            default: null,
            select: false,
            set: encryptText,
            get: decryptText
        },
        spotifyRefreshToken: {
            type: String,
            default: null,
            select: false,
            set: encryptText,
            get: decryptText
        },
        spotifyTokenExpiresAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true, // Cria automaticamente createdAt e updatedAt
        toJSON: { getters: true },
        toObject: { getters: true }
    }
);

/**
 * @function preSave
 * @description Middleware nativo do mongoose engatilhado momentos antes de salvar um `User`.
 * Processa a re-encriptação usando Bcrypt com salt nível 14 caso o banco perceba mudança de senha.
 */
// Middleware Mongoose para gerar hash da senha antes de salvar no banco.
userSchema.pre('save', async function (next) {
    // Só roda a criptografia se a senha for alterada ou criada nesta chamada.
    if (!this.isModified('password')) return next();

    // Gera hash com saltCost 14, tornando ataques por força bruta mais caros.
    this.password = await bcrypt.hash(this.password, 14);
    next();
});

/**
 * @function correctPassword
 * @description Método de instância adicionado ao Mongoose para validação criptográfica com bcrypt.
 * Usa comparação resistente a ataques por temporização.
 * @param {string} candidatePassword - Senha recebida pelo formulário de login.
 * @param {string} userPassword - Hash salvo no banco de dados.
 * @returns {Promise<boolean>}
 */
// Método de instância para comparar senhas no login.
userSchema.methods.correctPassword = async function (
    candidatePassword,
    userPassword
) {
    return await bcrypt.compare(candidatePassword, userPassword);
};

const User = mongoose.model('User', userSchema);
export default User;
