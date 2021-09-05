/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable class-methods-use-this */
/* eslint-disable react/destructuring-assignment */
/* eslint react/prop-types: 0 */
import React from 'react';
import PropTypes from 'prop-types';
import { Switch, Route, withRouter } from 'react-router-dom';
import './App.global.css';
import { IpcRendererEvent } from 'electron/renderer';
import { ToastContainer, toast } from 'react-toastify';
import PhoneInput, { parsePhoneNumber } from 'react-phone-number-input';
import flags from 'react-phone-number-input/flags';
import Home from './components/Home';
import LoggingIn from './components/LoggingIn';
// eslint-disable-next-line import/no-cycle
import OAuthImplicit from './docusign/OAuthImplicit';

const documentFileName = 'World_Wide_Corp_lorem.pdf';
const documentName = 'Example document.pdf';
const documentExtension = 'pdf';
const emailSubject = 'Please sign the attached document';

// state attributes for authentication results and state
type AppState = {
  accessToken: string | undefined;
  expires: Date | undefined;
  name: string | undefined;
  email: string | undefined;
  accountId: string | undefined;
  externalAccountId: string | undefined;
  accountName: string | undefined;
  baseUri: string | undefined;
  formName: string;
  formEmail: string;
  formPhoneNumber: string;
  defaultCountry: string | undefined;
  working: boolean;
  responseErrorMsg: string | undefined;
  responseEnvelopeId: string | undefined;
  responseAvailableApiRequests: number | undefined;
  responseApiRequestsReset: Date | undefined;
  responseSuccess: boolean | undefined;
  responseTraceId: string | undefined;
};

interface OAuthResults {
  accessToken: string | null;
  expires: Date | null;
  name: string | null;
  email: string | null;
  accountId: string | null;
  externalAccountId: string | null;
  accountName: string | null;
  baseUri: string | null;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    electron: any;
  }
}

class App extends React.Component<unknown, AppState> {
  // eslint-disable-next-line react/static-property-placement
  static propTypes = {
    // match: PropTypes.object.isRequired,
    // location: PropTypes.object.isRequired,
    // eslint-disable-next-line react/forbid-prop-types
    history: PropTypes.object.isRequired,
  };

  oAuthImplicit: OAuthImplicit;

  // constructor for the class
  constructor(props: unknown) {
    super(props);
    this.state = {
      accessToken: undefined,
      expires: undefined,
      name: undefined,
      // eslint-disable-next-line react/no-unused-state
      email: undefined,
      externalAccountId: undefined,
      accountName: undefined,
      formName: '',
      formEmail: '',
      formPhoneNumber: '',
      defaultCountry: undefined,
      working: false,
      responseErrorMsg: undefined,
      responseEnvelopeId: undefined,
      responseAvailableApiRequests: undefined,
      responseApiRequestsReset: undefined,
      responseSuccess: undefined,
      responseTraceId: undefined,
      accountId: undefined,
      baseUri: undefined,
    };
    this.oAuthImplicit = new OAuthImplicit(this);

    // this.docusign = new DocuSign(this);
    this.setDefaultCountry = this.setDefaultCountry.bind(this);
    this.startAuthentication = this.startAuthentication.bind(this);
    this.cancelAuthentication = this.cancelAuthentication.bind(this);
    this.logout = this.logout.bind(this);
    this.formNameChange = this.formNameChange.bind(this);
    this.formEmailChange = this.formEmailChange.bind(this);
    this.formPhoneNumberChange = this.formPhoneNumberChange.bind(this);
    this.sendEnvelope = this.sendEnvelope.bind(this);
    this.UserInformationBlock = this.UserInformationBlock.bind(this);
    this.Form = this.Form.bind(this);
  }

  componentDidMount() {
    // subscribe to channels
    // See src/preload.js
    window.electron.ipcRenderer.on(
      'url-action',
      this.oAuthImplicit.urlActionListener
    );
    window.electron.ipcRenderer.on('geoIpCountryCode', this.setDefaultCountry);
  }

  componentWillUnmount() {
    window.electron.ipcRenderer.removeListener(
      'url-action',
      this.oAuthImplicit.urlActionListener
    );
  }

  setDefaultCountry(defaultCountry: string) {
    this.setState({ defaultCountry });
  }

  async startAuthentication() {
    this.clearAuth();
    this.oAuthImplicit.startLogin();
  }

  cancelAuthentication() {
    this.clearAuth();
    this.oAuthImplicit.closeWindow();
  }

  clearAuth() {
    this.setState({
      accessToken: undefined,
      expires: undefined,
      accountId: undefined,
      externalAccountId: undefined,
      accountName: undefined,
      baseUri: undefined,
      name: undefined,
      email: undefined,
    });
  }

  clearState() {
    this.setState({
      formName: '',
      formEmail: '',
      formPhoneNumber: '',
      working: false,
      responseErrorMsg: undefined,
      responseEnvelopeId: undefined,
      responseAvailableApiRequests: undefined,
      responseApiRequestsReset: undefined,
      responseSuccess: undefined,
      responseTraceId: undefined,
    });
  }

  /**
   * Is the accessToken ok to use?
   * @returns boolean accessTokenIsGood
   */
  checkToken(): boolean {
    // eslint-disable-next-line react/destructuring-assignment
    if (
      !this.state.accessToken ||
      this.state.expires === undefined ||
      new Date() > this.state.expires
    ) {
      // Need new login. Only clear auth, don't clear the state (leave form contents);
      this.clearAuth();
      this.setState({ working: false });
      toast.error('Your login session has ended.\nPlease login again', {
        autoClose: 8000,
      });
      return false;
    }
    return true;
  }

  /**
   * This method clears this app's authentication information.
   * But there may still be an active login session cookie
   * from the IdP. Your IdP may have an API method for clearing
   * the login session.
   */
  logout() {
    this.clearAuth();
    this.clearState();
    this.props.history.push('/');
    toast.success('You have logged out.', { autoClose: 1000 });
  }

  /**
   * Process the oauth results.
   * This method is called by the OAuthImplicit class
   * @param results
   */
  oAuthResults(results: OAuthResults) {
    this.setState({
      accessToken: results.accessToken ? results.accessToken : undefined,
      expires: results.expires ? results.expires : undefined,
      name: results.name ? results.name : undefined,
      formName: results.name ? results.name : '',
      externalAccountId: results.externalAccountId
        ? results.externalAccountId
        : undefined,
      email: results.email ? results.email : undefined,
      formEmail: results.email ? results.email : '',
      accountId: results.accountId ? results.accountId : undefined,
      accountName: results.accountName ? results.accountName : undefined,
      baseUri: results.baseUri ? results.baseUri : undefined,
    });

    toast.success(`Welcome ${results.name}, you are now logged in`);
    this.props.history.push('/form');
  }

  formNameChange(event: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ formName: event.target.value });
  }

  formEmailChange(event: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ formEmail: event.target.value });
  }

  formPhoneNumberChange(value: string) {
    this.setState({ formPhoneNumber: value });
  }

  async sendEnvelope() {
    this.setState({
      responseErrorMsg: undefined,
      responseEnvelopeId: undefined,
      responseAvailableApiRequests: undefined,
      responseApiRequestsReset: undefined,
      responseSuccess: undefined,
      responseTraceId: undefined,
    });
    if (!this.checkToken()) {
      // Problem! The user needs to login
      return;
    }
    if (!this.state.formEmail || this.state.formEmail.length < 5) {
      toast.error("Problem: Enter the signer's email address");
      return;
    }
    if (!this.state.formName || this.state.formName.length < 5) {
      toast.error("Problem: Enter the signer's name");
      return;
    }
    if (!this.state.formPhoneNumber || this.state.formPhoneNumber.length < 5) {
      toast.error("Problem: Enter the signer's phone number");
      return;
    }
    const phoneNumber = parsePhoneNumber(this.state.formPhoneNumber);
    let smsCountryCode = ''; // The country code and number to be sent to DocuSign
    let smsNumber = '';

    if (phoneNumber) {
      // The country code is just the digits, no leading 1
      smsCountryCode = phoneNumber.countryCallingCode;
      // The number is just the digits. For non-US, leading 0 is removed
      smsNumber = phoneNumber.nationalNumber;
    }

    this.setState({ working: true });
    // https://www.electronjs.org/docs/api/ipc-renderer#ipcrendererinvokechannel-args
    const results = await window.electron.ipcRenderer.sendEnvelope(
      // eslint-disable-next-line react/no-access-state-in-setstate
      this.state.baseUri,
      // eslint-disable-next-line react/no-access-state-in-setstate
      this.state.accountId,
      // eslint-disable-next-line react/no-access-state-in-setstate
      this.state.accessToken,
      documentFileName,
      documentName,
      documentExtension,
      emailSubject,
      // eslint-disable-next-line react/no-access-state-in-setstate
      this.state.formEmail,
      // eslint-disable-next-line react/no-access-state-in-setstate
      this.state.formName,
      smsCountryCode,
      smsNumber
    );
    const { apiRequestsReset } = results;
    const responseApiRequestsReset = apiRequestsReset
      ? new Date(apiRequestsReset)
      : undefined;
    this.setState({
      working: false,
      responseSuccess: results.success,
      responseErrorMsg: results.errorMsg,
      responseEnvelopeId: results.envelopeId,
      responseAvailableApiRequests: results.availableApiRequests,
      responseTraceId: results.traceId,
      responseApiRequestsReset,
    });
  }

  // Page definitions...

  // eslint-disable-next-line class-methods-use-this
  Form() {
    const resetTime = this.state.responseApiRequestsReset;
    const resetTimeString = resetTime
      ? new Intl.DateTimeFormat('en-US', {
          dateStyle: 'medium', // This is OK! Types out of date?
          timeStyle: 'full',
        }).format(resetTime)
      : undefined;
    let responseSuccess = null;
    if (this.state.responseSuccess !== undefined) {
      responseSuccess = this.state.responseSuccess ? (
        <>✅ Success!</>
      ) : (
        <>❌ Problem!</>
      );
    }
    const sendEnvelopeButton = this.state.working ? (
      <button type="button" disabled>
        Sending envelope
      </button>
    ) : (
      <button type="button" onClick={this.sendEnvelope}>
        Send Envelope
      </button>
    );

    return (
      <section className="reg">
        <h1>Send an Envelope with SMS Delivery</h1>
        <p>The envelope’s PDF is sent with responsive signing enabled.</p>
        <form>
          <label>
            Name:
            <input
              type="text"
              value={this.state.formName}
              onChange={this.formNameChange}
            />
          </label>
          <label>
            Email:
            <input
              type="text"
              value={this.state.formEmail}
              onChange={this.formEmailChange}
            />
          </label>
          <label>
            SMS:
            <PhoneInput
              flags={flags}
              placeholder="Enter SMS number"
              value={this.state.formPhoneNumber}
              onChange={this.formPhoneNumberChange}
              defaultCountry={this.state.defaultCountry}
            />
          </label>
        </form>
        <div>{sendEnvelopeButton}</div>
        <h1>Results</h1>
        <h1>{responseSuccess}</h1>
        {this.state.responseErrorMsg ? (
          <p>Error message: {this.state.responseErrorMsg}</p>
        ) : null}
        {this.state.responseEnvelopeId ? (
          <p>Envelope ID: {this.state.responseEnvelopeId}</p>
        ) : null}
        {this.state.responseAvailableApiRequests ? (
          <p>
            Available API requests: {this.state.responseAvailableApiRequests}
          </p>
        ) : null}
        {resetTimeString ? (
          <p>API requests reset time: {resetTimeString}</p>
        ) : null}
        {this.state.responseTraceId ? (
          <p>
            Trace ID: {this.state.responseTraceId}. Please include with all
            customer service questions.
          </p>
        ) : null}
      </section>
    );
  }

  // eslint-disable-next-line class-methods-use-this
  UserInformationBlock() {
    let block;
    if (this.state.accessToken) {
      block = (
        <div className="accountInfo">
          <p>
            {this.state.name}
            <span
              style={{ marginLeft: '2em' }}
              className="a"
              onClick={this.logout}
              role="button"
              tabIndex={0}
              onKeyPress={this.logout}
            >
              logout
            </span>
          </p>
          <p>
            {this.state.accountName} ({this.state.externalAccountId})
          </p>
        </div>
      );
    } else {
      block = null;
    }
    return block;
  }

  render() {
    // We want to be able to change the page from anywhere in this component.
    // Since it is a class component, we can't use |useHistory| -- it is only
    // for functional components.
    //
    // So we use the |withRouter| HOC (see bottom of the file).
    // But it only works from components *within* a Router component.
    // So to fix that, this component, <App>, is wrapped by a Router
    // component in the index.tsx file. And it works.
    return (
      <>
        <section id="topNav">
          <ToastContainer />
          <this.UserInformationBlock />
          <div
            id="feedback"
            style={{ display: this.state.working ? 'block' : 'none' }}
          >
            <div className="spinner" />
            <p>Sending the envelope…</p>
          </div>
        </section>
        <section>
          {/*
            A <Switch> looks through all its children <Route>
            elements and renders the first one whose path
            matches the current URL. Use a <Switch> any time
            you have multiple routes, but you want only one
            of them to render at a time
          */}
          <Switch>
            <Route exact path="/">
              <Home startAuthentication={this.startAuthentication} />
            </Route>
            <Route path="/loggingIn">
              <LoggingIn cancelAuthentication={this.cancelAuthentication} />
            </Route>
            <Route path="/form">
              <this.Form />
            </Route>
          </Switch>
        </section>
      </>
    );
  }
}

export default withRouter(App);
