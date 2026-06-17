/**
 * No modo local não há contas, senha ou JWT. Existe um único usuário implícito,
 * que é a pessoa dona da máquina. Estas rotas servem apenas para o front-end
 * confirmar a "sessão" local e oferecer um logout simbólico.
 */
const LOCAL_USER = {
    id: 'local',
    name: 'Você',
    email: null,
};

export const getMe = (req, res) => {
    res.status(200).json({
        status: 'success',
        data: {
            user: LOCAL_USER,
        },
    });
};

export const logout = (req, res) => {
    res.status(200).json({ status: 'success' });
};
