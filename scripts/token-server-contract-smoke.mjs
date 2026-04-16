import assert from 'node:assert/strict';

process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-gemini-key';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-openai-key';
process.env.FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY || 'test-firebase-key';

const {
    buildHealthPayload,
    createUpstreamApiError,
    extractTranscribeAudioBase64,
    validateTranscribeRequest
} = await import('../server/gemini-token-server.mjs');

assert.equal(extractTranscribeAudioBase64({ audioBase64: '  aaa  ' }), 'aaa');
assert.equal(extractTranscribeAudioBase64({ data: 'bbb' }), 'bbb');
assert.equal(extractTranscribeAudioBase64({ audio: 'ccc' }), 'ccc');
assert.equal(extractTranscribeAudioBase64({ audioBase64: '   ', data: 'ddd' }), 'ddd');
assert.equal(extractTranscribeAudioBase64({}), '');

assert.doesNotThrow(() => validateTranscribeRequest({ audioBase64: 'aaa' }));
assert.doesNotThrow(() => validateTranscribeRequest({ data: 'bbb' }));
assert.doesNotThrow(() => validateTranscribeRequest({ audio: 'ccc' }));

assert.throws(
    () => validateTranscribeRequest({ mimeType: 'audio/wav' }),
    (error) => Number(error?.statusCode) === 400 && error?.cause?.code === 'missing_audio'
);

const upstreamBadRequest = createUpstreamApiError(
    { status: 400 },
    { error: { message: 'Model is invalid', code: 'invalid_model' } },
    'Fallback error'
);
assert.equal(upstreamBadRequest.statusCode, 400);
assert.equal(upstreamBadRequest.message, 'Model is invalid');
assert.equal(upstreamBadRequest.cause?.code, 'invalid_model');
assert.equal(upstreamBadRequest.cause?.upstreamStatus, 400);

const upstreamRateLimit = createUpstreamApiError(
    { status: 429 },
    { error: { message: 'Too many requests' } },
    'Fallback error'
);
assert.equal(upstreamRateLimit.statusCode, 429);
assert.equal(upstreamRateLimit.cause?.code, 'upstream_rate_limited');

const health = buildHealthPayload();
assert.equal(health.ok, true);
assert.equal(health.routes?.geminiLiveToken?.ready, true);
assert.equal(health.routes?.geminiLiveTranscribe?.ready, true);
assert.equal(health.routes?.openaiRealtimeSession?.ready, true);
assert.deepEqual(health.routes?.geminiLiveToken?.missing, []);
assert.deepEqual(health.routes?.openaiRealtimeSession?.missing, []);

console.log('token-server contract smoke passed');
