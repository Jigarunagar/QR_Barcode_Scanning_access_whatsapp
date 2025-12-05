const express = require("express");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const app = express();
const upload = multer({ dest: "uploads/" });
app.use(cors());
app.use(express.json());
const PORT = 3000;


let client = null;
let isReady = false;
let qrCodeString = "";
let clients = [];


function sendStatus(msg) {
    clients.forEach((res) => res.write(`data: ${msg}\n\n`));
}

function createClient() {
    console.log("Creating WhatsApp Client...");
    client = new Client({
        authStrategy: new LocalAuth({ clientId: "client-main" }),
        puppeteer: { headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"], },
    });
    client.on("qr", async (qr) => {
        isReady = false; qrCodeString = await qrcode.toDataURL(qr);
        sendStatus("qr"); console.log("New QR Generated!");
    });
    client.on("ready", () => {
        isReady = true; qrCodeString = "";
        // GET USER INFO const
        myName = client.info.pushname || "Unknown User";
        // SEND DATA TO FRONTEND
        sendStatus(JSON.stringify({ type: "user-info", name: myName, }));
        sendStatus("connected");
        console.log("Connected as:", myName, myNumber);
    });
    client.on("authenticated", () => console.log("Authenticated!"));
    client.on("auth_failure", () => {
        console.log("Authentication failed! Regenerating client...");
        safeRegenerateClient();
    });
    client.on("disconnected", (reason) => {
        console.log("Phone Disconnected:", reason);
        isReady = false;
        qrCodeString = "";
        sendStatus("qr");
        safeRegenerateClient();
    });
    client.on("message", (msg) => {
        sendStatus(JSON.stringify({ type: "incoming", from: msg.from, body: msg.body }));
    });
    client.initialize();
}

let regenerating = false;

function safeRegenerateClient() {
    if (regenerating) return;
    regenerating = true;
    console.log("Reinitializing WhatsApp client...");
    if (client) {
        try {
            client.destroy();
        } catch (err) {
            console.log("Error destroying client:", err.message);
        }
        client = null;
    } setTimeout(() => {
        createClient();
        regenerating = false;
    }, 5000);
}


app.get("/status", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders(); clients.push(res);
    req.on("close", () => {
        clients = clients.filter((c) => c !== res);
    });
});

app.get("/qr", (req, res) => {
    res.send(`
        <div style="text-align:center; margin-top:40px;">
            <h2>WhatsApp Status</h2>
            <div id="qrContainer">
                ${!isReady && qrCodeString ? `<img src="${qrCodeString}" width="250"/>` : ""}
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

app.post("/send", upload.single("file"), async (req, res) => {
    if (!isReady) return res.status(400).send("WhatsApp not connected!");
    const { number, message, type, quotedId } = req.body;
    const finalNumber = number.includes("@c.us") ? number : number + "@c.us";
    const filePath = req.file ? req.file.path : null;
    try {
        let msgObj;
        // Sending media or text
        if (filePath) {
            const media = MessageMedia.fromFilePath(filePath);
            msgObj = await client.sendMessage(finalNumber, media, { caption: message });
        } else {
            if (quotedId) {
                const quotedMsg = await client.getMessageById(quotedId);
                msgObj = await quotedMsg.reply(message);
            } else {
                msgObj = await client.sendMessage(finalNumber, message);
            }
        } sendStatus(JSON.stringify({ type: "outgoing", to: finalNumber, body: message, media: !!filePath, id: msgObj.id._serialized }));
        res.send("Message Sent!");
    } catch (err) {
        res.status(500).send("Failed: " + err.message);

    } finally {
        if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
});


app.get("/contacts", async (req, res) => {
    if (!isReady) return res.status(400).send("WhatsApp not connected!");
    try {
        const chats = await client.getChats();
        const contacts = chats.filter(chat => chat.isGroup === false).map(c => ({ name: c.name || c.contact.pushname || c.contact.number || "Unknown", number: c.id.user + "@c.us" }));
        res.json(contacts);
    } catch (err) {
        res.status(500).send(err.message);
    }
});
app.get("/logout", async (req, res) => {
    try {
        isReady = false; qrCodeString = "";
        if (client) client.destroy();
        client = null;
        safeRegenerateClient();
        res.send("Logged out! QR regenerating...");
    } catch (err) {
        res.status(500).send("Error: " + err.message);

    }
});


app.listen(PORT, () => {
    console.log(`Server running: http://localhost:${PORT}`);
    console.log(`Open QR page: http://localhost:${PORT}/qr`);
});

createClient();
 