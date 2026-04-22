import { handleTokenServerRequest } from '../server/gemini-token-server.mjs';

export default async function handler(req, res) {
    return handleTokenServerRequest(req, res);
}
