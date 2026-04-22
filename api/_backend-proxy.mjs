import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API_DIR = path.dirname(fileURLToPath(import.meta.url));
const UPSTREAM_STATE_PATH = path.join(API_DIR, 'public-backend.json');

function getPublicBackendBaseUrl() {
    try {
        const parsed = JSON.parse(fs.readFileSync(UPSTREAM_STATE_PATH, 'utf8'));
        return String(parsed?.publicBaseUrl || '').trim().replace(/\/+$/, '');
    } catch (error) {
        return '';
    }
}

async function readRawRequestBody(req) {
    const chunks = [];
    for await (const chunk of req) {
        if (chunk == null) continue;
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return chunks.length ? Buffer.concat(chunks) : Buffer.alloc(0);
}

function buildProxyHeaders(sourceHeaders = {}, bodyBuffer) {
    const headers = {};
    for (const [key, value] of Object.entries(sourceHeaders || {})) {
        if (value == null) continue;
        const lowerKey = String(key).toLowerCase();
        if (
            lowerKey === 'host' ||
            lowerKey === 'connection' ||
            lowerKey === 'content-length' ||
            lowerKey === 'x-forwarded-host' ||
            lowerKey === 'x-forwarded-proto' ||
            lowerKey === 'x-forwarded-for' ||
            lowerKey.startsWith('x-vercel-')
        ) {
            continue;
        }
        headers[key] = value;
    }

    if (bodyBuffer?.length > 0) {
        headers['content-length'] = String(bodyBuffer.length);
    }

    return headers;
}

function copyResponseHeaders(res, upstreamHeaders) {
    for (const [key, value] of upstreamHeaders.entries()) {
        const lowerKey = key.toLowerCase();
        if (lowerKey === 'content-length' || lowerKey === 'transfer-encoding' || lowerKey === 'content-encoding') {
            continue;
        }
        res.setHeader(key, value);
    }
}

export async function proxyToPublicBackend(req, res, upstreamPath) {
    const publicBaseUrl = getPublicBackendBaseUrl();
    if (!publicBaseUrl) {
        res.statusCode = 500;
        res.setHeader('content-type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({
            error: 'Public backend URL is not configured for Vercel proxy.',
            code: 'missing_public_backend_url'
        }));
        return;
    }

    const incomingUrl = new URL(req.url || '/', 'https://proxy.local');
    const targetUrl = `${publicBaseUrl}${upstreamPath}${incomingUrl.search || ''}`;
    const method = String(req.method || 'GET').toUpperCase();
    const requestBody = method === 'GET' || method === 'HEAD' ? null : await readRawRequestBody(req);

    const upstreamResponse = await fetch(targetUrl, {
        method,
        headers: buildProxyHeaders(req.headers, requestBody),
        body: requestBody && requestBody.length > 0 ? requestBody : undefined,
        redirect: 'manual'
    });

    res.statusCode = upstreamResponse.status;
    copyResponseHeaders(res, upstreamResponse.headers);
    const responseBuffer = Buffer.from(await upstreamResponse.arrayBuffer());
    res.end(responseBuffer);
}
