import fs from 'node:fs';
import { decideCandidates } from '../src/services/matching/decision.js';

const fixtures = JSON.parse(fs.readFileSync(new URL('../tests/fixtures/matching/quality.json', import.meta.url)));
const baseline = JSON.parse(fs.readFileSync(new URL('../tests/fixtures/matching/baseline.json', import.meta.url)));
for (const split of ['calibration', 'evaluation']) {
    const sample = fixtures.filter((fixture) => fixture.split === split);
    const policies = { ...baseline.results,
        atual: sample.map((fixture) => ({ id: fixture.id, accepted: decideCandidates(fixture.source, fixture.candidates).decision === 'accepted' })),
    };
    for (const [policy, results] of Object.entries(policies)) {
        const accepted = sample.filter((fixture) => results.find((result) => result.id === fixture.id)?.accepted);
        const correct = accepted.filter((fixture) => fixture.expected === 'accepted').length;
        console.log(JSON.stringify({ amostra: split, politica: policy, total: sample.length,
            aceitas: accepted.length, corretas: correct, erradas: accepted.length - correct,
            abstencoes: sample.length - accepted.length,
            precisaoNasAceitacoes: accepted.length ? correct / accepted.length : null,
            coberturaAutomatica: accepted.length / sample.length }));
    }
}
