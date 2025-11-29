import React, { useEffect, useState } from "react";
import axios from "axios";

function HomePage() {
  const [qr, setQr] = useState("");
  const [status, setStatus] = useState("Disconnected");
  const [number, setNumber] = useState("");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState(null);

  // Fetch QR and listen to status
  useEffect(() => {
    const events = new EventSource("http://localhost:3000/status");
    events.onmessage = (e) => {
      if (e.data === "connected") {
        setStatus("Connected");
        setQr("");
      } else if (e.data === "qr") {
        setStatus("Disconnected");
        fetchQr();
      }
    };

    fetchQr();

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

  return (
    <div style={{ maxWidth: "500px", margin: "40px auto", textAlign: "center" }}>
      <h2>WhatsApp Web UI</h2>
      <h4>Status: {status}</h4>

      {!status.includes("Connected") && qr && (
        <div>
          <p>Scan QR to connect:</p>
          <img src={qr} alt="QR Code" width="250" />
        </div>
      )}

      {status === "Connected" && (
        <form onSubmit={handleSend} style={{ marginTop: "20px" }}>
          <input
            type="text"
            placeholder="Number (with country code)"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            required
            style={{ width: "100%", padding: "8px", marginBottom: "10px" }}
          />
          <textarea
            placeholder="Message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            style={{ width: "100%", padding: "8px", marginBottom: "10px" }}
          />
          {/* <input
            type="file"
            accept="image/*,video/*"
            onChange={(e) => setFile(e.target.files[0])}
            style={{ marginBottom: "10px" }}
          /> */}
          <button type="submit" style={{ padding: "10px 20px" }}>
            Send
          </button>
        </form>
      )}
    </div>
  );
}

export default HomePage;
