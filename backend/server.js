const express = require("express");

const { Client, LocalAuth } = require("whatsapp-web.js");
LocalAuth.prototype.logout = () => Promise.resolve();

const qrcode = require("qrcode");

const app = express();
app.use(express.json());

const PORT = 3000;

let qrCodeString = "";
let isReady = false;
let clients = [];
let client = null;

function createClient() {
    console.log("Creating WhatsApp Client...");

    client = new Client({
        authStrategy: new LocalAuth({ clientId: "client-main" }),
        puppeteer: {
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox"]
        }
    });

    client.on("qr", async (qr) => {
        if (!isReady) {
            qrCodeString = await qrcode.toDataURL(qr);
            sendStatus("qr");
            console.log("New QR Generated!");
        }
    });

    client.on("ready", () => {
        isReady = true;
        qrCodeString = "";
        sendStatus("connected");
        console.log("WhatsApp Connected!");
    });

    client.on("authenticated", () => console.log("Authenticated!"));

    client.on("auth_failure", () => {
        console.log("Authentication failed!");
        regenerateClient();
    });

    client.on("disconnected", (reason) => {
        console.log("Phone Disconnected:", reason);

        isReady = false;
        qrCodeString = "";
        sendStatus("qr");

        regenerateClient(); 
    });

    client.initialize();
}

function regenerateClient() {
    console.log("Reinitializing WhatsApp client...");

    try {
        if (client) client.destroy(); 
    } catch {}

    client = null;

    setTimeout(() => {
        createClient();
    }, 800); 
}

createClient();

function sendStatus(msg) {
    clients.forEach((res) => res.write(`data: ${msg}\n\n`));
}

app.get("/status", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    clients.push(res);

    req.on("close", () => {
        clients = clients.filter(c => c !== res);
    });
});

app.get("/qr", (req, res) => {
    res.send(`
        <div style="text-align:center; margin-top:40px;">
            <h2>WhatsApp Status</h2>
            <div id="qrContainer">
                ${!isReady && qrCodeString ? `<img src="${qrCodeString}" width="250" />` : ""}
            </div>
            <h3 id="statusText">${isReady ? "Connected!" : "Disconnected"}</h3>

            <script>
                const events = new EventSource("/status");
                events.onmessage = function(e) {
                    const qrContainer = document.getElementById("qrContainer");
                    const statusText = document.getElementById("statusText");

                    if (e.data === "connected") {
                        qrContainer.innerHTML = "";
                        statusText.innerText = "Connected!";
                    } else if (e.data === "qr") {
                        location.reload();
                    }
                };
            </script>
        </div>
    `);
});

app.post("/send", async (req, res) => {
    if (!isReady) return res.send("WhatsApp not connected!");

    const { number, message } = req.body;
    const finalNumber = number.includes("@c.us") ? number : number + "@c.us";

    try {
        await client.sendMessage(finalNumber, message);
        res.send("Message Sent!");
    } catch (e) {
        res.send("Failed: " + e.message);
    }
});

app.get("/logout", async (req, res) => {
    try {
        isReady = false;
        qrCodeString = "";

        if (client) client.destroy();

        client = null;

        setTimeout(() => {
            createClient();
        }, 800);

        res.send("Logged out! QR regenerating...");
    } catch (err) {
        res.send("Error: " + err.message);
    }
});

app.listen(PORT, () => {
    console.log(`Server running: http://localhost:${PORT}`);
    console.log(`Open QR: http://localhost:${PORT}/qr`);
});
