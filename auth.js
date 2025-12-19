/**
 * PKCE (Proof Key for Code Exchange) 认证流程处理
 */

const Auth = {
    // 生成随机字符串
    generateRandomString(length) {
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
        let result = '';
        const values = new Uint32Array(length);
        window.crypto.getRandomValues(values);
        for (let i = 0; i < length; i++) {
            result += charset[values[i] % charset.length];
        }
        return result;
    },

    // 生成 Code Challenge (SHA-256)
    async generateCodeChallenge(codeVerifier) {
        const encoder = new TextEncoder();
        const data = encoder.encode(codeVerifier);
        const digest = await window.crypto.subtle.digest('SHA-256', data);
        
        // 转换为 Base64URL 格式
        return btoa(String.fromCharCode(...new Uint8Array(digest)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    },

    // 开始登录流程
    async login() {
        // 1. 生成 Code Verifier
        const codeVerifier = this.generateRandomString(128);
        
        // 2. 保存 Verifier 到 SessionStorage (回调时需要)
        sessionStorage.setItem('pkce_code_verifier', codeVerifier);
        
        // 3. 生成 Code Challenge
        const codeChallenge = await this.generateCodeChallenge(codeVerifier);
        
        // 4. 构建授权 URL
        const params = new URLSearchParams({
            client_id: CONFIG.CLIENT_ID,
            redirect_uri: CONFIG.REDIRECT_URI,
            response_type: 'code',
            code_challenge: codeChallenge,
            code_challenge_method: 'S256'
        });

        // 5. 跳转
        window.location.href = `${CONFIG.AUTH_ENDPOINT}?${params.toString()}`;
    },

    // 处理回调 (从 URL 获取 code 并换取 token)
    async handleCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        
        if (!code) return false;

        // 清除 URL 中的 code 参数，保持地址栏整洁
        window.history.replaceState({}, document.title, window.location.pathname);

        const codeVerifier = sessionStorage.getItem('pkce_code_verifier');
        if (!codeVerifier) {
            console.error('找不到 Code Verifier，认证失败');
            return false;
        }

        try {
            const response = await axios.post(CONFIG.TOKEN_ENDPOINT, {
                client_id: CONFIG.CLIENT_ID,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: CONFIG.REDIRECT_URI,
                code_verifier: codeVerifier
            });

            if (response.data && response.data.access_token) {
                this.setToken(response.data.access_token, response.data.expires_in);
                sessionStorage.removeItem('pkce_code_verifier');
                return true;
            }
        } catch (error) {
            console.error('换取 Token 失败:', error);
            alert('登录失败，请检查控制台日志。可能原因：Client ID 配置错误或 Redirect URI 不匹配。');
        }
        return false;
    },

    setToken(token, expiresIn) {
        const expiryTime = new Date().getTime() + (expiresIn * 1000);
        localStorage.setItem('fflogs_access_token', token);
        localStorage.setItem('fflogs_token_expiry', expiryTime);
    },

    getToken() {
        const token = localStorage.getItem('fflogs_access_token');
        const expiry = localStorage.getItem('fflogs_token_expiry');
        
        if (!token || !expiry) return null;
        
        if (new Date().getTime() > parseInt(expiry)) {
            this.logout();
            return null;
        }
        
        return token;
    },

    logout() {
        localStorage.removeItem('fflogs_access_token');
        localStorage.removeItem('fflogs_token_expiry');
        window.location.reload();
    },

    isAuthenticated() {
        return !!this.getToken();
    }
};