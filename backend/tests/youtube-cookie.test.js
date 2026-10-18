import { normalizeCookieHeader } from '../src/services/youtubeMusic/youtubeMusicCookieAuth.js';

// Valores fictícios no formato dos cookies de sessão; nenhum pertence a uma conta real.
const expected = 'VISITOR_INFO1_LIVE=visitante-ficticio; SID=sessao-ficticia; __Secure-3PAPISID=apisid-ficticio/AbC';

describe('cookie do YouTube Music colado no painel', () => {
    it.each([
        ['cabeçalho puro', expected],
        ['cabeçalho com prefixo', `cookie: ${expected}`],
        ['cURL do Chrome em bash com -b', `curl 'https://music.youtube.com/youtubei/v1/browse?prettyPrint=false' \\\n  -H 'accept: */*' \\\n  -b '${expected}' \\\n  -H 'origin: https://music.youtube.com' \\\n  --data-raw '{"context":{"client":{"clientName":"WEB_REMIX"}}}'`],
        ['cURL do Firefox com -H Cookie', `curl 'https://music.youtube.com/youtubei/v1/browse' -H 'Accept: */*' -H 'Cookie: ${expected}' -H 'TE: trailers'`],
        ['cURL do Chrome em cmd', `curl ^"https://music.youtube.com/youtubei/v1/browse^" ^\n  -H ^"accept: */*^" ^\n  -b ^"${expected}^" ^\n  --data-raw ^"^{^}^"`],
        ['bloco de cabeçalhos da requisição', `:authority: music.youtube.com\n:method: POST\naccept: */*\ncookie: ${expected}\norigin: https://music.youtube.com`],
    ])('extrai somente o Cookie de %s', (_, pasted) => {
        expect(normalizeCookieHeader(pasted)).toBe(expected);
    });

    it('preserva a leitura da tabela de cookies copiada da aba Aplicativo', () => {
        expect(normalizeCookieHeader('SID\tsessao-ficticia\nHSID\t"hsid-ficticio"')).toBe('SID=sessao-ficticia; HSID=hsid-ficticio');
    });
});
