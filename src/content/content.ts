console.log("Better CUV content script loaded ✅");

// escucha mensajes desde el popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    console.log("escuchando...");

    if (message.action === "toggle-darkmode") {
        console.log("msj de toggle-darkmode recibido");

        document.body.classList.toggle("bettercuv-dark"); //al body le agrega la clase "bettercuv-dark"
        sendResponse({ status: "ok" });
    }
});
