/* eslint-disable promise/always-return */
/* eslint global-require: off, no-console: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `yarn build` or `yarn build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import 'core-js/stable';
import 'regenerator-runtime/runtime';
import path from 'path';
import { app, BrowserWindow, shell, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import fetch from 'node-fetch';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import { parseAppURL } from './docusign/parse-app-url';
import config from '../config';
import sendEnvelope from './docusign/DocuSign';

let mainWindow: BrowserWindow | null = null;

const { schemeName } = config;
const DARWIN = process.platform === 'darwin';
const WIN32 = process.platform === 'win32';
// const LINUX  = process.platform === 'linux';
/** Extra argument for the protocol launcher on Windows */
const protocolLauncherArg = '--protocol-launcher';
const possibleProtocols = [schemeName];
const DEBUGGING =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

export default class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

/**
 * Handle the url sent to this application
 * @param url the incoming url argument
 */
function handleAppURL(url: string) {
  const action = parseAppURL(url);
  // This manual focus call _shouldn't_ be necessary, but is for Chrome on
  // macOS. See https://github.com/desktop/desktop/issues/973.
  // log.info(`Sending action!\n${JSON.stringify(action, null, 4)}`);
  if (mainWindow) {
    mainWindow.focus();
    mainWindow.show();
    mainWindow.webContents.send('url-action', action);
  }
}

/**
 * Attempt to detect and handle any protocol handler arguments passed
 * either via the command line directly to the current process or through
 * IPC from a duplicate instance (see makeSingleInstance)
 *
 * @param args Essentially process.argv, i.e. the first element is the exec
 *             path
 */
function handlePossibleProtocolLauncherArgs(args: ReadonlyArray<string>) {
  // log.info(`Received possible protocol arguments: ${args.length}`);

  if (WIN32) {
    // Desktop registers its protocol handler callback on Windows as
    // `[executable path] --protocol-launcher "%1"`. Note that extra command
    // line arguments might be added by Chromium
    // (https://electronjs.org/docs/api/app#event-second-instance).
    // At launch Desktop checks for that exact scenario here before doing any
    // processing. If there's more than one matching url argument because of a
    // malformed or untrusted url then we bail out.
    //
    // During development, there might be more args.
    // Strategy: look for the arg that is protocolLauncherArg,
    // then use the next arg as the incoming URL

    // Debugging:
    // args.forEach((v, i) => log.info(`argv[${i}] ${v}`));

    // find the argv index for protocolLauncherArg
    const flagI: number = args.findIndex((v) => v === protocolLauncherArg);
    if (flagI === -1) {
      // log.error(`Ignoring unexpected launch arguments: ${args}`);
      return;
    }
    // find the arg that starts with one of our desired protocols
    const url: string | undefined = args.find((arg) => {
      // eslint-disable-next-line no-plusplus
      for (let index = 0; index < possibleProtocols.length; index++) {
        const proto = possibleProtocols[index];
        if (proto && arg.indexOf(proto) === 0) {
          return true;
        }
      }
      return false;
    });
    if (url === undefined) {
      log.error(
        `No url in args even though flag was present! ${args.join('; ')}`
      );
      return;
    }
    handleAppURL(url);
    // End of WIN32 case
  } else if (args.length > 1) {
    // Mac or linux case
    handleAppURL(args[1]);
  }
}

/**
 * Wrapper around app.setAsDefaultProtocolClient that adds our
 * custom prefix command line switches on Windows.
 */
function setAsDefaultProtocolClient(proto: string | undefined) {
  if (!proto) {
    return;
  }
  if (WIN32 && DEBUGGING) {
    // Special handling on Windows while developing.
    // See https://stackoverflow.com/a/53786254/64904
    // remove so we can register each time as we run the app.
    app.removeAsDefaultProtocolClient(proto);
    // Set the path of electron.exe and files
    // The following works for Electron v11.
    // Use the following console script to see the argv contents
    // process.argv.forEach((v, i)=> log.info(`argv[${i}] ${v}`));
    app.setAsDefaultProtocolClient(proto, process.execPath, [
      process.argv[1], // -r
      path.resolve(process.argv[2]), // ./.erb/scripts/BabelRegister
      path.resolve(process.argv[3]), // ./src/main.dev.ts
      protocolLauncherArg,
    ]);
  } else if (WIN32) {
    app.removeAsDefaultProtocolClient(proto);
    app.setAsDefaultProtocolClient(proto, process.execPath, [
      protocolLauncherArg,
    ]);
  } else {
    app.removeAsDefaultProtocolClient(proto);
    app.setAsDefaultProtocolClient(proto);
  }
}

// Use a geoIP service to look up our location so we can give a good default
// country for entering a telephone number.
//
// A blog post on IP geolocation APIs:
// https://rapidapi.com/blog/ip-geolocation-api/
//
// We're using https://ipwhois.io/documentation
// Note their terms: https://ipwhois.io/terms
// A paid license is required for commercial use.
// eg GET http://ipwhois.app/json/?objects=country_phone
// returns: {"country_phone":"+972"}
const getCountryCode = () => {
  const geoIpUrl = 'http://ipwhois.app/json/?objects=country_code';
  const geoIpCountryCodeChannel = 'geoIpCountryCode';
  let geoIpCountryCode = '';
  fetch(geoIpUrl)
    .then((response) => response.json())
    .then((data) => {
      geoIpCountryCode = data.country_code;
      if (mainWindow) {
        mainWindow.webContents.send(geoIpCountryCodeChannel, geoIpCountryCode);
      }
    })
    .catch((e) => {
      // Internet problem. The user will see a browser error message when they
      // try to login
      if (DEBUGGING) {
        log.error(`Error while getting country code: ${e}`);
      }
    });
};

ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
});

// https://www.electronjs.org/docs/api/ipc-renderer#ipcrendererinvokechannel-args
ipcMain.handle('sendEnvelope', async (event, ...args) => {
  const result = await sendEnvelope(...args)
  return result;
});

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDevelopment =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDevelopment) {
  require('electron-debug')();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload
    )
    .catch(console.log);
};

const createWindow = async () => {
  if (
    process.env.NODE_ENV === 'development' ||
    process.env.DEBUG_PROD === 'true'
  ) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 728,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      webSecurity: false, // false: turns off CORS requirements
      preload: path.join(__dirname, 'preload.js'),
      // See https://stackoverflow.com/a/55776662/64904
      nodeIntegration: false, // <--- flag
      nodeIntegrationInWorker: false, // <---  for web workers
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  // @TODO: Use 'ready-to-show' event
  //        https://github.com/electron/electron/blob/main/docs/api/browser-window.md#using-ready-to-show-event
  mainWindow.webContents.on('did-finish-load', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
    getCountryCode();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.on('new-window', (event, url) => {
    event.preventDefault();
    shell.openExternal(url);
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

// Are we a duplicate?
const gotSingleInstanceLock = app.requestSingleInstanceLock();
const isDuplicateInstance = !gotSingleInstanceLock;
// Hari-kari if we're a clone
if (isDuplicateInstance) {
  app.quit();
}

// Electron sends the second-instance event
// https://www.electronjs.org/docs/api/app#event-second-instance
app.on('second-instance', (_event, args) => {
  // Someone tried to run a second instance, we should focus our window.
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }

    mainWindow.focus();
  }

  handlePossibleProtocolLauncherArgs(args);
});

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.whenReady().then(createWindow).catch(console.log);

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) createWindow();
});

if (DARWIN) {
  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleAppURL(url);
  });
} else if (WIN32 && process.argv.length > 1) {
  handlePossibleProtocolLauncherArgs(process.argv);
}

app.on('ready', () => {
  possibleProtocols.forEach((p) => setAsDefaultProtocolClient(p));
});
