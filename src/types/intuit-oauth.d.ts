declare module "intuit-oauth" {
  interface OAuthClientConfig {
    clientId: string;
    clientSecret: string;
    environment: "sandbox" | "production";
    redirectUri: string;
    logging?: boolean;
  }

  interface TokenData {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
    x_refresh_token_expires_in: number;
    id_token?: string;
    realmId?: string;
  }

  interface Token {
    getToken(): TokenData;
    isAccessTokenValid(): boolean;
    isRefreshTokenValid(): boolean;
  }

  interface AuthResponse {
    getToken(): TokenData;
    getJson(): Record<string, unknown>;
    text: string;
    status: number;
  }

  class OAuthClient {
    constructor(config: OAuthClientConfig);
    authorizeUri(params: { scope: string | string[]; state?: string }): string;
    createToken(url: string): Promise<AuthResponse>;
    refresh(): Promise<AuthResponse>;
    refreshUsingToken(refreshToken: string): Promise<AuthResponse>;
    revoke(params?: { access_token?: string; refresh_token?: string }): Promise<AuthResponse>;
    makeApiCall(params: { url: string; method?: string; headers?: Record<string, string>; body?: string }): Promise<AuthResponse>;
    getToken(): Token;
    setToken(token: Partial<TokenData>): Token;

    static scopes: {
      Accounting: string;
      Payment: string;
      OpenId: string;
      Profile: string;
      Email: string;
      Phone: string;
      Address: string;
    };

    environment: {
      sandbox: string;
      production: string;
    };
  }

  export = OAuthClient;
}
