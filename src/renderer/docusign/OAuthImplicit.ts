/**
 * This file's functions are used for OAuthImplicit grant and
 * related authentication operations.
 */
/* eslint-disable react/destructuring-assignment */
import { toast } from 'react-toastify';
import { URLActionType, IOAuthAction } from '../../main/docusign/parse-app-url';
// eslint-disable-next-line import/no-cycle
import App from '../App';
import config from '../../config';

const expirationBuffer = 10 * 60; // 10 minute buffer
const sdkString = 'electron1';
const urlFrag = '/restapi/v2.1'; // DocuSign specific

class OAuthImplicit {
  //
  // Static methods
  //
  /**
   * Generate a psuedo random string
   * See https://stackoverflow.com/a/27747377/64904
   * @param {integer} len  length of the returned string
   */
  static generateId(len = 40): string {
    // dec2hex :: Integer -> String
    // i.e. 0-255 -> '00'-'ff'
    const arr = new Uint8Array((len || 40) / 2);

    function dec2hex(dec: number) {
      return `0${dec.toString(16)}`.substr(-2);
    }

    window.crypto.getRandomValues(arr);
    return Array.from(arr, dec2hex).join('');
  }

  /**
   * A relatively common OAuth API endpoint for obtaining information
   * on the user associated with the accessToken
   * @param accessToken string
   */
  static async fetchUserInfo(accessToken: string) {
    return fetch(`${config.idpUrl}/oauth/userinfo`, {
      headers: new Headers({
        Authorization: `Bearer ${accessToken}`,
        Accept: `application/json`,
        'X-DocuSign-SDK': sdkString,
      }),
    });
  }

  /**
   * Fetch the user-friendly version of the accountId.
   * See https://developers.docusign.com/docs/esign-rest-api/reference/accounts/accounts/get/
   */
  static async getExternalAccountId(
    accessToken: string,
    accountId: string,
    baseUri: string
  ) {
    try {
      const url = `${baseUri}${urlFrag}/accounts/${accountId}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: new Headers({
          Authorization: `Bearer ${accessToken}`,
          Accept: `application/json`,
          'X-DocuSign-SDK': sdkString,
        }),
      });
      const data = response && response.ok && (await response.json());
      return data.externalAccountId;
      // eslint-disable-next-line no-empty
    } catch (e) {
      return null;
    }
  }

  //
  // Instance properties
  //
  app: typeof App;

  loginWindow: Window | null = null;

  oauthState: string | null = null;

  //
  // constructor for the class
  //
  constructor(app: typeof App) {
    this.app = app;
    this.urlActionListener = this.urlActionListener.bind(this);
  }

  //
  // Instance methods
  //

  /**
   * Listener for url-action messages
   */
  async urlActionListener(action: URLActionType) {
    // console.log(`action: ${JSON.stringify(action)}`);
    if (!action || action.name !== config.implicitReturnPath) {
      return; // IGNORE this message
    }
    this.closeWindow();
    const oauthAction = action as IOAuthAction; // assertion
    if (this.oauthState !== oauthAction.state) {
      toast.error(
        'The OAuth response failed the security check.\nPlease retry.',
        { autoClose: 10000 }
      );
      return;
    }
    const toastId = toast.success('Completing the login process...', {
      autoClose: 7000,
    });
    const { accessToken } = oauthAction;

    // calculate expires to be expirationBuffer sooner
    const expires = new Date();
    expires.setTime(
      expires.getTime() + (oauthAction.expiresIn - expirationBuffer) * 1000
    );

    // call /oauth/userinfo for general user info
    // This API method is common for many IdP systems.
    // But the exact format of the response tends to vary.
    // The following works for the DocuSign IdP.
    let userInfoResponse;
    try {
      userInfoResponse = await OAuthImplicit.fetchUserInfo(accessToken);
    } catch (e) {
      const msg = `Problem while completing login.\nPlease retry.\nError: ${e.toString()}`;
      toast.error(msg, { autoClose: 10000 });
      return;
    }
    if (!userInfoResponse || !userInfoResponse.ok) {
      const msg = `Problem while completing login.\nPlease retry.\nError: ${userInfoResponse.statusText}`;
      toast.error(msg, { autoClose: 10000 });
      return;
    }
    const userInfo = await userInfoResponse.json();
    type Account = {
      account_id: string;
      account_name: string;
      base_uri: string;
      is_default: boolean;
    };
    const defaultAccount: Account = userInfo.accounts.filter(
      (acc: Account) => acc.is_default
    )[0];
    const externalAccountId: string = await OAuthImplicit.getExternalAccountId(
      accessToken,
      defaultAccount.account_id,
      defaultAccount.base_uri
    );

    toast.dismiss(toastId);
    this.app.oAuthResults({
      accessToken,
      expires,
      name: userInfo.name,
      email: userInfo.email,
      accountId: defaultAccount.account_id,
      externalAccountId,
      accountName: defaultAccount.account_name,
      baseUri: defaultAccount.base_uri,
    });
  }

  /**
   * Start the login flow by computing the Implicit grant URL
   * and opening a regular browser window with that URL for the
   * user.
   * Per RFC 8252 Sec 4, a regular browser should be used.
   * No type of embedded browser should be used.
   * See https://tools.ietf.org/html/rfc8252#section-4
   */
  startLogin() {
    const oauthState = OAuthImplicit.generateId();
    this.oauthState = oauthState;
    // One slash (no authority) is recommended by RFC
    // But some IdP's don't support it.
    const slashes = config.schemeSlashCount === 1 ? '/' : '//';
    // Our app's redirect url:
    const directRedirectUrl = `${config.schemeName}:${slashes}${config.implicitReturnPath}`;
    // Possibly use an intermediate redirect page:
    const redirectUrl = `redirect_uri=${
      config.implicitRedirectUrl && config.implicitRedirectUrl.length > 2
        ? config.implicitRedirectUrl
        : directRedirectUrl
    }`;
    const url =
      `${config.idpUrl}/oauth/auth?` +
      `response_type=token&` +
      `scope=${config.implicitScopes}&` +
      `client_id=${config.implicitClientId}&` +
      `state=${oauthState}&${redirectUrl}`;

    const DEVELOPMENT = process.env.NODE_ENV === 'development';
    const tempAccessToken = config.tempAccessToken;
    if (tempAccessToken && DEVELOPMENT) {
      // On a Mac, development mode does not enable OAuth since the private
      // scheme is only honored in production mode. (If assets/info.mac.plist is set.)
      // So in this case, if an access token is in the config file, we'll use that.
      const fakeResultsAction = {
        name: 'implicit-result',
        accessToken: tempAccessToken,
        state: oauthState,
        expiresIn: 28800,
      };
      this.urlActionListener(fakeResultsAction);
    } else {
      this.loginWindow = window.open(url, 'oauth_authentication', '');
      if (this.loginWindow) {
        this.loginWindow.focus();
      }
    }
  }

  /**
   * (Attempt) to close the browser window used for the OAuth authentication
   * Works with Chrome and most browsers since we opened the window.
   */
  closeWindow() {
    if (this.loginWindow) {
      this.loginWindow.close();
      this.loginWindow = null;
    }
  }
}

export default OAuthImplicit;
