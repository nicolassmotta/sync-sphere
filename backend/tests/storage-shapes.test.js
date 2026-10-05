import fs from 'node:fs';
import { dataFile } from '../src/config/paths.js';
import { encryptText } from '../src/utils/crypto.js';
import { readStore, writeStore, removeStore } from '../src/storage/jsonStore.js';

const collections = ['credentials.json', 'provider-credentials.json', 'provider-settings.json', 'transfers.json', 'queue.json', 'transfer-tracks-ficticio.json', 'file-imports.json', 'file-exports.json'];
it.each(collections)('%s com JSON válido de formato errado é recusado sem alterar seus bytes', (name) => {
    const original = Buffer.from(encryptText('"estado-invalido-ficticio"'));
    fs.writeFileSync(dataFile(name), original);
    try {
        expect(() => readStore(name, [])).toThrow(/DATA_DIR.*ENCRYPTION_KEY.*backup/);
        expect(() => writeStore(name, [])).toThrow();
        expect(fs.readFileSync(dataFile(name))).toEqual(original);
    } finally { removeStore(name); }
});
