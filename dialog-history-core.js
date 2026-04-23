export function createDialogHistoryHelpers(deps = {}) {
    const parseIsoMs = typeof deps.parseIsoMs === 'function'
        ? deps.parseIsoMs
        : (() => 0);
    const normalizeLogin = typeof deps.normalizeLogin === 'function'
        ? deps.normalizeLogin
        : ((value = '') => String(value || '').trim().toLowerCase());
    const isValidLogin = typeof deps.isValidLogin === 'function'
        ? deps.isValidLogin
        : ((value = '') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeLogin(value)));
    const resolveNormalizedLogin = typeof deps.resolveNormalizedLogin === 'function'
        ? deps.resolveNormalizedLogin
        : ((raw, loginFallback = '') => normalizeLogin(raw?.login || loginFallback));
    const normalizeVoiceDialogForCompare = typeof deps.normalizeVoiceDialogForCompare === 'function'
        ? deps.normalizeVoiceDialogForCompare
        : ((value = '') => String(value || '').trim().toLowerCase());
    const normalizeVoiceDialogCompact = typeof deps.normalizeVoiceDialogCompact === 'function'
        ? deps.normalizeVoiceDialogCompact
        : ((value = '') => normalizeVoiceDialogForCompare(value).replace(/\s+/g, ''));

    function normalizeDialogHistoryText(value = '') {
        return String(value || '')
            .replace(/\r\n/g, '\n')
            .replace(/\u0000/g, '')
            .trim();
    }

    function clampDialogHistoryTitle(value = '', fallback = '') {
        const normalized = normalizeDialogHistoryText(value || fallback)
            .replace(/\s+/g, ' ')
            .trim();
        return normalized.slice(0, 140);
    }

    function summarizeDialogHistoryTitleCandidate(value = '') {
        const normalized = clampDialogHistoryTitle(value);
        if (!normalized) return '';
        const firstLine = normalized.split('\n').find((line) => line.trim()) || normalized;
        let summary = firstLine
            .replace(/^(?:привет|здравствуйте|здорово|добрый день|добрый вечер|доброе утро|алло|алё|слушаю|да|ну|ага|окей|ок)\s*[,.!?:-]*/i, '')
            .replace(/\s+/g, ' ')
            .trim();
        if (!summary) {
            summary = firstLine.trim();
        }
        const sentenceParts = summary.split(/[.!?]+/).map((part) => part.trim()).filter(Boolean);
        if (sentenceParts.length > 0 && sentenceParts[0].length >= 12) {
            summary = sentenceParts[0];
        }
        if (summary.length > 58) {
            const soft = summary.slice(0, 58);
            const lastSpace = soft.lastIndexOf(' ');
            summary = `${(lastSpace > 18 ? soft.slice(0, lastSpace) : soft).trim()}…`;
        }
        return clampDialogHistoryTitle(summary);
    }

    function formatDialogHistoryTitleCase(value = '') {
        const normalized = clampDialogHistoryTitle(value);
        if (!normalized) return '';
        return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    }

    function cleanupDialogHistorySubjectCandidate(value = '') {
        let subject = normalizeDialogHistoryText(value || '')
            .replace(/^(?:мне|нам|вообще|просто|сейчас|срочно|короче|значит|получается|нужен|нужна|нужны|нужно|ищу|интересует|требуется|подберите|подобрать|хочу)\s+/i, '')
            .replace(/\s+/g, ' ')
            .trim();
        if (!subject) return '';
        subject = subject
            .split(/\s+(?:на|для|под)\s+(?=[a-zа-яё0-9-]{2,})/i)[0]
            .split(/(?:,|;|\/)|\b(?:суглинок|суглинки|глина|песок|щебень|отверст(?:ие|ия|ий)|лунок|глубина|диаметр|цена|стоимость|срок(?:и)?|доставка|наличие)\b/i)[0]
            .replace(/\s+/g, ' ')
            .trim();
        if (!subject) return '';
        const words = subject.split(/\s+/).filter(Boolean).slice(0, 5);
        return formatDialogHistoryTitleCase(words.join(' '));
    }

    function extractDialogHistoryModelCandidate(text = '') {
        const normalized = normalizeDialogHistoryText(text || '').replace(/[()]/g, ' ');
        if (!normalized) return '';
        const brandMatch = normalized.match(/\b(?:CASE|CAT|CATERPILLAR|JCB|HITACHI|VOLVO|KOMATSU|DOOSAN|HYUNDAI|SANY|XCMG|BOBCAT|LIEBHERR|DEERE|JOHN\s+DEERE|NEW\s+HOLLAND|TAKEUCHI|YANMAR|KOBELCO|MST|SDLG)\s+[A-Z0-9-]{2,}\b/i);
        if (brandMatch?.[0]) {
            return brandMatch[0].replace(/\s+/g, ' ').toUpperCase();
        }
        const pairedMatch = normalized.match(/\b[A-ZА-ЯЁ]{2,}\s+[A-Z0-9-]{2,}\b/g);
        if (Array.isArray(pairedMatch)) {
            const candidate = pairedMatch.find((item) => /\d/.test(item));
            if (candidate) {
                return candidate.replace(/\s+/g, ' ').toUpperCase();
            }
        }
        const codeMatch = normalized.match(/\b[A-Z]{1,4}\d{2,}[A-Z0-9-]*\b/);
        return codeMatch?.[0]?.toUpperCase() || '';
    }

    function extractDialogHistoryQualifierCandidate(text = '') {
        const normalized = normalizeDialogHistoryText(text || '');
        if (!normalized) return '';
        const patterns = [
            /\b\d+\s*(?:лунок|отверст(?:ие|ия|ий)|мм|см|м|метр(?:а|ов)?|тонн(?:а|ы|)?|бар|смен(?:а|ы)?|час(?:а|ов)?|дн(?:я|ей)|куб(?:а|ов)?|м3)\b/i,
            /\b\d+\s+на\s+\d+\b/i,
            /\b(?:суглинок|суглинки|глина|песок|щебень)\b/i,
            /\b(?:цена|стоимость|срок(?:и)?|доставка|наличие)\b/i
        ];
        for (const pattern of patterns) {
            const match = normalized.match(pattern);
            if (match?.[0]) {
                return formatDialogHistoryTitleCase(match[0].toLowerCase());
            }
        }
        return '';
    }

    function extractDialogHistorySubjectCandidate(text = '') {
        const normalized = normalizeDialogHistoryText(text || '');
        if (!normalized) return '';
        const patterns = [
            /(?:нужен|нужна|нужны|нужно|ищу|интересует|требуется|подберите|подобрать|хочу)\s+([^.!?\n]+)/i,
            /(?:по|про)\s+([^.!?\n]+)/i
        ];
        for (const pattern of patterns) {
            const match = normalized.match(pattern);
            const candidate = cleanupDialogHistorySubjectCandidate(match?.[1] || '');
            if (candidate && /[a-zа-яё0-9]/i.test(candidate)) {
                return candidate;
            }
        }
        return '';
    }

    function formatDialogHistoryFallbackTitle(createdAt = '') {
        const ts = parseIsoMs(createdAt) || Date.now();
        const date = new Date(ts);
        const dd = String(date.getDate()).padStart(2, '0');
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        return `Диалог ${dd}.${mm} ${hh}:${min}`;
    }

    function isMeaningfulDialogHistoryTitleCandidate(value = '') {
        const raw = summarizeDialogHistoryTitleCandidate(value);
        if (!raw) return false;
        const normalized = normalizeVoiceDialogForCompare(raw);
        if (!normalized) return false;
        const compact = normalizeVoiceDialogCompact(raw);
        const genericSet = new Set([
            'привет',
            'здравствуйте',
            'добрыйдень',
            'алло',
            'алё',
            'да',
            'нет',
            'ок'
        ]);
        if (genericSet.has(compact)) return false;
        const words = normalized.split(/\s+/).filter(Boolean);
        if (raw.length < 10 && words.length <= 2) return false;
        return /[a-zа-яё0-9]/i.test(raw);
    }

    function looksLikeLegacyDialogHistoryTitle(value = '') {
        const normalized = normalizeDialogHistoryText(value || '');
        if (!normalized) return false;
        if (/^(?:привет|здравствуйте|здорово|добрый день|добрый вечер|доброе утро|алло|алё|слушаю|да,?\s|ну\s|короче\s|я\s+же\s+сказал)/i.test(normalized)) {
            return true;
        }
        if (normalized.length > 72) return true;
        if (normalized.split(/\s+/).filter(Boolean).length > 9) return true;
        return /[.!?]/.test(normalized);
    }

    function deriveDialogHistoryAutoTitleFromRecord(raw = null, createdAt = '') {
        if (!raw || typeof raw !== 'object') {
            return formatDialogHistoryFallbackTitle(createdAt);
        }
        const candidateMessages = [
            normalizeDialogHistoryText(raw.title || ''),
            normalizeDialogHistoryText(raw.autoTitle || ''),
            normalizeDialogHistoryText(raw.preview || '')
        ]
            .filter(Boolean)
            .filter((value, index, arr) => arr.indexOf(value) === index)
            .map((content) => ({ content }));

        if (!candidateMessages.length) {
            return formatDialogHistoryFallbackTitle(createdAt);
        }

        const derived = deriveDialogHistoryAutoTitle(candidateMessages, createdAt);
        if (isMeaningfulDialogHistoryTitleCandidate(derived)) {
            return derived;
        }

        const summarized = summarizeDialogHistoryTitleCandidate(candidateMessages[0]?.content || '');
        if (isMeaningfulDialogHistoryTitleCandidate(summarized)) {
            return summarized;
        }

        return formatDialogHistoryFallbackTitle(createdAt);
    }

    function shouldReplaceDialogHistoryTitleWithDerived(record = null, derivedTitle = '') {
        if (!record || !isMeaningfulDialogHistoryTitleCandidate(derivedTitle)) return false;
        if (!record.titleEdited) {
            return (
                !isMeaningfulDialogHistoryTitleCandidate(record.autoTitle)
                || !isMeaningfulDialogHistoryTitleCandidate(record.title)
                || looksLikeLegacyDialogHistoryTitle(record.title)
                || looksLikeLegacyDialogHistoryTitle(record.autoTitle)
            );
        }
        return false;
    }

    function deriveDialogHistoryAutoTitle(messages = [], createdAt = '') {
        const normalizedMessages = Array.isArray(messages) ? messages : [];
        if (normalizedMessages.length < 2) {
            return formatDialogHistoryFallbackTitle(createdAt);
        }
        const earlyMessages = normalizedMessages
            .slice(0, 6)
            .map((message) => normalizeDialogHistoryText(message?.content || ''))
            .filter(Boolean);
        if (!earlyMessages.length) {
            return formatDialogHistoryFallbackTitle(createdAt);
        }

        const earlyText = earlyMessages.join('. ').slice(0, 420);
        const subject = extractDialogHistorySubjectCandidate(earlyText);
        const model = extractDialogHistoryModelCandidate(earlyText);
        const qualifier = extractDialogHistoryQualifierCandidate(earlyText);

        let candidate = '';
        if (subject && model) {
            const normalizedSubject = subject.toUpperCase();
            candidate = normalizedSubject.includes(model)
                ? subject
                : `${subject} для ${model}`;
        } else if (subject) {
            candidate = subject;
        } else if (model) {
            candidate = `Диалог по ${model}`;
        }

        if (candidate && qualifier && !candidate.toLowerCase().includes(qualifier.toLowerCase())) {
            candidate = `${candidate} · ${qualifier}`;
        }

        candidate = clampDialogHistoryTitle(candidate);
        if (isMeaningfulDialogHistoryTitleCandidate(candidate)) {
            return candidate;
        }

        const firstStrongMessage = normalizedMessages.find((message) => isMeaningfulDialogHistoryTitleCandidate(message?.content));
        if (firstStrongMessage) {
            return clampDialogHistoryTitle(
                summarizeDialogHistoryTitleCandidate(firstStrongMessage.content),
                formatDialogHistoryFallbackTitle(createdAt)
            );
        }
        return formatDialogHistoryFallbackTitle(createdAt);
    }

    function buildDialogHistoryPreview(messages = [], ratingText = '') {
        const normalizedMessages = Array.isArray(messages)
            ? messages
                .map((message) => normalizeDialogHistoryText(message?.content || ''))
                .filter(Boolean)
            : [];
        const lastMessage = normalizedMessages[normalizedMessages.length - 1] || '';
        if (lastMessage) {
            return lastMessage.slice(0, 160);
        }
        return normalizeDialogHistoryText(ratingText).slice(0, 160);
    }

    function buildDialogHistoryMessagesMap(messages = []) {
        const normalizedMessages = Array.isArray(messages) ? messages : [];
        return normalizedMessages.reduce((acc, message, index) => {
            const content = normalizeDialogHistoryText(message?.content || '');
            if (!content) return acc;
            const id = `m_${String(index + 1).padStart(4, '0')}`;
            acc[id] = {
                id,
                seq: index + 1,
                role: message?.role === 'assistant' ? 'assistant' : 'user',
                content
            };
            return acc;
        }, {});
    }

    function normalizeDialogHistoryIndexRecord(raw, dialogId = '', loginFallback = '') {
        if (!raw || typeof raw !== 'object') return null;
        const login = resolveNormalizedLogin(raw, loginFallback);
        if (!isValidLogin(login)) return null;
        const id = String(raw.id || dialogId || '').trim();
        if (!id) return null;
        const createdAt = String(raw.createdAt || '').trim() || new Date().toISOString();
        const preview = normalizeDialogHistoryText(raw.preview || '').slice(0, 160);
        let autoTitle = clampDialogHistoryTitle(raw.autoTitle, formatDialogHistoryFallbackTitle(createdAt));
        const titleEdited = !!raw.titleEdited;
        let title = clampDialogHistoryTitle(raw.title, autoTitle);

        const derivedAutoTitle = clampDialogHistoryTitle(deriveDialogHistoryAutoTitleFromRecord({
            title,
            autoTitle,
            preview
        }, createdAt), formatDialogHistoryFallbackTitle(createdAt));

        if (isMeaningfulDialogHistoryTitleCandidate(derivedAutoTitle)) {
            autoTitle = derivedAutoTitle;
        }

        if (shouldReplaceDialogHistoryTitleWithDerived({ title, autoTitle: raw.autoTitle, titleEdited }, derivedAutoTitle)) {
            title = derivedAutoTitle;
        }

        return {
            id,
            login,
            uid: String(raw.uid || '').trim() || null,
            mode: raw.mode === 'voice' ? 'voice' : 'text',
            title,
            autoTitle,
            titleEdited,
            preview,
            messageCount: Math.max(0, Number(raw.messageCount) || 0),
            hasRating: !!raw.hasRating,
            pinnedAt: String(raw.pinnedAt || '').trim() || null,
            createdAt,
            updatedAt: String(raw.updatedAt || raw.lastMessageAt || createdAt).trim() || createdAt,
            lastMessageAt: String(raw.lastMessageAt || raw.updatedAt || createdAt).trim() || createdAt,
            closedAt: String(raw.closedAt || '').trim() || null,
            ratedAt: String(raw.ratedAt || '').trim() || null
        };
    }

    function normalizeDialogHistoryMessagesPayload(raw, loginFallback = '', dialogId = '') {
        if (!raw || typeof raw !== 'object') return null;
        const login = resolveNormalizedLogin(raw, loginFallback);
        if (!isValidLogin(login)) return null;
        const id = String(raw.id || dialogId || '').trim();
        if (!id) return null;
        const messagesRaw = raw.messages && typeof raw.messages === 'object' ? raw.messages : {};
        const messages = Object.entries(messagesRaw)
            .map(([messageId, item], index) => {
                const content = normalizeDialogHistoryText(item?.content || '');
                if (!content) return null;
                return {
                    id: String(item?.id || messageId || '').trim() || `m_${String(index + 1).padStart(4, '0')}`,
                    seq: Math.max(0, Number(item?.seq) || index + 1),
                    role: item?.role === 'assistant' ? 'assistant' : 'user',
                    content
                };
            })
            .filter(Boolean)
            .sort((a, b) => {
                if (a.seq !== b.seq) return a.seq - b.seq;
                return a.id.localeCompare(b.id);
            });
        const ratingText = normalizeDialogHistoryText(raw?.rating?.text || '');
        const createdAt = String(raw.createdAt || '').trim() || new Date().toISOString();
        return {
            id,
            login,
            uid: String(raw.uid || '').trim() || null,
            mode: raw.mode === 'voice' ? 'voice' : 'text',
            createdAt,
            updatedAt: String(raw.updatedAt || createdAt).trim() || createdAt,
            closedAt: String(raw.closedAt || '').trim() || null,
            ratedAt: String(raw.ratedAt || raw?.rating?.createdAt || '').trim() || null,
            messages,
            rating: ratingText
                ? {
                    text: ratingText,
                    createdAt: String(raw?.rating?.createdAt || raw.ratedAt || '').trim() || null
                }
                : null
        };
    }

    function sortDialogHistoryRecords(records = []) {
        return [...records].sort((a, b) => {
            const aPinned = parseIsoMs(a?.pinnedAt || '') || 0;
            const bPinned = parseIsoMs(b?.pinnedAt || '') || 0;
            if (aPinned || bPinned) {
                if (!aPinned) return 1;
                if (!bPinned) return -1;
                if (bPinned !== aPinned) return bPinned - aPinned;
            }
            const updatedDiff = (parseIsoMs(b?.updatedAt || '') || 0) - (parseIsoMs(a?.updatedAt || '') || 0);
            if (updatedDiff !== 0) return updatedDiff;
            const createdDiff = (parseIsoMs(b?.createdAt || '') || 0) - (parseIsoMs(a?.createdAt || '') || 0);
            if (createdDiff !== 0) return createdDiff;
            return String(a?.id || '').localeCompare(String(b?.id || ''));
        });
    }

    return {
        buildDialogHistoryMessagesMap,
        buildDialogHistoryPreview,
        clampDialogHistoryTitle,
        deriveDialogHistoryAutoTitle,
        deriveDialogHistoryAutoTitleFromRecord,
        formatDialogHistoryFallbackTitle,
        isMeaningfulDialogHistoryTitleCandidate,
        looksLikeLegacyDialogHistoryTitle,
        normalizeDialogHistoryIndexRecord,
        normalizeDialogHistoryMessagesPayload,
        normalizeDialogHistoryText,
        shouldReplaceDialogHistoryTitleWithDerived,
        sortDialogHistoryRecords,
        summarizeDialogHistoryTitleCandidate
    };
}
