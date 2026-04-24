function normalizeUserRole(value = '') {
    return String(value || '').trim().toLowerCase() === 'admin' ? 'admin' : 'user';
}

export function getUserRoleLabel(role = '') {
    return normalizeUserRole(role) === 'admin' ? 'Админ' : 'Юзер';
}

export function getUserRoleIcon(role = '') {
    return normalizeUserRole(role) === 'admin' ? '🔑' : '👤';
}

export function getAdminPreviewModeLabelText(role = '') {
    return normalizeUserRole(role) === 'admin' ? 'Вид: админ' : 'Вид: клиент';
}

export function getAdminPreviewModeTitleText(role = '') {
    return normalizeUserRole(role) === 'admin'
        ? 'Переключить на клиентский вид'
        : 'Вернуться в админский вид';
}

export function getChatPanelModeEyebrowText(isAttestationMode = false) {
    return isAttestationMode ? 'Аттестация' : 'Чат';
}
