// Somente parâmetros produzidos pelo aplicativo são localizados. Títulos e artistas são dados do usuário.
export const MESSAGE_PARAMETER_TYPES = {
    'Migração concluída no {{value0}}: {{value1}}/{{value2}} faixas adicionadas.{{value3}}{{value4}}': { value0: 'provider', value3: 'message', value4: 'message' },
    ' {{value0}} {{value1}} nas pendências.': { value1: 'grammar' },
    '{{value0}} {{value1}} falha temporária. Nova tentativa automática em instantes.': { value1: 'grammar' },
    '{{value0}} {{value1}} para a fila.': { value1: 'grammar' },
    '{{value0}} Retomada automática programada.': { value0: 'message' },
    'Falha temporária: {{value0}} Nova tentativa automática programada.': { value0: 'message' },
    'A conexão precisa ser renovada ({{value0}} ou {{value1}}): {{value2}}': { value0: 'provider', value1: 'provider', value2: 'message' },
    'A conexão com o {{value0}} precisa ser renovada: {{value1}}': { value0: 'provider', value1: 'message' },
    'O {{value0}} bloqueou as buscas temporariamente: {{value1}}': { value0: 'provider', value1: 'message' },
};

export const PROVIDER_MESSAGE_PARAMETERS = {
    "{{value0}} não usa MusicKit.": {
        "value0": "provider"
    },
    "{{value0}} não usa login OAuth. Configure as credenciais em Integrações.": {
        "value0": "provider"
    },
    "{{value0}} não usa login OAuth.": {
        "value0": "provider"
    },
    "{{value0}} não aceita credenciais coladas no painel.": {
        "value0": "provider"
    },
    "{{value0}} não lista playlists da conta. Cole o link da playlist.": {
        "value0": "provider"
    },
    "Informe o link ou ID da playlist do {{value0}}.": {
        "value0": "provider"
    },
    "Falha ao buscar faixa no {{value0}}.": {
        "value0": "provider"
    },
    "O {{value0}} bloqueou as buscas temporariamente: {{value1}}": {
        "value0": "provider"
    },
    "A conexão com o {{value0}} precisa ser renovada: {{value1}}": {
        "value0": "provider"
    },
    "Migrada do {{value0}} pelo SyncSphere. Origem: {{value1}}": {
        "value0": "provider"
    },
    "Nenhum resultado confiável encontrado no {{value0}}.": {
        "value0": "provider"
    },
    "Lendo playlist no {{value0}}...": {
        "value0": "provider"
    },
    "Leitura interrompida pelo limite do {{value0}}: {{value1}} faixas migráveis lidas de {{value2}}. {{value3}} itens ficaram fora do snapshot. Divida a playlist em partes menores e tente novamente. Nenhuma playlist de destino foi criada.": {
        "value0": "provider"
    },
    "A playlist do {{value0}} não possui faixas migráveis.": {
        "value0": "provider"
    },
    "Procurando correspondências no {{value0}}...": {
        "value0": "provider"
    },
    "Procurando no {{value0}}: {{value1}} - {{value2}}": {
        "value0": "provider"
    },
    "Falha ao buscar faixas no {{value0}}: {{value1}}": {
        "value0": "provider"
    },
    "Nenhuma faixa da playlist foi encontrada no {{value0}}.": {
        "value0": "provider"
    },
    "Migração concluída no {{value0}}: {{value1}}/{{value2}} faixas adicionadas.{{value3}}{{value4}}": {
        "value0": "provider"
    },
    "Criando playlist privada no {{value0}}...": {
        "value0": "provider"
    },
    "A conexão precisa ser renovada ({{value0}} ou {{value1}}): {{value2}}": {
        "value0": "provider",
        "value1": "provider"
    },
    "Reconecte o {{value0}} antes de buscar uma alternativa.": {
        "value0": "provider"
    },
    "Não foi possível buscar no {{value0}}. Tente novamente em instantes.": {
        "value0": "provider"
    },
    "{{value0}} ainda não pode ser usado como origem.": {
        "value0": "provider"
    },
    "{{value0}} ainda não pode ser usado como destino.": {
        "value0": "provider"
    },
    "Não foi possível validar as faixas da playlist no {{value0}}.": {
        "value0": "provider"
    },
    "Algumas playlists não puderam ser lidas no {{value0}} antes da fila. {{value1}}": {
        "value0": "provider"
    },
    "Playlist do {{value0}}": {
        "value0": "provider"
    },
    "Cole o link ou ID da playlist do {{value0}}.": {
        "value0": "provider"
    },
    "O {{value0}} bloqueou as faixas dessa playlist.": {
        "value0": "provider"
    },
    "Playlists bloqueadas pelo {{value0}} ficaram fora da seleção.": {
        "value0": "provider"
    },
    "{{value0}} para {{value1}}. Suas playlists de origem serão preservadas.": {
        "value0": "provider",
        "value1": "provider"
    },
    "Não foi possível validar a conexão com {{value0}}. Confira o valor e tente novamente.": {
        "value0": "provider"
    },
    "Não foi possível conectar o {{value0}}.": {
        "value0": "provider"
    },
    "Não foi possível abrir a conexão com o {{value0}}.": {
        "value0": "provider"
    },
    "Falha ao desconectar {{value0}}.": {
        "value0": "provider"
    },
    "Conectar {{value0}}": {
        "value0": "provider"
    },
    "Conecte o {{value0}} para ler a playlist de origem.": {
        "value0": "provider"
    },
    "Destino {{value0}} pronto para receber as faixas selecionadas.": {
        "value0": "provider"
    },
    "Conecte o {{value0}} para criar playlists no destino.": {
        "value0": "provider"
    },
    "A conexão precisa permitir criar playlists no {{value0}}.": {
        "value0": "provider"
    },
    "Link ou ID da playlist no {{value0}}": {
        "value0": "provider"
    },
    " · há mais no {{value0}}": {
        "value0": "provider"
    },
    "Vamos copiar as músicas para {{value0}}. Suas playlists de origem não serão apagadas.": {
        "value0": "provider"
    },
    "Link da playlist no {{value0}}": {
        "value0": "provider"
    },
    "{{value0}} lê playlists públicas sem login.": {
        "value0": "provider"
    },
    "{{value0}} conectado para ler playlists.": {
        "value0": "provider"
    },
    "{{value0}} conectado para criar playlists.": {
        "value0": "provider"
    },
    "Cole o cookie do {{value0}} em Integrações.": {
        "value0": "provider"
    },
    "Conecte o {{value0}} em Integrações.": {
        "value0": "provider"
    },
    "Não foi possível carregar playlists do {{value0}}.": {
        "value0": "provider"
    },
    "Selecione ou cole uma playlist real do {{value0}}.": {
        "value0": "provider"
    },
    "Conecte o {{value0}} antes de ler a playlist de origem.": {
        "value0": "provider"
    },
    "Conecte o {{value0}} antes de criar playlists no destino.": {
        "value0": "provider"
    },
    "{{value0}} conectado com sucesso.": {
        "value0": "provider"
    },
    "Conexão com {{value0}} cancelada.": {
        "value0": "provider"
    }
};
