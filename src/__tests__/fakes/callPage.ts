import { JSDOM } from 'jsdom';
import { setTimeout } from 'node:timers/promises';

import { getEl, makeNavigator } from './dom.ts';
import { fakeTransport } from './fakeRoom.ts';

/**
The page the Transport flows run on (create and copy buttons, both videos, the log),
with a fake navigator and a single fake Transport ready for `initApp`.
@param url page URL; a `#roomId` hash triggers auto-join
@returns the window and document to inject, plus the fakes to drive and inspect
*/
export function setupCallPage(url = 'https://example.com/') {
  const html = `<!doctype html><html><body>
  <button id="createBtn">Create Conference</button>
  <button id="copyBtn" disabled>Copy Link</button>
  <video id="localVideo"></video>
  <video id="remoteVideo"></video>
  <div id="logs"></div>
  </body></html>`;
  const { window } = new JSDOM(html, { url });
  const { room, joinRoom } = fakeTransport();
  return { window, document: window.document, navigator: makeNavigator(), room, joinRoom };
}

/**
The page Direct mode runs on: the call page plus the Direct panel.
@param url page URL; an `#offer=` or `#answer=` hash starts the matching flow
@returns a fresh JSDOM to inject into `initApp`
*/
export function makeDirectDom(url = 'https://example.com/'): JSDOM {
  const html = `<!doctype html><html><body>
    <button id="createBtn">Create Conference</button>
    <button id="copyBtn" disabled>Copy Link</button>
    <button id="directBtn">Can't connect?</button>
    <video id="localVideo"></video>
    <video id="remoteVideo"></video>
    <div id="logs"></div>
    <section id="directPanel" hidden>
      <p id="directStatus"></p>
      <canvas id="directQr"></canvas>
      <button id="directCopyBtn" disabled>Copy link</button>
      <input id="directAnswerInput" type="url">
      <button id="directConnectBtn" disabled>Connect</button>
    </section>
  </body></html>`;
  return new JSDOM(html, { url });
}

/**
Clicks a button and lets the async handlers it starts settle.
@param root the document holding the button
@param selector the button to click
@param ms how long the handlers need; 0 drains pending promises only
*/
export async function clickAndSettle(root: ParentNode, selector: string, ms = 0): Promise<void> {
  getEl<HTMLButtonElement>(root, selector).click();
  await setTimeout(ms);
}
