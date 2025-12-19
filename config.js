// 配置信息
// 注意：在部署到 GitHub Pages 之前，请务必更新 REDIRECT_URI
const CONFIG = {
    // 请在此处填入您在 FF Logs 申请的 Client ID
    CLIENT_ID: 'a0a0b4af-5a50-4171-83c4-3c59dfaebea3', 
    
    // 授权回调地址，必须与 FF Logs 应用设置中的 Redirect URL 完全一致
    // 本地开发通常是 http://127.0.0.1:5500/index.html 或类似地址
    // 部署后应为 https://yourname.github.io/repo-name/
    REDIRECT_URI: 'https://yilegendoflink.github.io/XIVtimelineMaker/',
    
    // FF Logs 授权端点
    AUTH_ENDPOINT: 'https://www.fflogs.com/oauth/authorize',
    
    // FF Logs 令牌端点
    TOKEN_ENDPOINT: 'https://www.fflogs.com/oauth/token',
    
    // FF Logs API 端点
    // PKCE 流程获取的 Token 只能访问 user 端点
    API_ENDPOINT: 'https://www.fflogs.com/api/v2/user'
};
