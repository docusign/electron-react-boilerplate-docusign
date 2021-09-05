/* eslint-disable prefer-destructuring */
/**
 * DocuSign and related operations.
 */
import { app as electronApp } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import fetch from 'node-fetch';

type SendEnvelopeResults = {
  success: boolean;
  errorMsg: string | undefined;
  envelopeId: string | undefined;
  availableApiRequests: number | undefined;
  apiRequestsReset: Date | undefined;
  traceId: string | undefined;
};

const sdkString = 'electron1';
const urlFrag = '/restapi/v2.1'; // DocuSign specific

/**
 * Asset files
 * Add assets (eg PDF files) to the top level assets directory.
 * (NOT under /src.) They will be included with the packaged app.
 *
 * The assets directory relative to the appPath variable varies:
 * Windows development
 * appPath:  Z:\www\windows\docusign-electron-react\src\main
 * asset files: APP_PATH/../../assets
 *
 * Windows packaged
 * appPath: C:\Users\your.name\AppData\Local\Programs\electron-react-boilerplate\resources\app.asar
 * asset files: APP_PATH/../assets
 *
 * Mac development
 * appPath: /Users/your.name/www/docusign-electron-react/src/main
 * asset files: APP_PATH/../../assets
 *
 * Mac packaged
 * appPath:  App path: /Applications/ElectronReact.app/Contents/Resources/app.asar
 * asset files: APP_PATH/../assets
 *
 */

/**
 * Send an envelope, return results or error
 */
const sendEnvelope = async (
  baseUri: string,
  accountId: string,
  accessToken: string,
  documentFileName: string,
  documentName: string,
  documentExtension: string,
  emailSubject: string,
  signer1Email: string,
  signer1Name: string,
  signer1SmsCountryCode: string,
  signer1SmsNumber: string
): Promise<SendEnvelopeResults> => {
  const appPath = electronApp.getAppPath();

  let result: SendEnvelopeResults;

  const pathOptions = ['..', '../..'];
  let docPath = '.';
  let foundFile;
  // eslint-disable-next-line no-restricted-syntax
  for (const pathOption of pathOptions) {
    docPath = path.join(appPath, pathOption, 'assets', documentFileName);
    try {
      // eslint-disable-next-line no-await-in-loop
      foundFile = (await fs.access(docPath)) === undefined;
      if (foundFile) {
        break;
      }
    } catch {
      foundFile = false;
    }
  }
  if (!foundFile) {
    result = {
      success: false,
      errorMsg: `Could not locate document file. [appPath: ${appPath}]`,
      envelopeId: undefined,
      availableApiRequests: undefined,
      apiRequestsReset: undefined,
      traceId: undefined,
    };
    return result; // EARLY return
  }

  const docContents: string = await fs.readFile(docPath, {
    encoding: 'base64',
  });
  const envelopeRequest = {
    emailSubject,
    status: 'sent',
    recipients: {
      signers: [
        {
          email: signer1Email,
          name: signer1Name,
          additionalNotifications: [
            {
              secondaryDeliveryMethod: 'SMS',
              phoneNumber: {
                countryCode: signer1SmsCountryCode,
                number: signer1SmsNumber,
              },
            },
          ],
          recipientId: '1',
          tabs: {
            signHereTabs: [
              {
                anchorString: '/sn1/',
                anchorXOffset: '20',
                anchorUnits: 'pixels',
              },
            ],
          },
        },
      ],
    },
    documents: [
      {
        name: documentName,
        fileExtension: documentExtension,
        documentId: '1',
        documentBase64: docContents,
        htmlDefinition: {
          source: 'document',
        },
      },
    ],
  };

  try {
    const url = `${baseUri}${urlFrag}/accounts/${accountId}/envelopes`;
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(envelopeRequest),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: `application/json`,
        'Content-Type': 'application/json',
        'X-DocuSign-SDK': sdkString,
      },
    });
    const data = response && response.ok && (await response.json());
    const headers = response.headers;
    const availableApiReqHeader = headers.get('X-RateLimit-Remaining');
    const availableApiRequests = availableApiReqHeader
      ? parseInt(availableApiReqHeader, 10)
      : undefined;
    const apiResetHeader = headers.get('X-RateLimit-Reset');
    const apiRequestsReset = apiResetHeader
      ? new Date(parseInt(apiResetHeader, 10) * 1000)
      : undefined;
    const traceId = headers.get('X-DocuSign-TraceToken') || undefined;
    if (response.ok) {
      result = {
        success: true,
        errorMsg: undefined,
        envelopeId: data.envelopeId,
        availableApiRequests,
        apiRequestsReset,
        traceId,
      };
    } else {
      result = {
        success: false,
        errorMsg: response && (await response.text()),
        envelopeId: undefined,
        availableApiRequests,
        apiRequestsReset,
        traceId,
      };
    }
    return result;
  } catch (e) {
    // Unfortunately we don't have access to the real
    // networking problem!
    // See https://medium.com/to-err-is-aaron/detect-network-failures-when-using-fetch-40a53d56e36
    const errorMsg =
      e.message === 'Failed to fetch'
        ? 'Networking error—check your Internet and DNS connections'
        : e.message;
    return {
      success: false,
      errorMsg,
      envelopeId: undefined,
      availableApiRequests: undefined,
      apiRequestsReset: undefined,
      traceId: undefined,
    };
  }
};

export default sendEnvelope;
