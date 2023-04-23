import axios from "axios";
import { config } from "process";
import { parse } from "yaml";
import { getFs, kDefaultSettings } from "~utils";
import { InputController } from "./controller";
import { serviceWorkerKeepalive } from "./keepalive";


self.controller = new InputController();
chrome.storage.sync.get(["settings"]).then((obj) => {
    // Only load engine if settings exists
    if (obj.settings) {
        // Load engine (no need to wait for it to complete)
        self.controller.loadRime(false);
    }
})

chrome.input.ime.onActivate.addListener(async (engineId, screen) => {
    self.controller.engineId = engineId;
    serviceWorkerKeepalive();
});

chrome.input.ime.onDeactivated.addListener((engineId) => { });

chrome.input.ime.onFocus.addListener(async (context) => {
    // Todo: in incoginto tab, context.shouldDoLearning = false, 
    // we should disable rime learning in such context
    console.log("Got focus event, context = ", context);
    self.controller.context = context;
});

chrome.input.ime.onBlur.addListener((ctxId) => {
    if (self.controller.context?.contextID == ctxId) {
        self.controller.clearContext();
    }
});

chrome.input.ime.onKeyEvent.addListener((engineID: string, keyData: chrome.input.ime.KeyboardEvent, requestId: string) => {
    console.log("Processing key: ", JSON.stringify(keyData));
    const result = self.controller.feedKey(keyData);
    if (result === false || result === true) {
        return result;
    } else {
        result.then((handled) => chrome.input.ime.keyEventHandled(requestId, handled));
        return undefined;
    }
});

chrome.input.ime.onCandidateClicked.addListener((engineId, candidateId, button) => {
    console.log(candidateId, button);
    if (button == 'left') {
        self.controller.selectCandidate(candidateId);
        self.controller.lastRightClickItem = -1;
    } else if (button == 'right') {
        self.controller.rightClick(candidateId);
    }
});

chrome.runtime.onMessage.addListener((m, s, resp) => {
    if (m.name)
        return;
    console.log("BG Received message: ", m);
});

chrome.runtime.onInstalled.addListener(async (d) => {
    if (d.reason == chrome.runtime.OnInstalledReason.INSTALL) {
        await chrome.storage.sync.set({ settings: kDefaultSettings });
        const fileList = ["aurora_pinyin.prism.bin", "aurora_pinyin.reverse.bin", "aurora_pinyin.table.bin", "aurora_pinyin.schema.yaml"];
        const fs = await getFs();
        for (const f of fileList) {
            const resp = await fetch(`/assets/builtin/${f}`);
            const buf = await resp.arrayBuffer();
            await fs.writeWholeFile(`/root/build/${f}`, new Uint8Array(buf));
        }
        await chrome.storage.local.set({ schemaList: parse(await (await fetch("/assets/builtin/schema-list.yaml")).text()) });
        await self.controller.loadRime(true);
    }
})

export { }