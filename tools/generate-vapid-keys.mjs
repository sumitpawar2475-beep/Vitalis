import { generateKeyPairSync, randomBytes } from 'node:crypto';

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const publicJwk = publicKey.export({ format: 'jwk' });
const privateJwk = privateKey.export({ format: 'jwk' });
const x = Buffer.from(publicJwk.x, 'base64url');
const y = Buffer.from(publicJwk.y, 'base64url');
const publicKeyRaw = Buffer.concat([Buffer.from([0x04]), x, y]).toString('base64url');
const cronSecret = randomBytes(32).toString('hex');

console.log('Copy these values somewhere private. Never commit VAPID_KEYS_JWK or VITALIS_PUSH_CRON_SECRET.\n');
console.log('VITALIS_PUSH_PUBLIC_KEY=' + publicKeyRaw);
console.log('VAPID_KEYS_JWK=' + JSON.stringify({ publicKey: publicJwk, privateKey: privateJwk }));
console.log('VITALIS_PUSH_CRON_SECRET=' + cronSecret);
