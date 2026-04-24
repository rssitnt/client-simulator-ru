export function getWebhookDebugTypeLabelText(type = '') {
    switch (String(type || '').trim()) {
    case 'chat':
        return 'Чат';
    case 'chat_start':
        return 'Старт';
    case 'rating':
        return 'Оценка';
    case 'manager_assist':
        return 'Подсказка';
    case 'improve':
        return 'Улучшение';
    case 'attestation':
        return 'Аттестация';
    default:
        return 'Webhook';
    }
}

export function getWebhookDebugStatusLabelText(status = '') {
    switch (String(status || '').trim()) {
    case 'ok':
        return 'OK';
    case 'error':
        return 'Ошибка';
    default:
        return 'В работе';
    }
}

export function getAuthDebugStageLabelText(stage = '') {
    switch (String(stage || '').trim()) {
        case 'submit_started': return 'Начат вход';
        case 'email_link_check': return 'Проверка ссылки из письма';
        case 'account_lookup': return 'Поиск аккаунта';
        case 'access_policy': return 'Проверка доступа';
        case 'failed_attempt_save': return 'Фиксация неверной попытки';
        case 'firebase_session_open': return 'Открытие входа';
        case 'user_save': return 'Сохранение аккаунта';
        case 'invite_update': return 'Обновление приглашения';
        case 'verify_email_send': return 'Отправка письма подтверждения';
        case 'verify_email_mark': return 'Фиксация отправки письма';
        case 'protected_refresh': return 'Загрузка данных после входа';
        case 'access_mirror_sync': return 'Проверка и сохранение прав';
        case 'login_blocked': return 'Вход отклонён';
        case 'login_complete': return 'Вход завершён';
        case 'login_failed': return 'Вход завершился ошибкой';
        case 'reset_started': return 'Запрошен сброс пароля';
        case 'reset_sent': return 'Письмо для сброса отправлено';
        case 'reset_failed': return 'Сброс пароля завершился ошибкой';
        case 'restore_started': return 'Старт восстановления сессии';
        case 'restore_wait_firebase': return 'Ожидание восстановления входа';
        case 'restore_profile_lookup': return 'Поиск профиля при восстановлении';
        case 'restore_complete': return 'Сессия восстановлена';
        case 'restore_failed': return 'Восстановление сессии сорвалось';
        default: return stage || 'Событие входа';
    }
}

export function getDebugStatusLabelText(status = '') {
    switch (String(status || '').trim()) {
        case 'ok': return 'OK';
        case 'error': return 'Ошибка';
        default: return 'Лог';
    }
}

export function getVoiceDebugStageLabelText(stage = '') {
    switch (String(stage || '').trim()) {
        case 'start_requested': return 'Старт звонка';
        case 'sdk_loaded': return 'SDK загружен';
        case 'token_request_started': return 'Запрос ключа подключения';
        case 'token_request_succeeded': return 'Ключ подключения получен';
        case 'token_request_failed': return 'Ключ подключения не получен';
        case 'live_connect_started': return 'Открытие Gemini Live';
        case 'live_open': return 'Соединение установлено';
        case 'capture_fallback_default': return 'Микрофон переключён';
        case 'capture_ready': return 'Микрофон готов';
        case 'capture_failed': return 'Микрофон не инициализирован';
        case 'audio_output_primed': return 'Аудиовыход прогрет';
        case 'call_active': return 'Звонок активирован';
        case 'setup_complete': return 'Gemini готов';
        case 'first_user_audio': return 'Пошёл первый звук менеджера';
        case 'first_assistant_text': return 'Пришёл первый текст клиента';
        case 'first_audio_chunk': return 'Пришёл первый фрагмент аудио клиента';
        case 'first_audio_playback': return 'Стартовало первое воспроизведение';
        case 'transport_error': return 'Ошибка транспорта';
        case 'transport_close': return 'Соединение закрыто';
        case 'transport_failure': return 'Сбой голосового канала';
        case 'reconnect_scheduled': return 'Автопереподключение';
        case 'stop_requested': return 'Остановка звонка';
        case 'stopped': return 'Звонок остановлен';
        case 'start_failed': return 'Старт провалился';
        default: return stage || 'Событие';
    }
}

export function getGeminiVoiceMicLevelLabelText(state = 'low') {
    if (state === 'good') return 'Микрофон: хорошо';
    if (state === 'medium') return 'Микрофон: достаточно';
    return 'Микрофон: недостаточно';
}
