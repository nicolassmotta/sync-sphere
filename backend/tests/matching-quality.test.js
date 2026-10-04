import fs from 'node:fs';
import { decideCandidates, evaluateCandidate } from '../src/services/matching/decision.js';
import { scoreSpotifyCandidate } from '../src/services/spotify/spotifyTrackMatchScoring.js';
import { scoreYoutubeMusicCandidate } from '../src/services/youtubeMusic/youtubeMusicMatchScoring.js';

const fixtures = JSON.parse(fs.readFileSync(new URL('./fixtures/matching/quality.json', import.meta.url)));

describe.each(['calibration', 'evaluation'])('Qualidade: %s', (split) => {
    it.each(fixtures.filter((fixture) => fixture.split === split))('$id: $reason', ({ source, candidates, expected, critical }) => {
        const result = decideCandidates(source, candidates);
        expect(result.decision).toBe(expected);
        if (critical) expect(result.decision).not.toBe('accepted');
        for (const candidate of candidates) {
            const common = evaluateCandidate(source, candidate).matchScore;
            expect(scoreSpotifyCandidate(source, { ...candidate, artists: candidate.artists.map((name) => ({ name })), duration_ms: candidate.durationMs })).toBe(common);
            expect(scoreYoutubeMusicCandidate(source, { ...candidate, artist: { name: candidate.artists[0] }, duration: candidate.durationMs / 1000 })).toBe(common);
        }
    });
});

it('preserva identificadores de ocorrência sem confundir com identidade do candidato', () => {
    const fixture = fixtures.find((item) => item.id === 'intentional-repeat');
    expect(decideCandidates({ ...fixture.source, index: 0 }, fixture.candidates)).toEqual(decideCandidates(fixture.source, fixture.candidates));
});

it.each(['Cover Me', 'Live Forever'])('palavra de versão dentro do título %s não esconde uma versão adicionada', (name) => {
    const result = decideCandidates({ name, artist: 'Artista' }, [{ id: 'cover', name: `${name} (Cover)`, artists: ['Artista'] }]);
    expect(result.decision).toBe('needs_review');
    expect(result.reasons).toContain('version_conflict');
});
it('placeholder de artista ausente não vira evidência', () => {
    expect(decideCandidates({ name: 'Música', artist: 'Unknown' }, [{ id: 'id', name: 'Música', artist: 'Unknown' }]).decision).toBe('needs_review');
});

it('vozeamento japonês permanece parte da identidade Unicode', () => {
    expect(decideCandidates({ name: 'が', artist: '星' }, [{ id: 'errada', name: 'か', artists: ['星'] }]).decision).toBe('needs_review');
});
it('restrição regional explícita bloqueia aceitação mesmo sem is_playable', () => {
    expect(decideCandidates({ name: 'Música', artist: 'Artista' }, [{ id: 'bloqueada', name: 'Música', artist: 'Artista', restrictions: { reason: 'market' } }]).decision).toBe('needs_review');
});
