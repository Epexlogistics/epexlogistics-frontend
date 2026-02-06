import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import api from "../api/axios";
import html2pdf from "html2pdf.js"; 
import logo from "../assets/logo.png";
import epexStamp from "../assets/epex-stamp.png";
import "./Track.css";

import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/* ================= FIX LEAFLET ICON ================= */
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

/* ================= MOVING ICON ================= */
const movingIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/1995/1995470.png",
  iconSize: [32, 32],
});

export default function Track() {
  const location = useLocation();
  const intervalRef = useRef(null);
  const printRef = useRef(null);

  const [trackingNumber, setTrackingNumber] = useState("");
  const [shipment, setShipment] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [history, setHistory] = useState([]);
  const [coords, setCoords] = useState([]);
  const [movingIndex, setMovingIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* ================= AUTO-FILL ================= */
  useEffect(() => {
    if (location.state?.trackingNumber) {
      setTrackingNumber(location.state.trackingNumber);
    }
  }, [location.state]);

  /* ================= TRACK SHIPMENT ================= */
  const trackShipment = async () => {
    if (!trackingNumber) {
      setError("Please enter a tracking number");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setShipment(null);
      setInvoice(null);
      setHistory([]);
      setCoords([]);
      setMovingIndex(0);

      const trackRes = await api.get(`/tracking/${trackingNumber}`);
      setShipment(trackRes.data.shipment);
      setHistory(trackRes.data.history || []);

      const points =
        trackRes.data.history
          ?.filter((h) => h.coordinates?.lat && h.coordinates?.lng)
          .map((h) => [h.coordinates.lat, h.coordinates.lng]) || [];

      setCoords(points);

      const invoiceRes = await api.get(`/shipments/invoice/${trackingNumber}`);
      setInvoice(invoiceRes.data);
    } catch (err) {
      setError(err.response?.data?.message || "Tracking number not found");
    } finally {
      setLoading(false);
    }
  };

  /* ================= AUTO-TRACK ================= */
  useEffect(() => {
    if (trackingNumber) trackShipment();
    // eslint-disable-next-line
  }, [trackingNumber]);

  /* ================= MAP ANIMATION ================= */
  useEffect(() => {
    if (coords.length < 2) return;

    intervalRef.current = setInterval(() => {
      setMovingIndex((prev) =>
        prev >= coords.length - 1 ? prev : prev + 1
      );
    }, 1200);

    return () => clearInterval(intervalRef.current);
  }, [coords]);

  /* ================= PRINT ================= */
  const printInvoice = () => {
    const win = window.open("", "", "width=900,height=700");
    win.document.write(`
      <html>
        <head>
          <title>Invoice ${invoice.invoice.invoiceNumber}</title>
          <style>
            @page { size: A4; margin: 30mm; }
            body { font-family: Arial, sans-serif; color: #333; }
            .watermark {
              position: fixed;
              top: 40%;
              left: 20%;
              font-size: 120px;
              color: rgba(200,0,0,0.15);
              transform: rotate(-30deg);
              font-weight: bold;
            }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 10px; }
            th { background: #f4f6f8; }
          </style>
        </head>
        <body>
          
          ${printRef.current.innerHTML}
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  /* ================= DOWNLOAD PDF (✅ ADDED) ================= */
  const downloadPDF = () => {
    const opt = {
      margin: 10,
      filename: `Invoice-${invoice.invoice.invoiceNumber}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    };

    html2pdf().from(printRef.current).set(opt).save();
  };

  return (
    <section className="track-page">
      <div className="track-container">
        <h1>Track Your Shipment</h1>

        {/* ================= INPUT ================= */}
        <div className="card">
          <input
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            placeholder="Enter tracking number"
          />
          <button onClick={trackShipment} disabled={loading}>
            {loading ? "Tracking..." : "Track Shipment"}
          </button>
          {error && <p className="error">{error}</p>}
        </div>

        {/* ================= MAP ================= */}
        <div className="map-card">
          <MapContainer
  center={coords.length > 0 ? coords[movingIndex] : [54.5260, 15.2551]}
  zoom={coords.length > 0 ? 5 : 4}
  style={{ height: "420px", width: "100%" }}
>

            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

            {coords.length > 1 && (
              <Polyline positions={coords} pathOptions={{ color: "#ffd400", weight: 4 }} />
            )}

            {coords.map((c, i) => (
              <Marker key={i} position={c}>
                <Popup>
                  <strong>{history[i]?.status}</strong>
                  <br />
                  {history[i]?.city}, {history[i]?.country}
                </Popup>
              </Marker>
            ))}

            {coords.length > 0 && (
              <Marker position={coords[movingIndex]} icon={movingIcon} />
            )}
          </MapContainer>
        </div>

{/* ================= INVOICE ================= */}
{invoice && (
  <>
    <div className="card">
      <button onClick={printInvoice}>🖨️ Print Invoice</button>
      <button onClick={downloadPDF}>⬇️ Download PDF</button>
    </div>

    <div
      ref={printRef}
      className="invoice-wrapper"
      style={{ position: "relative" }}
    >
      {/* ===== WATERMARK ===== */}
      <div
        className="invoice-watermark"
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%) rotate(-30deg)",
          fontSize: "110px",
          fontWeight: 800,
          color: "rgba(0, 0, 0, 0.05)",
          letterSpacing: "6px",
          whiteSpace: "nowrap",
          zIndex: 1,
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        EPEX LOGISTICS
      </div>

      {/* ===== STAMP ===== */}
      <div
        className="invoice-stamp"
        style={{
          position: "absolute",
          top: "380px",
          left: "48%",
          transform: "translateX(-50%) rotate(-25deg)",
          width: "180px",
          height: "180px",
          zIndex: 20,
          pointerEvents: "none",
        }}
      >
        <img
          src={epexStamp}
          alt="Epex Logistics Stamp"
          style={{ width: "100%", height: "100%", opacity: 0.85 }}
        />

        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "#0a7a2f",
            fontWeight: "bold",
            mixBlendMode: "multiply",
          }}
        >
          <div style={{ fontSize: 30, letterSpacing: 2 }}>PAID</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>
            {new Date(invoice.invoice.issuedAt).toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* LOGO + COMPANY INFO */}
      <table style={{ position: "relative", zIndex: 2 }}>
        <tbody>
          <tr>
            <td>
              <img src={logo} alt="Company Logo" style={{ height: 60 }} />
            </td>
            <td style={{ textAlign: "right" }}>
              <strong style={{ color: "rgb(22, 85, 135)" }}>
                Epex Logistics
              </strong>
              <br />
              <span style={{ color: "rgb(22, 85, 135)" }}>
                Global Shipping & Delivery
              </span>
              <br />
              <span style={{ fontSize: 13, color: "rgb(22, 85, 135)" }}>
                No: 8, 34862 Kartal, Istanbul, Turkey
              </span>
              <br />
              <span style={{ fontSize: 13, color: "rgb(22, 85, 135)" }}>
                support@epexlogistics.com
              </span>
              <br />
              <span style={{ fontSize: 13, color: "rgb(22, 85, 135)" }}>
                https://epexlogistics.com
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* INVOICE META */}
      <table style={{ position: "relative", zIndex: 2 }}>
        <tbody>
          <tr>
            <th style={{ color: "rgb(22, 85, 135)" }}>Invoice Number</th>
            <td>{invoice.invoice.invoiceNumber}</td>
            <th style={{ color: "rgb(22, 85, 135)" }}>Date</th>
            <td>{new Date(invoice.invoice.issuedAt).toLocaleDateString()}</td>
          </tr>
        </tbody>
      </table>

      {/* SENDER & RECEIVER */}
<table style={{ position: "relative", zIndex: 2 }}>
  <thead>
    <tr>
      <th colSpan="2" style={{ color: "rgb(22, 85, 135)" }}>
        Sender
      </th>
      <th colSpan="2" style={{ color: "rgb(22, 85, 135)" }}>
        Receiver
      </th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Name</td>
      <td>{invoice.sender.name}</td>
      <td>Name</td>
      <td>{invoice.receiver.name}</td>
    </tr>

    {/* ✅ EMAIL ROW ADDED */}
    <tr>
      <td>Email</td>
      <td>{invoice.sender.email || "—"}</td>
      <td>Email</td>
      <td>{invoice.receiver.email || "—"}</td>
    </tr>

    <tr>
      <td>Phone</td>
      <td>{invoice.sender.phone}</td>
      <td>Phone</td>
      <td>{invoice.receiver.phone}</td>
    </tr>

    <tr>
      <td>Address</td>
      <td>{invoice.sender.address}</td>
      <td>Address</td>
      <td>{invoice.receiver.address}</td>
    </tr>
  </tbody>
</table>


      {/* SHIPMENT DETAILS */}
      <table className="tracking-table" style={{ position: "relative", zIndex: 2 }}>
        <thead>
          <tr>
            <th style={{ color: "rgb(22, 85, 135)" }}>Description</th>
            <th style={{ color: "rgb(22, 85, 135)" }}>Qty</th>
            <th style={{ color: "rgb(22, 85, 135)" }}>Weight</th>
            <th style={{ color: "rgb(22, 85, 135)" }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Courier Shipment</td>
            <td>{invoice.shipment.quantity}</td>
            <td>{invoice.shipment.weight} kg</td>
            <td>
              {invoice.payment.currency}
              {invoice.payment.subtotal}
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colSpan="3">Subtotal</td>
            <td>
              {invoice.payment.currency}
              {invoice.payment.subtotal}
            </td>
          </tr>
          <tr>
            <td colSpan="3">VAT</td>
            <td>
              {invoice.payment.currency}
              {invoice.payment.tax}
            </td>
          </tr>
          <tr className="totals">
            <td colSpan="3">
              <strong>TOTAL</strong>
            </td>
            <td>
              <strong>
                {invoice.payment.currency}
                {invoice.payment.total}
              </strong>
            </td>
          </tr>
        </tfoot>
      </table>

      {/* FOOTER DISCLAIMER */}
      <div
        style={{
          marginTop: 50,
          fontSize: 12,
          color: "#475569",
          lineHeight: 1.6,
          textAlign: "center",
          position: "relative",
          zIndex: 2,
        }}
      >
        <strong>Disclaimer:</strong>
        <br />
        This invoice serves as proof of payment for logistics services rendered by
        Epex Logistics. All shipments are handled in accordance with our standard
        terms and conditions. Epex Logistics shall not be held liable for delays
        caused by customs inspections, force majeure, or circumstances beyond our
        control.
      </div>
    </div>
  </>
)}





        {/* ================= HISTORY ================= */}
        {history.length > 0 && (
          <div className="card">
            <h3>Tracking History</h3>
            {history.map((h, i) => (
              <div key={i} className="history-item">
                <strong>{h.status}</strong>
                <div>📍 {h.city}, {h.country}</div>
                {h.message && <p>{h.message}</p>}
                <small>{new Date(h.createdAt).toLocaleString()}</small>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
