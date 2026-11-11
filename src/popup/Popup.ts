import "../styles/Popup.css";

type Settings = {
    dark: boolean;
    keepalive: boolean;
};

const DEFAULTS: Settings = { dark: true, keepalive: true };
const KEY = "settings";

const root = document.getElementById("root")!;
root.innerHTML = `
    <h1>Better SED</h1>
    <label class="row"><input type="checkbox" id="dark" /> Modo oscuro</label>
    <label class="row"><input type="checkbox" id="keepalive" /> Mantener sesión activa</label>
    <p class="status" id="status"></p>
`;

const dark = root.querySelector<HTMLInputElement>("#dark")!;
const keepalive = root.querySelector<HTMLInputElement>("#keepalive")!;
const status = root.querySelector<HTMLParagraphElement>("#status")!;

let settings = DEFAULTS;
let lastTouch = 0;

const formatAgo = (timestamp: number) => {
    const minutes = Math.floor((Date.now() - timestamp) / 60_000);
    if (minutes < 1) return "recién";
    if (minutes < 60) return `hace ${minutes} min`;
    return `hace ${Math.floor(minutes / 60)} h`;
};

const renderStatus = () => {
    if (!settings.keepalive) {
        status.textContent = "Keepalive apagado";
    } else if (lastTouch) {
        status.textContent = `Sesión activa · ${formatAgo(lastTouch)}`;
    } else {
        status.textContent = "Esperando el primer ping…";
    }
};

chrome.storage.sync.get(KEY, (data) => {
    settings = { ...DEFAULTS, ...(data[KEY] as Partial<Settings> | undefined) };
    dark.checked = settings.dark;
    keepalive.checked = settings.keepalive;
    renderStatus();
});

chrome.storage.local.get("lastTouch", (data) => {
    lastTouch = Number(data.lastTouch) || 0;
    renderStatus();
});

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.lastTouch) {
        lastTouch = Number(changes.lastTouch.newValue) || 0;
        renderStatus();
    }
});

const save = () => chrome.storage.sync.set({ [KEY]: settings });

dark.addEventListener("change", () => {
    settings = { ...settings, dark: dark.checked };
    save();
});

keepalive.addEventListener("change", () => {
    settings = { ...settings, keepalive: keepalive.checked };
    save();
    renderStatus();
});
