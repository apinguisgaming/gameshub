/**
 * GameHub Tab Session Hydrator
 * Provides strict multi-tab session isolation and client-side token hydration.
 */
(function (window) {
    'use strict';

    function applyUserToUI(user) {
        var loggedInEls = document.querySelectorAll('.auth-logged-in, #auth-header-logged-in');
        var loggedOutEls = document.querySelectorAll('.auth-logged-out, #auth-header-logged-out');

        if (!user || !user.username) {
            loggedInEls.forEach(function (el) { el.style.display = 'none'; });
            loggedOutEls.forEach(function (el) { el.style.display = ''; });
            try {
                window.dispatchEvent(new CustomEvent('gamehub:auth', { detail: { user: null } }));
            } catch (e) {}
            return;
        }

        loggedInEls.forEach(function (el) { el.style.display = 'flex'; });
        loggedOutEls.forEach(function (el) { el.style.display = 'none'; });

        var name = user.username;
        document.querySelectorAll('.account-badge-username').forEach(function (el) {
            el.textContent = '👤 ' + name;
        });
        document.querySelectorAll('.account-badge-name').forEach(function (el) {
            el.textContent = name;
        });
        document.querySelectorAll('.account-badge-avatar').forEach(function (el) {
            el.textContent = '👤 ' + name;
        });
        document.querySelectorAll('.account-user-display').forEach(function (el) {
            el.textContent = '👤 ' + name;
        });

        // Impostor player 1 name
        var p1 = document.getElementById('player1-name-input');
        if (p1) {
            p1.value = name;
            p1.readOnly = true;
        }

        try {
            window.dispatchEvent(new CustomEvent('gamehub:auth', { detail: { user: user } }));
        } catch (e) {}
    }

    window.initTabSession = function (serverUser, serverToken, onReady) {
        // 1. If tab has no token yet, adopt server's initial session token
        var existingToken = sessionStorage.getItem('gamehub_token');
        if (!existingToken && serverToken) {
            sessionStorage.setItem('gamehub_token', serverToken);
            existingToken = serverToken;
            if (serverUser) {
                sessionStorage.setItem('gamehub_user', JSON.stringify(serverUser));
            }
        }

        // 2. Immediately apply cached user for instant rendering
        var cachedUser = null;
        try {
            var raw = sessionStorage.getItem('gamehub_user');
            if (raw) cachedUser = JSON.parse(raw);
        } catch (e) {}

        if (cachedUser) {
            window.GAMEHUB_USER = cachedUser;
            window.GAMEHUB_TOKEN = existingToken;
            applyUserToUI(cachedUser);
        } else if (serverUser) {
            window.GAMEHUB_USER = serverUser;
            window.GAMEHUB_TOKEN = existingToken;
            applyUserToUI(serverUser);
        }

        // Setup jQuery prefilter and timeout if jQuery is loaded on the page
        if (window.jQuery) {
            if (window.jQuery.ajaxSetup) {
                window.jQuery.ajaxSetup({ timeout: 8000 });
            }
            if (window.jQuery.ajaxPrefilter) {
                window.jQuery.ajaxPrefilter(function (options, originalOptions, jqXHR) {
                    var tok = window.GAMEHUB_TOKEN || sessionStorage.getItem('gamehub_token');
                    if (tok) {
                        jqXHR.setRequestHeader('X-Auth-Token', tok);
                    }
                });
            }
        }

        // 3. If no token at all, finish
        if (!existingToken) {
            if (onReady) onReady(window.GAMEHUB_USER);
            return;
        }

        // 4. Validate token with server to confirm tab identity
        fetch('/api/auth/me', {
            headers: { 'X-Auth-Token': existingToken }
        }).then(function (res) {
            return res.json();
        }).then(function (data) {
            if (data && data.authenticated && data.user) {
                sessionStorage.setItem('gamehub_user', JSON.stringify(data.user));
                window.GAMEHUB_USER = data.user;
                window.GAMEHUB_TOKEN = existingToken;
                applyUserToUI(data.user);
                if (onReady) onReady(data.user);
            } else {
                // Token was revoked or expired
                sessionStorage.removeItem('gamehub_token');
                sessionStorage.removeItem('gamehub_user');
                window.location.href = '/?login=1';
            }
        }).catch(function () {
            // Offline fallback
            if (onReady) onReady(window.GAMEHUB_USER);
        });
    };

    window.gamehubLogout = async function () {
        var token = window.GAMEHUB_TOKEN || sessionStorage.getItem('gamehub_token');
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: token ? { 'X-Auth-Token': token } : {}
            });
        } catch (e) {}
        sessionStorage.removeItem('gamehub_token');
        sessionStorage.removeItem('gamehub_user');
        window.location.href = '/';
    };

    document.addEventListener('DOMContentLoaded', function () {
        var u = window.GAMEHUB_USER;
        if (!u) {
            try {
                var raw = sessionStorage.getItem('gamehub_user');
                if (raw) u = JSON.parse(raw);
            } catch (e) {}
        }
        if (u) {
            applyUserToUI(u);
        }
    });

})(window);
