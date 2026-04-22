import { proxyToPublicBackend } from './_backend-proxy.mjs';

export default async function handler(req, res) {
    return proxyToPublicBackend(req, res, '/api/gemini-live-transcribe');
}
