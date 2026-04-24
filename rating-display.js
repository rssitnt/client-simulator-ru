export function getRatingOutcomeLabelText(outcome = '') {
    switch (String(outcome || '').trim()) {
    case 'go_silent':
        return 'Клиент ушёл молча';
    case 'end_conversation':
        return 'Диалог завершен';
    case 'continue':
        return 'Диалог можно было продолжать';
    case 'unknown':
        return 'Исход не определён';
    default:
        return '';
    }
}

export function getRatingOutcomeReasonLabelText(reason = '') {
    const normalized = String(reason || '').trim().toLowerCase();
    if (!normalized) return '';
    const labels = {
        lost_interest: 'пропал интерес',
        price_rejection: 'не устроила цена',
        manager_failed: 'менеджер не убедил',
        lost_trust: 'пропало доверие',
        resolved: 'вопрос закрыт',
        next_step_agreed: 'согласован следующий шаг',
        hard_refusal: 'жёсткий отказ',
        soft_refusal: 'мягкий отказ',
        timeout: 'клиент перестал отвечать'
    };
    return labels[normalized] || normalized.replace(/[_-]+/g, ' ');
}
