
import React, { useEffect, useState, useRef } from "react";
import { HiOutlineUserCircle } from "react-icons/hi2";
import axios from "axios";
import CryptoJS from "crypto-js";
import { IoCallOutline } from "react-icons/io5";
import { IoVideocamOutline } from "react-icons/io5";
import { FiSearch } from "react-icons/fi";



function HomePage() {
  const [qr, setQr] = useState("");
  const [status, setStatus] = useState("Disconnected");
  const [number, setNumber] = useState("");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState(null);
  const [messages, setMessages] = useState([]);
  const [userName, setUserName] = useState("");
  const [contacts, setContacts] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [chatHistory, setChatHistory] = useState({});
  const [searchTerm, setSearchTerm] = useState("");

  const messagesEndRef = useRef(null);


  useEffect(() => {
    const savedContacts = getContactsFromLocal();
    if (savedContacts.length > 0) setContacts(savedContacts);

    const savedName = localStorage.getItem("wa_userName");
    if (savedName) setUserName(savedName);

    const savedStatus = localStorage.getItem("wa_status");
    if (savedStatus) setStatus(savedStatus);

    const events = new EventSource("http://localhost:3000/status");

    events.onmessage = (e) => {
      if (e.data === "connected") {
        setStatus("Connected");
        localStorage.setItem("wa_status", "Connected");
        setQr("");
        loadContacts(); // Load contacts on connect
      } else if (e.data === "qr") {
        setStatus("Disconnected");
        localStorage.removeItem("wa_status");
        localStorage.removeItem("wa_contacts");
        localStorage.removeItem("wa_chatHistory");
        localStorage.removeItem("wa_selectedChat");
        localStorage.removeItem("wa_userName");
        fetchQr();
      } else {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "user-info") {
            setUserName(msg.name);
            localStorage.setItem("wa_userName", msg.name);
            return;
          }
          setMessages((prev) => [...prev, msg]);
          saveIncomingMessage(msg);
        } catch (err) { }
      }
    };

    if (!savedStatus || savedStatus !== "Connected") {
      fetchQr();
    }

    return () => events.close();
  }, []);

  const saveIncomingMessage = (msg) => {
    const clean = msg.from.replace("@c.us", "").replace("@s.whatsapp.net", "");

    setChatHistory(prev => {
      const updated = {
        ...prev,
        [clean]: [...(prev[clean] || []), msg]
      };
      saveChatHistoryToLocal(updated);
      return updated;
    });
  };


  const saveOutgoingMessage = (to, body) => {
    const clean = to.replace("@c.us", "").replace("@s.whatsapp.net", "");

    setChatHistory(prev => {
      const updated = {
        ...prev,
        [clean]: [
          ...(prev[clean] || []),
          { type: "outgoing", body, to }
        ]
      };
      saveChatHistoryToLocal(updated);
      return updated;
    });
  };

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
      saveOutgoingMessage(number, message);
      setMessage("");
      setFile(null);
    } catch (err) {
      alert(err.response?.data || err.message);
    }
  };

  const loadContacts = async () => {
    try {
      const res = await axios.get("http://localhost:3000/contacts");

      const cleanedContacts = res.data.map(c => ({
        ...c,
        number: c.number.replace("@c.us", "").replace("@s.whatsapp.net", "")
      }));

      setContacts(cleanedContacts);
      saveContactsToLocal(cleanedContacts);
    } catch (err) {
      console.log(err);
    }
  };

  const saveContactsToLocal = (contacts) => {
    const encrypted = CryptoJS.AES.encrypt(JSON.stringify(contacts), "my_key").toString();
    localStorage.setItem("wa_contacts", encrypted);
  };

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.number.includes(searchTerm)
  );
  const getContactsFromLocal = () => {
    const encrypted = localStorage.getItem("wa_contacts");
    if (!encrypted) return [];
    try {
      const bytes = CryptoJS.AES.decrypt(encrypted, "my_key");
      return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    } catch {
      return [];
    }
  };
  const saveChatHistoryToLocal = (data) => {
    const encrypted = CryptoJS.AES.encrypt(JSON.stringify(data), "my_chat_key").toString();
    localStorage.setItem("wa_chatHistory", encrypted);
  };

  const getChatHistoryFromLocal = () => {
    const encrypted = localStorage.getItem("wa_chatHistory");
    if (!encrypted) return {};

    try {
      const bytes = CryptoJS.AES.decrypt(encrypted, "my_chat_key");
      return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    } catch {
      return {};
    }
  };

  useEffect(() => {
    const savedHistory = getChatHistoryFromLocal();
    setChatHistory(savedHistory);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (selectedChat) {
      localStorage.setItem("wa_selectedChat", JSON.stringify(selectedChat));
    }
  }, [selectedChat]);

  useEffect(() => {
    const savedChat = localStorage.getItem("wa_selectedChat");
    if (savedChat) {
      const chat = JSON.parse(savedChat);
      setSelectedChat(chat);
      setNumber(chat.number);
    }
  }, []);


  return (
    <div className="wa-main">

      <div className="wa-sidebar">
        <div className="sidebar-header">
          <div className="profile-circle">W</div>
          <span className="sidebar-title">WhatsApp Web</span>
        </div>
        {status === "Connected" && (
          <>
            <div className="search">
              <FiSearch className="search-icon" />
              <input
                type="text"
                placeholder="Number & Name Enter..."
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <h4>Your Contacts</h4>
          </>
        )}
        <div className="contact-list">
          {filteredContacts.map((c, index) => (
            <div
              key={index}
              className="contact-item"
              onClick={() => {
                setSelectedChat(c);
                setNumber(c.number);
              }}
            >
              <HiOutlineUserCircle size={22} />
              <span>{c.name}</span>
            </div>
          ))}
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
      </div>

      <div className="wa-chat-area">

        <div className="chat-header">
          {selectedChat ? (
            <>
              <h3><HiOutlineUserCircle /> {selectedChat.name}</h3>

              <div className="header-actions">
                <IoVideocamOutline />
                <IoCallOutline />
                <FiSearch />
              </div>
            </>
          ) : (
            <h3>Select contact</h3>
          )}
        </div>

        <div className="chat-content">
          {status !== "Connected" && qr && messages.length === 0 && (
            <div className="chat-default-image">
              <img src="/img.jpg" alt="Welcome" />
              <p>Scan QR to start messaging</p>
            </div>
          )}

          {selectedChat &&
            chatHistory[selectedChat.number] &&
            chatHistory[selectedChat.number].map((msg, idx) => (
              <div
                key={idx}
                className={`chat-bubble ${msg.type === "incoming" ? "incoming" : "outgoing"}`}
              >
                <span className="bubble-text">
                  {msg.body}
                </span>
              </div>
            ))}

          <div ref={messagesEndRef}></div>
        </div>


        {status === "Connected" && selectedChat && (
          <form className="chat-input-box" onSubmit={handleSend}>
            <textarea
              placeholder="Write a message..."
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