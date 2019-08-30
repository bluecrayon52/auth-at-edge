// Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { readFileSync } from 'fs';
import { parse } from 'cookie';

export function getConfig() {
    // parse the contents of the configuration file
    const config = JSON.parse(readFileSync(`${__dirname}/configuration.json`).toString('utf8'));
    // get Cognito User Pool Region using regex (match outputs array) 
    const userPoolRegion = config.userPoolId.match(/(\S{2}-\S{4}-\S{1,2})_\S*/)[1];
    // Get token issuer 
    const tokenIssuer = `https://cognito-idp.${userPoolRegion}.amazonaws.com/${config.userPoolId}`;
    // get JSON Web Key Set (JWKS) Uniform Resource Identifier (uri)
    const tokenJwksUri = `${tokenIssuer}/.well-known/jwks.json`;
    
    return Object.assign({}, config, { tokenIssuer, tokenJwksUri, cloudFrontHeaders: asCloudFrontHeaders(config.httpHeaders) });
}
function extractCookiesFromHeaders(headers) {
    // Cookies are present in the HTTP header "Cookie" that may be present multiple times. 
    // This utility function parses occurrences  of that header and splits out all the cookies and their values
    // A simple object is returned that allows easy access by cookie name: e.g. cookies["nonce"]
    if (!headers['cookie']) {
        return {};
    }
    const cookies = headers['cookie'].reduce((reduced, header) => Object.assign(reduced, parse(header.value)), {});
    return cookies;
}
function withCookieDomain(distributionDomainName, cookieSettings) {
    if (cookieSettings.toLowerCase().indexOf('domain') === -1) {
        // Add leading dot for compatibility with Amplify (or js-cookie really)
        return `${cookieSettings}; Domain=.${distributionDomainName}`;
    }
    return cookieSettings;
}
export function asCloudFrontHeaders(headers) {
    return Object.entries(headers).reduce((reduced, [key, value]) => (Object.assign(reduced, {
        [key.toLowerCase()]: [{
                key,
                value
            }]
    })), {});
}
export function extractAndParseCookies(headers, clientId) {
    const cookies = extractCookiesFromHeaders(headers);
    if (!cookies) {
        return {};
    }
    const keyPrefix = `CognitoIdentityServiceProvider.${clientId}`;
    const lastUserKey = `${keyPrefix}.LastAuthUser`;
    const tokenUserName = cookies[lastUserKey];
    const scopeKey = `${keyPrefix}.${tokenUserName}.tokenScopesString`;
    const scopes = cookies[scopeKey];
    const idTokenKey = `${keyPrefix}.${tokenUserName}.idToken`;
    const idToken = cookies[idTokenKey];
    const accessTokenKey = `${keyPrefix}.${tokenUserName}.accessToken`;
    const accessToken = cookies[accessTokenKey];
    const refreshTokenKey = `${keyPrefix}.${tokenUserName}.refreshToken`;
    const refreshToken = cookies[refreshTokenKey];
    return {
        tokenUserName,
        idToken,
        accessToken,
        refreshToken,
        scopes,
        nonce: cookies['spa-auth-edge-nonce'],
        pkce: cookies['spa-auth-edge-pkce'],
    };
}
export function decodeToken(jwt) {
    const tokenBody = jwt.split('.')[1];
    const decodableTokenBody = tokenBody.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(Buffer.from(decodableTokenBody, 'base64').toString());
}
export function getCookieHeaders(clientId, oauthScopes, tokens, domainName, cookieSettings, expireAllTokens = false) {
    // Set cookies with the exact names and values Amplify uses for seamless interoperability with Amplify
    const decodedIdToken = decodeToken(tokens.id_token);
    const tokenUserName = decodedIdToken['cognito:username'];
    const keyPrefix = `CognitoIdentityServiceProvider.${clientId}`;
    const idTokenKey = `${keyPrefix}.${tokenUserName}.idToken`;
    const accessTokenKey = `${keyPrefix}.${tokenUserName}.accessToken`;
    const refreshTokenKey = `${keyPrefix}.${tokenUserName}.refreshToken`;
    const lastUserKey = `${keyPrefix}.LastAuthUser`;
    const scopeKey = `${keyPrefix}.${tokenUserName}.tokenScopesString`;
    const scopesString = oauthScopes.join(' ');
    const userDataKey = `${keyPrefix}.${tokenUserName}.userData`;
    const userData = JSON.stringify({
        UserAttributes: [
            {
                Name: 'sub',
                Value: decodedIdToken['sub']
            },
            {
                Name: 'email',
                Value: decodedIdToken['email']
            }
        ],
        Username: tokenUserName
    });
    const cookies = {
        [idTokenKey]: `${tokens.id_token}; ${withCookieDomain(domainName, cookieSettings.idToken)}`,
        [accessTokenKey]: `${tokens.access_token}; ${withCookieDomain(domainName, cookieSettings.accessToken)}`,
        [refreshTokenKey]: `${tokens.refresh_token}; ${withCookieDomain(domainName, cookieSettings.refreshToken)}`,
        [lastUserKey]: `${tokenUserName}; ${withCookieDomain(domainName, cookieSettings.idToken)}`,
        [scopeKey]: `${scopesString}; ${withCookieDomain(domainName, cookieSettings.accessToken)}`,
        [userDataKey]: `${encodeURIComponent(userData)}; ${withCookieDomain(domainName, cookieSettings.idToken)}`,
        'amplify-signin-with-hostedUI': `true; ${withCookieDomain(domainName, cookieSettings.accessToken)}`,
    };
    // Expire cookies if needed
    if (expireAllTokens) {
        Object.keys(cookies).forEach(key => cookies[key] = expireCookie(cookies[key]));
    }
    else if (!tokens.refresh_token) {
        cookies[refreshTokenKey] = expireCookie(cookies[refreshTokenKey]);
    }
    // Return object in format of CloudFront headers
    return Object.entries(cookies).map(([k, v]) => ({ key: 'set-cookie', value: `${k}=${v}` }));
}
function expireCookie(cookie) {
    const cookieParts = cookie
        .split(';')
        .map(part => part.trim())
        .filter(part => !part.toLowerCase().startsWith('max-age'))
        .filter(part => !part.toLowerCase().startsWith('expires'));
    const expires = `Expires=${new Date(0).toUTCString()}`;
    const [, ...settings] = cookieParts; // first part is the cookie value, which we'll clear
    return ['', ...settings, expires].join('; ');
}

