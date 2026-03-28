import fs from 'node:fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function getArgValue(flag) {
    const prefix = `--${flag}=`;
    for (let i = 2; i < process.argv.length; i += 1) {
        const raw = String(process.argv[i] || '');
        if (raw.startsWith(prefix)) {
            return raw.slice(prefix.length);
        }
        if (raw === `--${flag}` && i + 1 < process.argv.length) {
            return String(process.argv[i + 1] || '');
        }
    }
    return '';
}

function parseBool(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

function normalizeRole(value) {
    return String(value || '').trim().toLowerCase() === 'admin' ? 'admin' : 'user';
}

function loadServiceAccountConfig() {
    const rawJson = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
    if (rawJson) {
        try {
            return JSON.parse(rawJson);
        } catch (error) {
            throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT_JSON payload.');
        }
    }
    const filePath = String(
        process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS || ''
    ).trim();
    if (!filePath) {
        throw new Error('Service account JSON is required. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH.');
    }
    const fileContents = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContents);
}

async function main() {
    const email = String(getArgValue('email') || getArgValue('login') || '').trim();
    const uid = String(getArgValue('uid') || '').trim();
    const roleRaw = String(getArgValue('role') || '').trim();
    const adminRaw = String(getArgValue('admin') || '').trim();
    const clearRaw = String(getArgValue('clear') || '').trim();

    if (!email && !uid) {
        console.error('Usage: node scripts/set-custom-claims.mjs --email user@example.com --role admin');
        console.error('   or: node scripts/set-custom-claims.mjs --uid USER_UID --admin true');
        process.exit(1);
    }

    const wantsClear = parseBool(clearRaw);
    const role = roleRaw ? normalizeRole(roleRaw) : (parseBool(adminRaw) ? 'admin' : 'user');
    const claims = wantsClear ? {} : (role === 'admin' ? { admin: true, role: 'admin' } : { role: 'user' });

    const serviceAccount = loadServiceAccountConfig();
    const app = getApps().length
        ? getApps()[0]
        : initializeApp({
            credential: cert(serviceAccount)
        });
    const auth = getAuth(app);
    const user = uid ? await auth.getUser(uid) : await auth.getUserByEmail(email);

    await auth.setCustomUserClaims(user.uid, claims);
    console.log(`Custom claims updated for ${user.uid} (${user.email || 'unknown'}): ${JSON.stringify(claims)}`);
}

main().catch((error) => {
    console.error(error?.message || error);
    process.exit(1);
});
