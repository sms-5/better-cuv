type Settings = {
    dark: boolean;
    keepalive: boolean;
};

const DEFAULTS: Settings = { dark: true, keepalive: true };
const KEY = "settings";
const TOUCH_INTERVAL = 10 * 60 * 1000;

let settings = DEFAULTS;
let sesskey: string | undefined;
let timer: number | undefined;

const isLoggedIn = () => document.body?.classList.contains("loggedin") ?? false;

const apply = () => {
    document.documentElement.classList.toggle("bettercuv-dark", settings.dark);
};

const readSesskey = () => {
    for (const script of document.scripts) {
        const match = script.textContent?.match(/"sesskey":"([^"]+)"/);
        if (match) return match[1];
    }
    return undefined;
};

const touch = async () => {
    if (!sesskey) return;

    try {
        const response = await fetch(
            `${location.origin}/lib/ajax/service.php?sesskey=${encodeURIComponent(sesskey)}&info=core_session_touch`,
            {
                method: "POST",
                credentials: "same-origin",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify([
                    { index: 0, methodname: "core_session_touch", args: {} },
                ]),
            }
        );
        const result = (await response.json()) as Array<{ data?: boolean }>;
        if (response.ok && result[0]?.data === true) {
            await chrome.storage.local.set({ lastTouch: Date.now() });
        }
    } catch {
        // Si la sesión expiró, el próximo ciclo vuelve a intentar.
    }
};

const syncKeepalive = () => {
    clearInterval(timer);
    timer = undefined;

    if (!settings.keepalive || window.top !== window || !isLoggedIn()) return;

    sesskey ??= readSesskey();
    if (!sesskey) return;

    timer = window.setInterval(touch, TOUCH_INTERVAL);
};

const load = (value?: Partial<Settings>) => {
    settings = { ...DEFAULTS, ...value };
    apply();
    syncKeepalive();
};

chrome.storage.sync.get(KEY, (data) => {
    load(data[KEY] as Partial<Settings> | undefined);
});

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes[KEY]) {
        load(changes[KEY].newValue as Partial<Settings> | undefined);
    }
});

const onReady = () => {
    sesskey = readSesskey();
    syncKeepalive();
};

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onReady);
} else {
    onReady();
}
