/**
 * GameHub Portal Page Logic
 */
(function (window) {
    'use strict';

    let currentAuthMode = 'login';

    function openAuthModal(mode) {
        currentAuthMode = mode || 'login';
        switchAuthTab(currentAuthMode);
        const modal = document.getElementById('auth-modal-backdrop');
        if (modal) modal.classList.add('active');
        const input = document.getElementById('auth-username');
        if (input) input.focus();
    }

    function closeAuthModal() {
        const modal = document.getElementById('auth-modal-backdrop');
        if (modal) modal.classList.remove('active');
        clearAuthError();
    }

    function switchAuthTab(mode) {
        currentAuthMode = mode;
        clearAuthError();
        const tabLogin = document.getElementById('tab-login');
        const tabReg = document.getElementById('tab-register');
        const submitBtn = document.getElementById('btn-submit');

        if (mode === 'login') {
            if (tabLogin) tabLogin.classList.add('active');
            if (tabReg) tabReg.classList.remove('active');
            if (submitBtn) submitBtn.textContent = 'Einloggen';
        } else {
            if (tabReg) tabReg.classList.add('active');
            if (tabLogin) tabLogin.classList.remove('active');
            if (submitBtn) submitBtn.textContent = 'Konto erstellen';
        }
    }

    function showAuthError(msg) {
        const el = document.getElementById('auth-error');
        if (el) {
            el.textContent = msg;
            el.style.display = 'block';
        }
    }

    function clearAuthError() {
        const el = document.getElementById('auth-error');
        if (el) {
            el.textContent = '';
            el.style.display = 'none';
        }
    }

    async function handleAuthSubmit(e) {
        e.preventDefault();
        clearAuthError();

        const usernameEl = document.getElementById('auth-username');
        const passwordEl = document.getElementById('auth-password');
        const username = usernameEl ? usernameEl.value.trim() : '';
        const password = passwordEl ? passwordEl.value : '';

        if (!username || !password) {
            showAuthError('Bitte alle Felder ausfüllen.');
            return;
        }

        const endpoint = currentAuthMode === 'login' ? '/api/auth/login' : '/api/auth/register';

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                showAuthError(data.error || 'Aktion fehlgeschlagen.');
                return;
            }

            if (data.token) {
                sessionStorage.setItem('gamehub_token', data.token);
            }
            if (data.user) {
                sessionStorage.setItem('gamehub_user', JSON.stringify(data.user));
            }

            // Redirect to ?next= param if present, or reload cleanly without token in URL
            const urlParams = new URLSearchParams(window.location.search);
            const nextUrl = urlParams.get('next');
            if (nextUrl && nextUrl.startsWith('/')) {
                window.location.href = nextUrl;
            } else {
                window.location.href = '/';
            }
        } catch (err) {
            showAuthError('Verbindungsfehler. Bitte erneut versuchen.');
        }
    }

    async function handleLogout() {
        if (window.gamehubLogout) {
            await window.gamehubLogout();
        } else {
            sessionStorage.removeItem('gamehub_token');
            sessionStorage.removeItem('gamehub_user');
            window.location.href = '/';
        }
    }

    // Expose handlers to global window for inline onclick attributes
    window.openAuthModal = openAuthModal;
    window.closeAuthModal = closeAuthModal;
    window.switchAuthTab = switchAuthTab;
    window.showAuthError = showAuthError;
    window.clearAuthError = clearAuthError;
    window.handleAuthSubmit = handleAuthSubmit;
    window.handleLogout = handleLogout;

    // Check if redirected with ?login=1
    document.addEventListener('DOMContentLoaded', function () {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('login') === '1') {
            openAuthModal('login');
            showAuthError('Bitte einloggen, um das Spiel zu betreten.');
        }
    });

})(window);
