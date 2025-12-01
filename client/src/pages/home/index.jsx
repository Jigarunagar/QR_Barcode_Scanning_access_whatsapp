import React, { useEffect, useState, useRef } from "react";
import axios from "axios";

function HomePage() {
  const [qr, setQr] = useState("");
  const [status, setStatus] = useState("Disconnected");
  const [number, setNumber] = useState("");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState(null);
  const [messages, setMessages] = useState([]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const savedStatus = localStorage.getItem("wa_status");
    if (savedStatus) {
      setStatus(savedStatus);
    }

    const events = new EventSource("http://localhost:3000/status");

    events.onmessage = (e) => {

      if (e.data === "connected") {
        setStatus("Connected");
        localStorage.setItem("wa_status", "Connected");
        setQr("");
      }

      else if (e.data === "qr") {
        setStatus("Disconnected");
        localStorage.removeItem("wa_status");
        fetchQr();
      }

      else {
        const msg = JSON.parse(e.data);
        setMessages((prev) => [...prev, msg]);
      }
    };

    if (!savedStatus || savedStatus !== "Connected") {
      fetchQr();
    }

    return () => events.close();
  }, []);

  const fetchQr = async () => {
    try {
      const res = await axios.get("http://localhost:3000/qr");
      const parser = new DOMParser();
      const htmlDoc = parser.parseFromString(res.data, "text/html");
      const img = htmlDoc.querySelector("img");
      if (img) setQr(img.src);
    } catch (err) {
      console.log(err);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();

    if (!number) return alert("Enter number!");

    const formData = new FormData();
    formData.append("number", number);
    formData.append("message", message);
    if (file) formData.append("file", file);

    try {
      const res = await axios.post("http://localhost:3000/send", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      alert(res.data);
      setMessage("");
      setFile(null);
    } catch (err) {
      alert(err.response?.data || err.message);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="wa-main">

      <div className="wa-sidebar">

        <div className="sidebar-header">
          <div className="profile-circle">U</div>
          <span className="sidebar-title">WhatsApp Web</span>
        </div>

        <div className={`status-box ${status === "Connected" ? "ok" : "not-ok"}`}>
          <strong>Status:</strong> {status}
        </div>

        {!status.includes("Connected") && qr && (
          <div className="qr-area">
            <p>Scan this QR to Login</p>
            <img src={qr} alt="qr" />
          </div>
        )}

        {status === "Connected" && (
          <div className="connected-box">
            <p>🔗 Device Connected!</p>
          </div>
        )}
      </div>

      <div className="wa-chat-area">

        <div className="chat-header">
          {status === "Connected" ? (
            <h3>Send Message</h3>
          ) : (
            <h3>Please scan QR to continue</h3>
          )}
        </div>

        <div className="chat-content">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`chat-bubble ${msg.type === "incoming" ? "incoming" : "outgoing"
                }`}
            >
              <span className="bubble-text">
                {msg.type === "incoming"
                  ? `From: ${msg.from}\n${msg.body}`
                  : `${msg.body}`}
              </span>
            </div>
          ))}
          <div ref={messagesEndRef}></div>
        </div>

        {status === "Connected" && (
          <form className="chat-input-box" onSubmit={handleSend}>
            <input
              type="text"
              placeholder="Enter number (with country code)"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              required
            />

            <textarea
              placeholder="Type your message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />

            <button type="submit">Send</button>
          </form>
        )}
      </div>
    </div>
  );

}

export default HomePage;
