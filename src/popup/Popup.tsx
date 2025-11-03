import { useState } from "react";
import "../styles/Popup.css";

export default function Popup() {
    const [dark, setDark] = useState(false);

    const toggleDarkMode = () => {
        //pestaña actual
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            //verif pestaña tiene un id valido (por seguridad)
            if (!tab?.id) return;
            //envia mensaje a content.ts

            console.log("enviando msj a content");

            chrome.tabs.sendMessage(tab.id, { action: "toggle-darkmode" });
            console.log("mensaje enviado");

            //actualiza dark, si estaba en uno, cambia al otro
            setDark((prev) => !prev);
        });
    };

    return (
        <div>
            <h3>Better CUV</h3>
            <button onClick={toggleDarkMode}>
                {dark ? "☀️ Modo claro" : "🌙 Modo oscuro"}
            </button>
        </div>
    );
}
