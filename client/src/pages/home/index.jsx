import React, { useEffect, useState, useRef } from "react";
import { HiOutlineUserCircle } from "react-icons/hi2";
import axios from "axios";

function HomePage() {
  const [qr, setQr] = useState("");
  const [status, setStatus] = useState("Disconnected");
  const [number, setNumber] = useState("");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState(null);
  const [messages, setMessages] = useState([]);
  const messagesEndRef = useRef(null);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    // Load saved username on page load
    const savedName = localStorage.getItem("wa_userName");
    if (savedName) setUserName(savedName);

    // Load status
    const savedStatus = localStorage.getItem("wa_status");
    if (savedStatus) setStatus(savedStatus);

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
        try {
          const msg = JSON.parse(e.data);

          // SAVE username when received from backend
          if (msg.type === "user-info") {
            setUserName(msg.name);
            localStorage.setItem("wa_userName", msg.name);  // STORE NAME
            return;
          }

          setMessages((prev) => [...prev, msg]);

        } catch (err) { }
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

  const handleReply = async (msgId) => {
    const replyText = prompt("Enter reply message:");
    if (!replyText) return;

    await axios.post("http://localhost:3000/reply", {
      quotedId: msgId,
      message: replyText,
    });
  };

  const handleForward = async (msgId) => {
    const number = prompt("Enter recipient number:");
    if (!number) return;

    await axios.post("http://localhost:3000/forward", {
      messageId: msgId,
      number,
    });
  };

  const handleDelete = async (msgId) => {
    const everyone = window.confirm("Delete for everyone?");
    await axios.post("http://localhost:3000/delete", {
      messageId: msgId,
      everyone,
    });
  };

  const handleReact = async (msgId) => {
    const emoji = prompt("Enter emoji to react:");
    await axios.post("http://localhost:3000/react", { messageId: msgId, emoji });
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="wa-main">

      <div className="wa-sidebar">
        <div className="sidebar-header">
          <div className="profile-circle">W</div>
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
            <h3><HiOutlineUserCircle />{userName}</h3>
          ) : (
            <h3>Please scan QR to continue</h3>
          )}
        </div>

        <div className="chat-content">
          {status !== "Connected" && qr && messages.length === 0 && (
            <div className="chat-default-image">
              <img src="/img.jpg" alt="Welcome" />
              <p>Scan QR to start messaging</p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`chat-bubble ${msg.type === "incoming" ? "incoming" : "outgoing"}`}
            >
              <span className="bubble-text">
                {msg.type === "incoming" ? `From: ${msg.from}\n${msg.body}` : msg.body}
              </span>

              {status === "Connected" && (
                <div className="bubble-actions">
                  <button onClick={() => handleReply(msg.id)}>Reply</button>
                  <button onClick={() => handleForward(msg.id)}>Forward</button>
                  <button onClick={() => handleDelete(msg.id)}>Delete</button>
                  <button onClick={() => handleReact(msg.id)}>React</button>
                </div>
              )}
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
