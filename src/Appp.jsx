import { useState, useEffect, useCallback } from "react";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const API_URL = "https://routemate-backend-pi.vercel.app/api";
const FW_PUBLIC_KEY = "FLWPUBK-eb6ed3b9b84191c03601921ea5c4c723-X";

// ─── THEME ────────────────────────────────────────────────────────────────────
const T = {
  bg:"#0A0E1A", surface:"#111827", surfaceAlt:"#1A2235", border:"#1E2D45",
  accent:"#FF6B35", accentSoft:"#FF6B3520", accentGlow:"#FF6B3540",
  teal:"#00D4AA", tealSoft:"#00D4AA20",
  blue:"#3B82F6", gold:"#F59E0B", goldSoft:"#F59E0B20",
  fw:"#F5A623", fwSoft:"#F5A62320",
  text:"#F0F4FF", textMuted:"#6B7A99", textDim:"#3D4F6E",
  success:"#10B981", danger:"#EF4444",
};


// ─── CLOUDINARY UPLOAD ────────────────────────────────────────────────────────
const CLOUDINARY_CLOUD = "dwqf2qy8l";
const CLOUDINARY_PRESET = "routemate_uploads";

const uploadToCloudinary = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_PRESET);
  formData.append("folder", "routemate");
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
    method: "POST",
    body: formData,
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.secure_url;
};

// ─── API HELPER ───────────────────────────────────────────────────────────────
const api = async (endpoint, options = {}) => {
  const token = localStorage.getItem("rm_token");
  const res = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Something went wrong");
  return data;
};

// ─── FLUTTERWAVE HOOK ─────────────────────────────────────────────────────────
function useFlutterwave() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (window.FlutterwaveCheckout) { setReady(true); return; }
    const s = document.createElement("script");
    s.src = "https://checkout.flutterwave.com/v3.js";
    s.onload = () => setReady(true);
    document.head.appendChild(s);
  }, []);

  const pay = useCallback(({ amount, currency="NGN", description, meta={}, customer, onSuccess, onClose }) => {
    if (!window.FlutterwaveCheckout) { alert("Flutterwave not loaded yet."); return; }
    const tx_ref = `RM-${Date.now()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
    window.FlutterwaveCheckout({
      public_key: FW_PUBLIC_KEY,
      tx_ref, amount, currency,
      payment_options: "card,banktransfer,ussd,account,mobilemoney",
      customer: customer || { email:"user@routemate.co", phone_number:"+2348100000000", name:"Routemate User" },
      customizations: { title:"Routemate", description, logo:"https://placehold.co/60x60/FF6B35/ffffff?text=RM" },
      meta: { ...meta, tx_ref },
      callback: (res) => {
        if (res.status==="successful"||res.status==="completed") onSuccess?.({ ...res, tx_ref });
        window.FlutterwaveCheckout?.close?.();
      },
      onclose: onClose,
    });
  }, []);

  return { ready, pay };
}

// ─── AUTH CONTEXT ─────────────────────────────────────────────────────────────
function useAuth() {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("rm_token");
    if (token) {
      api("/auth/me")
        .then(d => setUser(d.user))
        .catch(() => localStorage.removeItem("rm_token"))
        .finally(() => setLoading(false));
    } else setLoading(false);
  }, []);

  const login = async (email, password) => {
    const d = await api("/auth/login", { method:"POST", body:{ email, password } });
    localStorage.setItem("rm_token", d.token);
    setUser(d.user);
    return d;
  };

  const register = async (form) => {
    const d = await api("/auth/register", { method:"POST", body: form });
    localStorage.setItem("rm_token", d.token);
    setUser(d.user);
    return d;
  };

  const logout = () => {
    localStorage.removeItem("rm_token");
    setUser(null);
  };

  return { user, loading, login, register, logout };
}

// ─── ATOMS ────────────────────────────────────────────────────────────────────
const Avatar = ({ initials, size=36, color=T.accent }) => (
  <div style={{ width:size, height:size, borderRadius:"50%", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center",
    background:`linear-gradient(135deg,${color}40,${color}80)`, border:`1.5px solid ${color}60`,
    fontSize:size*0.33, fontWeight:700, color, letterSpacing:"-0.5px" }}>{initials}</div>
);

const Badge = ({ text, color=T.accent }) => (
  <span style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase",
    color, background:`${color}20`, border:`1px solid ${color}40`, borderRadius:4, padding:"2px 7px" }}>{text}</span>
);

const Btn = ({ children, onClick, v="primary", style:sx={}, disabled, loading:ld }) => {
  const styles = {
    primary:{ background:`linear-gradient(135deg,${T.accent},#ff8c55)`, color:"#fff", boxShadow:`0 4px 20px ${T.accentGlow}` },
    fw:     { background:`linear-gradient(135deg,${T.fw},#f7b731)`,     color:"#fff", boxShadow:`0 4px 20px ${T.fw}40` },
    ghost:  { background:"transparent", color:T.textMuted, border:`1px solid ${T.border}` },
    teal:   { background:T.tealSoft,    color:T.teal,      border:`1px solid ${T.teal}40` },
    danger: { background:`${T.danger}15`, color:T.danger,  border:`1px solid ${T.danger}40` },
  };
  return (
    <button onClick={onClick} disabled={disabled||ld}
      style={{ borderRadius:12, fontWeight:700, fontSize:14, cursor:(disabled||ld)?"not-allowed":"pointer",
        border:"none", padding:"13px 0", width:"100%", opacity:(disabled||ld)?0.6:1, transition:"opacity 0.2s",
        ...styles[v], ...sx }}>
      {ld ? "Please wait…" : children}
    </button>
  );
};

const Input = ({ label, ...props }) => (
  <div>
    {label && <div style={{ fontSize:12, color:T.textMuted, marginBottom:6 }}>{label}</div>}
    <input {...props} style={{ width:"100%", padding:"12px 16px", borderRadius:10, border:`1px solid ${T.border}`,
      background:T.surfaceAlt, color:T.text, fontSize:14, outline:"none", boxSizing:"border-box" }} />
  </div>
);

const Spinner = () => (
  <div style={{ display:"flex", justifyContent:"center", padding:"40px 0" }}>
    <div style={{ width:36, height:36, borderRadius:"50%", border:`3px solid ${T.border}`, borderTop:`3px solid ${T.accent}`,
      animation:"spin 0.8s linear infinite" }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

const CATS = [
  { name:"Electronics", icon:"💻", color:T.blue },
  { name:"Documents",   icon:"📄", color:T.teal },
  { name:"Food",        icon:"🍱", color:T.gold },
  { name:"Clothing",    icon:"👕", color:"#EC4899" },
  { name:"Fragile",     icon:"🔮", color:"#8B5CF6" },
  { name:"Machinery",   icon:"⚙️", color:T.textMuted },
];

const NAV = [
  {id:"home",   label:"Home",    icon:"⬡"},
  {id:"find",   label:"Explore", icon:"🔍"},
  {id:"send",   label:"Send",    icon:"📦"},
  {id:"track",  label:"Track",   icon:"📍"},
  {id:"wallet", label:"Wallet",  icon:"💳"},
  {id:"chat",   label:"Chat",    icon:"💬"},
  {id:"admin",  label:"Admin",   icon:"⚙️"},
];

// ─── AUTH SCREEN ──────────────────────────────────────────────────────────────
function AuthScreen({ auth }) {
  const [mode, setMode]   = useState("login");
  const [form, setForm]   = useState({ name:"", email:"", phone:"", password:"", country:"Nigeria" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k,v) => setForm(f => ({...f,[k]:v}));

  const submit = async () => {
    setError(""); setLoading(true);
    try {
      if (mode==="login") await auth.login(form.email, form.password);
      else await auth.register(form);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ width:"100%", maxWidth:400 }}>
        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ width:64, height:64, borderRadius:18, background:`linear-gradient(135deg,${T.accent},#ff8c55)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, margin:"0 auto 14px" }}>📦</div>
          <div style={{ fontSize:28, fontWeight:900, color:T.text }}>
            <span style={{ color:T.accent }}>Route</span>mate
          </div>
          <div style={{ fontSize:13, color:T.textMuted, marginTop:4 }}>Peer-to-peer delivery platform</div>
        </div>

        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:20, padding:"28px 24px" }}>
          {/* Tabs */}
          <div style={{ display:"flex", marginBottom:24, background:T.surfaceAlt, borderRadius:10, padding:4 }}>
            {["login","register"].map(m => (
              <button key={m} onClick={() => setMode(m)} style={{ flex:1, padding:"9px 0", borderRadius:8, border:"none", cursor:"pointer", fontWeight:700, fontSize:13, textTransform:"capitalize", transition:"all 0.2s",
                background:mode===m?T.accent:"transparent", color:mode===m?"#fff":T.textMuted }}>
                {m==="login"?"Log In":"Sign Up"}
              </button>
            ))}
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {mode==="register" && (
              <>
                <Input label="Full Name" placeholder="Emmanuel Ademola" value={form.name} onChange={e=>set("name",e.target.value)} />
                <Input label="Phone Number" placeholder="+2348100000000" value={form.phone} onChange={e=>set("phone",e.target.value)} />
                <div>
                  <div style={{ fontSize:12, color:T.textMuted, marginBottom:6 }}>Country</div>
                  <select value={form.country} onChange={e=>set("country",e.target.value)}
                    style={{ width:"100%", padding:"12px 16px", borderRadius:10, border:`1px solid ${T.border}`, background:T.surfaceAlt, color:T.text, fontSize:14, outline:"none" }}>
                    {["Nigeria","Ghana","Kenya","South Africa","United Kingdom","United States","Canada","Other"].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
            <Input label="Email Address" type="email" placeholder="you@email.com" value={form.email} onChange={e=>set("email",e.target.value)} />
            <Input label="Password" type="password" placeholder="••••••••" value={form.password} onChange={e=>set("password",e.target.value)} />

            {error && (
              <div style={{ background:`${T.danger}15`, border:`1px solid ${T.danger}30`, borderRadius:10, padding:"10px 14px", fontSize:13, color:T.danger }}>
                ⚠️ {error}
              </div>
            )}

            <Btn onClick={submit} loading={loading}>
              {mode==="login" ? "Log In to Routemate" : "Create Account"}
            </Btn>
          </div>

          <div style={{ textAlign:"center", marginTop:16, fontSize:13, color:T.textMuted }}>
            {mode==="login" ? "Don't have an account? " : "Already have an account? "}
            <span onClick={() => setMode(mode==="login"?"register":"login")} style={{ color:T.accent, cursor:"pointer", fontWeight:700 }}>
              {mode==="login" ? "Sign Up" : "Log In"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}


// ─── BOOKING PAYMENT MODAL ────────────────────────────────────────────────────
function BookModal({ route, pkg, onClose, onSuccess, pay, fwReady }) {
  const base      = pkg ? pkg.proposedPrice || pkg.price || 4500 : (route?.pricePerKg || 800) * 3;
  const platFee   = Math.round(base * 0.15);
  const [ins, setIns]         = useState(false);
  const [express, setExpress] = useState(false);
  const total = base + platFee + (ins ? 500 : 0) + (express ? 1500 : 0);
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(null);
  const name  = route?.traveler?.name || pkg?.sender?.name || "User";
  const label = `${route?.fromCity||pkg?.fromCity} → ${route?.toCity||pkg?.toCity}`;

  const handlePay = () => {
    setLoading(true);
    pay({
      amount: total, currency: "NGN",
      description: `Routemate Escrow · ${label}`,
      meta: { type: "escrow" },
      customer: { email: "user@routemate.co", phone_number: "+2348100000000", name: "Routemate User" },
      onSuccess: (res) => { setLoading(false); setDone(res); onSuccess && onSuccess(res); },
      onClose: () => setLoading(false),
    });
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.82)", backdropFilter:"blur(6px)", zIndex:200, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <div style={{ background:T.surface, borderRadius:"24px 24px 0 0", width:"100%", maxWidth:430, padding:"28px 22px 44px", border:`1px solid ${T.border}`, maxHeight:"90vh", overflowY:"auto" }}>
        {done ? (
          <div style={{ textAlign:"center", padding:"20px 0" }}>
            <div style={{ fontSize:52, marginBottom:12 }}>🎉</div>
            <div style={{ fontSize:22, fontWeight:800, color:T.text, marginBottom:8 }}>Booking Confirmed!</div>
            <div style={{ fontSize:14, color:T.textMuted, marginBottom:4 }}>₦{total.toLocaleString()} locked in escrow</div>
            <div style={{ background:T.goldSoft, border:`1px solid ${T.gold}30`, borderRadius:12, padding:"12px 16px", marginBottom:20, fontSize:12, color:T.gold }}>
              🔒 Funds held in escrow until delivery is confirmed.
            </div>
            <button onClick={onClose} style={{ width:"100%", padding:"13px 0", borderRadius:12, border:"none", background:`linear-gradient(135deg,${T.accent},#ff8c55)`, color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer" }}>Done</button>
          </div>
        ) : (
          <>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:20 }}>
              <div>
                <div style={{ fontWeight:800, fontSize:18, color:T.text }}>Confirm & Pay</div>
                <div style={{ fontSize:12, color:T.textMuted, marginTop:2 }}>{label}</div>
              </div>
              <button onClick={onClose} style={{ background:T.surfaceAlt, border:`1px solid ${T.border}`, color:T.textMuted, borderRadius:10, width:34, height:34, cursor:"pointer", fontSize:16 }}>✕</button>
            </div>
            <div style={{ background:T.surfaceAlt, borderRadius:14, padding:"16px", marginBottom:16 }}>
              <div style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${T.border}` }}>
                <span style={{ fontSize:13, color:T.textMuted }}>Delivery fee</span>
                <span style={{ fontSize:13, color:T.text, fontWeight:600 }}>₦{base.toLocaleString()}</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", padding:"8px 0" }}>
                <span style={{ fontSize:13, color:T.textMuted }}>Platform fee (15%)</span>
                <span style={{ fontSize:13, color:T.text, fontWeight:600 }}>₦{platFee.toLocaleString()}</span>
              </div>
            </div>
            <div style={{ marginBottom:16 }}>
              {[
                { label:"📦 Package Insurance", sub:"Full value cover", price:500, state:ins, set:setIns },
                { label:"⚡ Express Delivery",  sub:"Priority matching",  price:1500, state:express, set:setExpress },
              ].map(a => (
                <div key={a.label} onClick={() => a.set(v => !v)} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", marginBottom:8, cursor:"pointer",
                  background:a.state?T.accentSoft:T.surfaceAlt, border:`1px solid ${a.state?T.accent:T.border}`, borderRadius:12 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:T.text }}>{a.label}</div>
                    <div style={{ fontSize:11, color:T.textMuted }}>{a.sub}</div>
                  </div>
                  <div style={{ fontSize:12, color:T.accent, fontWeight:700 }}>+₦{a.price}</div>
                  <div style={{ width:20, height:20, borderRadius:5, border:`2px solid ${a.state?T.accent:T.border}`, background:a.state?T.accent:"transparent", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:12 }}>{a.state?"✓":""}</div>
                </div>
              ))}
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 0", borderTop:`1px solid ${T.border}`, marginBottom:16 }}>
              <span style={{ fontWeight:700, color:T.text }}>Total (Escrow)</span>
              <span style={{ fontWeight:900, fontSize:22, color:T.accent }}>₦{total.toLocaleString()}</span>
            </div>
            <button onClick={handlePay} disabled={loading || !fwReady} style={{ width:"100%", padding:"13px 0", borderRadius:12, border:"none", background:`linear-gradient(135deg,${T.fw},#f7b731)`, color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer", opacity:(loading||!fwReady)?0.6:1, boxShadow:`0 4px 20px ${T.fw}40` }}>
              {loading ? "Opening Flutterwave…" : !fwReady ? "Loading…" : `🟠 Pay ₦${total.toLocaleString()} via Flutterwave`}
            </button>
            <div style={{ textAlign:"center", marginTop:8, fontSize:11, color:T.textDim }}>Secured by Flutterwave · Escrow protected</div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── HOME VIEW ────────────────────────────────────────────────────────────────
function HomeView({ user, setNav, pay, fwReady }) {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [bookPkg, setBookPkg]   = useState(null);

  useEffect(() => {
    api("/packages/search?status=open")
      .then(d => setPackages(d.packages || []))
      .catch(() => setPackages([]))
      .finally(() => setLoading(false));
  }, []);

  const initials = user?.name?.split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase() || "RM";

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      {/* Hero */}
      <div style={{ background:"linear-gradient(135deg,#0d1e35,#1a1030)", borderRadius:20, padding:"28px 24px", position:"relative", overflow:"hidden", border:`1px solid ${T.border}` }}>
        <div style={{ position:"absolute", top:-50, right:-50, width:200, height:200, borderRadius:"50%", background:`${T.accent}12`, filter:"blur(50px)" }} />
        <div style={{ fontSize:13, color:T.textMuted, marginBottom:4, letterSpacing:"0.06em", fontWeight:600 }}>ROUTEMATE</div>
        <div style={{ fontSize:26, fontWeight:900, color:T.text, lineHeight:1.2, marginBottom:8 }}>
          Welcome back,<br /><span style={{ color:T.accent }}>{user?.name?.split(" ")[0]}! 👋</span>
        </div>
        <div style={{ fontSize:13, color:T.textMuted, marginBottom:20 }}>Connect with travelers heading to your destination.</div>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={() => setNav("send")} style={{ flex:1, padding:"13px 0", borderRadius:12, border:"none", background:`linear-gradient(135deg,${T.accent},#ff8c55)`, color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer", boxShadow:`0 4px 24px ${T.accentGlow}` }}>Send a Package</button>
          <button onClick={() => setNav("find")} style={{ flex:1, padding:"13px 0", borderRadius:12, border:`1px solid ${T.border}`, background:"transparent", color:T.text, fontWeight:700, fontSize:14, cursor:"pointer" }}>I'm Traveling</button>
        </div>
      </div>

      {/* Wallet balance */}
      <div onClick={() => setNav("wallet")} style={{ background:`linear-gradient(135deg,#1a2840,#0d1e35)`, border:`1px solid ${T.border}`, borderRadius:16, padding:"16px 20px", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <div style={{ fontSize:12, color:T.textMuted }}>Wallet Balance</div>
          <div style={{ fontSize:24, fontWeight:900, color:T.text }}>₦{(user?.walletBalance||0).toLocaleString()}</div>
          {user?.escrowBalance > 0 && <div style={{ fontSize:12, color:T.gold, marginTop:2 }}>🔒 ₦{user.escrowBalance.toLocaleString()} in escrow</div>}
        </div>
        <div style={{ fontSize:32 }}>💳</div>
      </div>

      {/* FW payment methods */}
      <div style={{ background:T.surface, border:`1px solid ${T.fw}30`, borderRadius:16, padding:"14px 18px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
          <span style={{ fontSize:18 }}>🟠</span>
          <div style={{ fontWeight:700, color:T.fw, fontSize:13 }}>Payments by Flutterwave</div>
          <div style={{ marginLeft:"auto" }}><Badge text={fwReady?"Live":"Loading"} color={fwReady?T.success:T.gold} /></div>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {["💳 Card","🏦 Bank Transfer","📱 USSD","📲 Mobile Money"].map(m => (
            <span key={m} style={{ fontSize:11, color:T.textMuted, background:T.surfaceAlt, borderRadius:6, padding:"4px 10px" }}>{m}</span>
          ))}
        </div>
      </div>

      {/* Live packages */}
      <div>
        <div style={{ fontWeight:700, color:T.text, fontSize:15, marginBottom:12 }}>
          📦 Live Package Requests {!loading && `(${packages.length})`}
        </div>
        {loading ? <Spinner /> : packages.length === 0 ? (
          <div style={{ textAlign:"center", padding:"30px 0", color:T.textMuted, fontSize:14 }}>
            No packages yet. Be the first to post one!
          </div>
        ) : packages.map(pkg => {
          const cc = {electronics:T.blue,documents:T.teal,clothing:"#EC4899"}[pkg.category]||T.textMuted;
          const initials = pkg.sender?.name?.split(" ").map(n=>n[0]).join("").slice(0,2)||"?";
          return (
            <div key={pkg._id} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:16, padding:"18px 20px", marginBottom:12, position:"relative", overflow:"hidden" }}>
              {pkg.isUrgent && <div style={{ position:"absolute", top:0, right:0, background:`linear-gradient(135deg,${T.danger},#ff7043)`, fontSize:10, fontWeight:700, color:"#fff", padding:"4px 12px 4px 18px", borderRadius:"0 16px 0 16px" }}>URGENT</div>}
              <div style={{ display:"flex", gap:14 }}>
                <Avatar initials={initials} color={cc} />
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:14, color:T.text, marginBottom:2 }}>{pkg.sender?.name}</div>
                  <div style={{ fontSize:14, color:T.text, marginBottom:8 }}>{pkg.fromCity} <span style={{ color:T.accent }}>→</span> {pkg.toCity}</div>
                  <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
                    <Badge text={pkg.category} color={cc} />
                    <span style={{ fontSize:12, color:T.textMuted, background:`${T.border}60`, borderRadius:6, padding:"3px 8px" }}>{pkg.weight}kg</span>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div>
                      <div style={{ fontSize:11, color:T.textMuted }}>Offer</div>
                      <div style={{ fontSize:20, fontWeight:800, color:T.accent }}>₦{pkg.proposedPrice?.toLocaleString()}</div>
                    </div>
                    <button onClick={() => setBookPkg(pkg)} style={{ padding:"10px 18px", borderRadius:10, border:"none", background:`linear-gradient(135deg,${T.fw},#f7b731)`, color:"#fff", fontWeight:700, fontSize:12, cursor:"pointer" }}>
                      🟠 Accept & Pay
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── POST TRIP FORM ───────────────────────────────────────────────────────────
function PostTripForm({ user, onSuccess, onCancel }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    fromCity:"", fromCountry:"Nigeria", toCity:"", toCountry:"Nigeria",
    departureDate:"", arrivalDate:"", vehicle:"bus",
    availableSpace:"", maxWeight:"", pricingType:"per_kg",
    pricePerKg:"", flatRate:"", description:"",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const inp = { width:"100%", padding:"12px 16px", borderRadius:10, border:`1px solid ${T.border}`,
    background:T.surfaceAlt, color:T.text, fontSize:14, outline:"none", boxSizing:"border-box" };
  const VEHICLES = [
    { id:"bus", icon:"🚌", label:"Bus" },
    { id:"car", icon:"🚗", label:"Car" },
    { id:"flight", icon:"✈️", label:"Flight" },
    { id:"train", icon:"🚆", label:"Train" },
    { id:"motorcycle", icon:"🏍️", label:"Moto" },
    { id:"other", icon:"🚐", label:"Other" },
  ];
  const COUNTRIES = ["Nigeria","Ghana","Kenya","South Africa","United Kingdom","United States","Canada","Other"];

  const submit = async () => {
    setLoading(true); setError("");
    try {
      await api("/trips", { method:"POST", body:{
        ...form,
        availableSpace: Number(form.availableSpace),
        maxWeight:      Number(form.maxWeight),
        pricePerKg:     form.pricingType==="per_kg"   ? Number(form.pricePerKg) : undefined,
        flatRate:       form.pricingType==="flat_rate" ? Number(form.flatRate)   : undefined,
      }});
      onSuccess();
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:20, padding:"22px 20px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:20 }}>
        {[1,2,3].map(s=>(
          <div key={s} style={{ display:"flex", alignItems:"center", gap:8, flex:s<3?1:0 }}>
            <div style={{ width:28, height:28, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, flexShrink:0, transition:"all 0.3s",
              background:step>=s?T.teal:T.border, color:step>=s?"#fff":T.textDim }}>{s}</div>
            {s<3 && <div style={{ flex:1, height:2, background:step>s?T.teal:T.border }} />}
          </div>
        ))}
      </div>

      {step===1 && (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ fontWeight:700, fontSize:16, color:T.text }}>📍 Your Route</div>
          <div>
            <div style={{ fontSize:12, color:T.textMuted, marginBottom:6 }}>Departing From</div>
            <div style={{ display:"flex", gap:8 }}>
              <input placeholder="City" value={form.fromCity} onChange={e=>set("fromCity",e.target.value)} style={{ ...inp, flex:2 }} />
              <select value={form.fromCountry} onChange={e=>set("fromCountry",e.target.value)} style={{ ...inp, flex:1.5 }}>
                {COUNTRIES.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <div style={{ fontSize:12, color:T.textMuted, marginBottom:6 }}>Heading To</div>
            <div style={{ display:"flex", gap:8 }}>
              <input placeholder="City" value={form.toCity} onChange={e=>set("toCity",e.target.value)} style={{ ...inp, flex:2 }} />
              <select value={form.toCountry} onChange={e=>set("toCountry",e.target.value)} style={{ ...inp, flex:1.5 }}>
                {COUNTRIES.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div>
              <div style={{ fontSize:12, color:T.textMuted, marginBottom:6 }}>Departure</div>
              <input type="datetime-local" value={form.departureDate} onChange={e=>set("departureDate",e.target.value)} style={inp} />
            </div>
            <div>
              <div style={{ fontSize:12, color:T.textMuted, marginBottom:6 }}>Arrival</div>
              <input type="datetime-local" value={form.arrivalDate} onChange={e=>set("arrivalDate",e.target.value)} style={inp} />
            </div>
          </div>
          <div style={{ fontWeight:700, fontSize:15, color:T.text }}>Vehicle Type</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
            {VEHICLES.map(v=>(
              <div key={v.id} onClick={()=>set("vehicle",v.id)} style={{ padding:"12px 8px", borderRadius:10, cursor:"pointer", textAlign:"center",
                border:`1px solid ${form.vehicle===v.id?T.teal:T.border}`,
                background:form.vehicle===v.id?T.tealSoft:T.surfaceAlt }}>
                <div style={{ fontSize:22 }}>{v.icon}</div>
                <div style={{ fontSize:11, color:form.vehicle===v.id?T.teal:T.textMuted, marginTop:4, fontWeight:600 }}>{v.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {step===2 && (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ fontWeight:700, fontSize:16, color:T.text }}>📦 Space & Pricing</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div>
              <div style={{ fontSize:12, color:T.textMuted, marginBottom:6 }}>Available Space (kg)</div>
              <input type="number" placeholder="e.g. 20" value={form.availableSpace} onChange={e=>set("availableSpace",e.target.value)} style={inp} />
            </div>
            <div>
              <div style={{ fontSize:12, color:T.textMuted, marginBottom:6 }}>Max per Package (kg)</div>
              <input type="number" placeholder="e.g. 10" value={form.maxWeight} onChange={e=>set("maxWeight",e.target.value)} style={inp} />
            </div>
          </div>
          <div style={{ display:"flex", gap:10 }}>
            {[["per_kg","Per KG","₦/kg"],["flat_rate","Flat Rate","Fixed"]].map(([id,label,sub])=>(
              <div key={id} onClick={()=>set("pricingType",id)} style={{ flex:1, padding:"14px", borderRadius:12, cursor:"pointer",
                border:`1px solid ${form.pricingType===id?T.accent:T.border}`,
                background:form.pricingType===id?T.accentSoft:T.surfaceAlt }}>
                <div style={{ fontWeight:700, color:form.pricingType===id?T.accent:T.text, fontSize:14 }}>{label}</div>
                <div style={{ fontSize:11, color:T.textMuted, marginTop:2 }}>{sub}</div>
              </div>
            ))}
          </div>
          {form.pricingType==="per_kg"
            ? <div><div style={{ fontSize:12, color:T.textMuted, marginBottom:6 }}>Price per KG (₦)</div><input type="number" placeholder="e.g. 800" value={form.pricePerKg} onChange={e=>set("pricePerKg",e.target.value)} style={inp} /></div>
            : <div><div style={{ fontSize:12, color:T.textMuted, marginBottom:6 }}>Flat Rate per Package (₦)</div><input type="number" placeholder="e.g. 5000" value={form.flatRate} onChange={e=>set("flatRate",e.target.value)} style={inp} /></div>
          }
          {((form.pricingType==="per_kg"&&form.pricePerKg&&form.availableSpace)||(form.pricingType==="flat_rate"&&form.flatRate)) && (
            <div style={{ background:T.tealSoft, border:`1px solid ${T.teal}30`, borderRadius:12, padding:"14px 16px" }}>
              <div style={{ fontSize:12, color:T.textMuted, marginBottom:4 }}>💰 Max Earnings (fully booked)</div>
              <div style={{ fontSize:22, fontWeight:900, color:T.teal }}>
                ₦{form.pricingType==="per_kg"
                  ? (Number(form.pricePerKg)*Number(form.availableSpace)).toLocaleString()
                  : Number(form.flatRate).toLocaleString()}
              </div>
              <div style={{ fontSize:11, color:T.textMuted, marginTop:2 }}>
                After 15% fee: ₦{form.pricingType==="per_kg"
                  ? Math.round(Number(form.pricePerKg)*Number(form.availableSpace)*0.85).toLocaleString()
                  : Math.round(Number(form.flatRate)*0.85).toLocaleString()}
              </div>
            </div>
          )}
          <textarea placeholder="Additional notes (e.g. can carry fragile items)" value={form.description} onChange={e=>set("description",e.target.value)} style={{ ...inp, height:80, resize:"none" }} />
        </div>
      )}

      {step===3 && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ fontWeight:700, fontSize:16, color:T.text }}>✅ Review Trip</div>
          {[
            ["Route",    `${form.fromCity}, ${form.fromCountry} → ${form.toCity}, ${form.toCountry}`],
            ["Vehicle",  VEHICLES.find(v=>v.id===form.vehicle)?.label||form.vehicle],
            ["Departure",form.departureDate?new Date(form.departureDate).toLocaleString():"—"],
            ["Space",    `${form.availableSpace}kg`],
            ["Pricing",  form.pricingType==="per_kg"?`₦${Number(form.pricePerKg).toLocaleString()}/kg`:`₦${Number(form.flatRate).toLocaleString()} flat`],
          ].map(([l,v])=>(
            <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"10px 0", borderBottom:`1px solid ${T.border}` }}>
              <span style={{ fontSize:13, color:T.textMuted }}>{l}</span>
              <span style={{ fontSize:13, fontWeight:700, color:T.text, textAlign:"right", maxWidth:"60%" }}>{v||"—"}</span>
            </div>
          ))}
          {error && <div style={{ background:`${T.danger}15`, border:`1px solid ${T.danger}30`, borderRadius:10, padding:"10px 14px", fontSize:13, color:T.danger }}>⚠️ {error}</div>}
          <div style={{ background:T.tealSoft, border:`1px solid ${T.teal}30`, borderRadius:10, padding:"12px 14px", fontSize:12, color:T.teal }}>
            🚀 Your trip will be listed immediately and senders will be notified!
          </div>
        </div>
      )}

      <div style={{ display:"flex", gap:10, marginTop:20 }}>
        <button onClick={step===1?onCancel:()=>setStep(s=>s-1)} style={{ flex:1, padding:"13px 0", borderRadius:12, border:`1px solid ${T.border}`, background:"transparent", color:T.textMuted, fontWeight:700, fontSize:14, cursor:"pointer" }}>
          {step===1?"Cancel":"Back"}
        </button>
        {step<3
          ? <button onClick={()=>setStep(s=>s+1)} style={{ flex:2, padding:"13px 0", borderRadius:12, border:"none", background:`linear-gradient(135deg,${T.teal},#00f5c4)`, color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer" }}>Continue →</button>
          : <button onClick={submit} disabled={loading} style={{ flex:2, padding:"13px 0", borderRadius:12, border:"none", background:`linear-gradient(135deg,${T.teal},#00f5c4)`, color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer", opacity:loading?0.6:1 }}>
              {loading?"Posting…":"🚀 Post My Trip"}
            </button>
        }
      </div>
    </div>
  );
}

// ─── FIND VIEW ────────────────────────────────────────────────────────────────
function FindView({ user, pay, fwReady }) {
  const [tab, setTab]         = useState("find");
  const [search, setSearch]   = useState({ from:"", to:"" });
  const [trips, setTrips]     = useState([]);
  const [myTrips, setMyTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [myLoading, setMyLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [sel, setSel]         = useState(null);
  const [done, setDone]       = useState(false);
  const [tripPosted, setTripPosted] = useState(false);

  const loadMyTrips = async () => {
    setMyLoading(true);
    try { const d = await api("/trips/mine"); setMyTrips(d.trips||[]); }
    catch {} finally { setMyLoading(false); }
  };
  useEffect(()=>{ if(tab==="mytrips") loadMyTrips(); },[tab]);

  const doSearch = async () => {
    setLoading(true); setSearched(true);
    try {
      const q = new URLSearchParams();
      if (search.from) q.set("fromCity", search.from);
      if (search.to)   q.set("toCity",   search.to);
      const d = await api(`/trips/search?${q}`);
      setTrips(d.trips || []);
    } catch { setTrips([]); }
    finally { setLoading(false); }
  };

  const vIcon = { bus:"🚌", flight:"✈️", car:"🚗", train:"🚆", motorcycle:"🏍️", other:"🚐" };

  if (tab==="post") return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        <button onClick={()=>setTab("find")} style={{ background:"none", border:"none", color:T.textMuted, fontSize:20, cursor:"pointer", padding:0 }}>←</button>
        <div style={{ fontWeight:800, fontSize:20, color:T.text }}>Post Your Trip</div>
      </div>
      {tripPosted ? (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:16, padding:"30px 0", textAlign:"center" }}>
          <div style={{ width:80, height:80, borderRadius:"50%", background:T.tealSoft, border:`2px solid ${T.teal}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:36 }}>🚀</div>
          <div style={{ fontSize:22, fontWeight:800, color:T.text }}>Trip Posted!</div>
          <div style={{ fontSize:14, color:T.textMuted }}>Senders heading your route will see your listing and reach out.</div>
          <div style={{ display:"flex", gap:10, width:"100%" }}>
            <button onClick={()=>{ setTripPosted(false); setTab("mytrips"); }} style={{ flex:1, padding:"13px 0", borderRadius:12, border:`1px solid ${T.teal}40`, background:T.tealSoft, color:T.teal, fontWeight:700, cursor:"pointer" }}>View My Trips</button>
            <button onClick={()=>setTripPosted(false)} style={{ flex:1, padding:"13px 0", borderRadius:12, border:"none", background:`linear-gradient(135deg,${T.accent},#ff8c55)`, color:"#fff", fontWeight:700, cursor:"pointer" }}>Post Another</button>
          </div>
        </div>
      ) : (
        <PostTripForm user={user} onSuccess={()=>setTripPosted(true)} onCancel={()=>setTab("find")} />
      )}
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ fontWeight:800, fontSize:20, color:T.text }}>Explore</div>

      {/* Tab bar */}
      <div style={{ display:"flex", background:T.surfaceAlt, borderRadius:12, padding:4, gap:4 }}>
        {[["find","🔍 Find Traveler"],["post","🚀 Post Trip"],["mytrips","📋 My Trips"]].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{ flex:1, padding:"9px 0", borderRadius:9, border:"none", cursor:"pointer", fontWeight:700, fontSize:12, transition:"all 0.2s",
            background:tab===id?T.accent:"transparent", color:tab===id?"#fff":T.textMuted }}>{label}</button>
        ))}
      </div>

      {done && (
        <div style={{ background:T.tealSoft, border:`1px solid ${T.teal}30`, borderRadius:14, padding:"14px 18px", display:"flex", gap:12 }}>
          <span style={{ fontSize:22 }}>🎉</span>
          <div><div style={{ fontWeight:700, color:T.teal }}>Booking Confirmed!</div><div style={{ fontSize:12, color:T.textMuted, marginTop:2 }}>Payment in escrow. Track in the Track tab.</div></div>
        </div>
      )}

      {/* FIND tab */}
      {tab==="find" && (
        <>
          <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:16, padding:"16px 18px", display:"flex", flexDirection:"column", gap:10 }}>
            {[["from","📍 From","e.g. Ibadan"],["to","🏁 To","e.g. Lagos"]].map(([k,l,ph])=>(
              <div key={k} style={{ display:"flex", gap:12, alignItems:"center", padding:"10px 14px", background:T.surfaceAlt, borderRadius:10 }}>
                <span style={{ fontSize:13, color:T.textMuted, minWidth:55 }}>{l}</span>
                <input placeholder={ph} value={search[k]} onChange={e=>setSearch(s=>({...s,[k]:e.target.value}))}
                  onKeyDown={e=>e.key==="Enter"&&doSearch()}
                  style={{ flex:1, background:"none", border:"none", outline:"none", color:T.text, fontSize:14 }} />
              </div>
            ))}
            <Btn onClick={doSearch} loading={loading}>Search Routes</Btn>
          </div>
          {searched && !loading && (
            <>
              <div style={{ fontWeight:700, color:T.text, fontSize:15 }}>
                {trips.length>0?`${trips.length} Traveler${trips.length>1?"s":""} Found`:"No travelers found — try different cities"}
              </div>
              {trips.map(r=>{
                const isSel = sel?._id===r._id;
                const ini = r.traveler?.name?.split(" ").map(n=>n[0]).join("").slice(0,2)||"?";
                return (
                  <div key={r._id}>
                    <div onClick={()=>setSel(isSel?null:r)} style={{ background:isSel?T.surfaceAlt:T.surface, border:`1px solid ${isSel?T.accent:T.border}`, borderRadius:16, padding:"18px 20px", cursor:"pointer", transition:"all 0.2s", position:"relative", overflow:"hidden" }}>
                      {isSel && <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,${T.accent},${T.teal})` }} />}
                      <div style={{ display:"flex", gap:14 }}>
                        <Avatar initials={ini} color={T.teal} />
                        <div style={{ flex:1 }}>
                          <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:4 }}>
                            <span style={{ fontWeight:700, fontSize:15, color:T.text }}>{r.traveler?.name}</span>
                            {r.traveler?.isVerified && <Badge text="Verified" color={T.teal} />}
                            <span style={{ marginLeft:"auto", fontSize:13, color:T.gold, fontWeight:700 }}>⭐ {r.traveler?.rating||"New"}</span>
                          </div>
                          <div style={{ fontWeight:700, fontSize:14, color:T.text, marginBottom:8 }}>{r.fromCity} <span style={{ color:T.accent }}>→</span> {r.toCity}</div>
                          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                            <span style={{ fontSize:12, color:T.textMuted, background:`${T.border}60`, borderRadius:6, padding:"3px 8px" }}>{vIcon[r.vehicle]||"🚗"} {r.vehicle}</span>
                            <span style={{ fontSize:12, color:T.textMuted, background:`${T.border}60`, borderRadius:6, padding:"3px 8px" }}>📦 {r.availableSpace}kg</span>
                            <span style={{ fontSize:12, color:T.accent, background:T.accentSoft, borderRadius:6, padding:"3px 8px", fontWeight:600 }}>
                              {r.pricingType==="flat_rate"?`₦${r.flatRate?.toLocaleString()} flat`:`₦${r.pricePerKg}/kg`}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div style={{ marginTop:12, paddingTop:12, borderTop:`1px solid ${T.border}`, display:"flex", justifyContent:"space-between" }}>
                        <span style={{ fontSize:12, color:T.textMuted }}>{new Date(r.departureDate).toDateString()}</span>
                        <span style={{ fontSize:12, color:T.textMuted }}>{r.traveler?.totalDeliveries||0} deliveries</span>
                      </div>
                    </div>
                    {isSel && (
                      <div style={{ display:"flex", gap:8, marginTop:8 }}>
                        <button style={{ flex:1, padding:"11px 0", borderRadius:10, border:`1px solid ${T.teal}40`, background:T.tealSoft, color:T.teal, fontWeight:700, fontSize:13, cursor:"pointer" }}>💬 Message</button>
                        <button style={{ flex:2, padding:"11px 0", borderRadius:10, border:"none", background:`linear-gradient(135deg,${T.fw},#f7b731)`, color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer" }}>🟠 Book & Pay</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </>
      )}

      {/* MY TRIPS tab */}
      {tab==="mytrips" && (
        <>
          <button onClick={()=>setTab("post")} style={{ width:"100%", padding:"13px 0", borderRadius:12, border:"none", background:`linear-gradient(135deg,${T.teal},#00f5c4)`, color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer" }}>+ Post a New Trip</button>
          {myLoading ? <Spinner /> : myTrips.length===0 ? (
            <div style={{ textAlign:"center", padding:"40px 0", color:T.textMuted }}>
              <div style={{ fontSize:40, marginBottom:12 }}>🚀</div>
              <div style={{ fontWeight:700, color:T.text, marginBottom:6 }}>No trips posted yet</div>
              <div style={{ fontSize:13 }}>Post your first trip and start earning!</div>
            </div>
          ) : myTrips.map(trip=>(
            <div key={trip._id} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:16, padding:"18px 20px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                <div style={{ fontWeight:700, fontSize:15, color:T.text }}>{trip.fromCity} <span style={{ color:T.accent }}>→</span> {trip.toCity}</div>
                <Badge text={trip.status} color={trip.status==="active"?T.teal:T.textMuted} />
              </div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:10 }}>
                <span style={{ fontSize:12, color:T.textMuted, background:`${T.border}60`, borderRadius:6, padding:"3px 8px" }}>{vIcon[trip.vehicle]||"🚗"} {trip.vehicle}</span>
                <span style={{ fontSize:12, color:T.textMuted, background:`${T.border}60`, borderRadius:6, padding:"3px 8px" }}>📦 {trip.availableSpace}kg</span>
                <span style={{ fontSize:12, color:T.accent, background:T.accentSoft, borderRadius:6, padding:"3px 8px", fontWeight:600 }}>
                  {trip.pricingType==="flat_rate"?`₦${trip.flatRate?.toLocaleString()} flat`:`₦${trip.pricePerKg}/kg`}
                </span>
              </div>
              <div style={{ fontSize:12, color:T.textMuted }}>{new Date(trip.departureDate).toDateString()}</div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}


// ─── PHOTO UPLOADER COMPONENT ─────────────────────────────────────────────────
function PhotoUploader({ onUpload, label="Upload Photos", multiple=false }) {
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded]   = useState([]);
  const [error, setError]         = useState("");
  const inputRef = useState(null);

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true); setError("");
    try {
      const urls = [];
      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) { setError("File too large. Max 10MB."); continue; }
        const url = await uploadToCloudinary(file);
        urls.push(url);
      }
      const all = multiple ? [...uploaded, ...urls] : urls;
      setUploaded(all);
      onUpload(multiple ? all : urls[0]);
    } catch(e) { setError(e.message || "Upload failed. Try again."); }
    finally { setUploading(false); }
  };

  return (
    <div>
      <div style={{ fontSize:12, color:T.textMuted, marginBottom:8 }}>{label}</div>
      
      {/* Upload area */}
      <label style={{ display:"block", border:`2px dashed ${uploading?T.teal:uploaded.length>0?T.success:T.border}`, borderRadius:12, padding:"20px", textAlign:"center", background:T.surfaceAlt, cursor:"pointer", transition:"all 0.2s" }}>
        <input type="file" accept="image/*" multiple={multiple} style={{ display:"none" }}
          onChange={e => handleFiles(e.target.files)}
          capture="environment" />
        {uploading ? (
          <>
            <div style={{ fontSize:28, marginBottom:6 }}>⏳</div>
            <div style={{ fontSize:13, color:T.teal }}>Uploading...</div>
          </>
        ) : uploaded.length > 0 ? (
          <>
            <div style={{ fontSize:28, marginBottom:6 }}>✅</div>
            <div style={{ fontSize:13, color:T.success }}>{uploaded.length} photo{uploaded.length>1?"s":""} uploaded</div>
            <div style={{ fontSize:11, color:T.textMuted, marginTop:2 }}>Tap to add more</div>
          </>
        ) : (
          <>
            <div style={{ fontSize:28, marginBottom:6 }}>📷</div>
            <div style={{ fontSize:13, color:T.textMuted }}>Tap to take photo or upload</div>
            <div style={{ fontSize:11, color:T.textDim, marginTop:2 }}>JPG, PNG up to 10MB</div>
          </>
        )}
      </label>

      {/* Preview uploaded images */}
      {uploaded.length > 0 && (
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:10 }}>
          {uploaded.map((url, i) => (
            <div key={i} style={{ position:"relative" }}>
              <img src={url} alt="" style={{ width:70, height:70, borderRadius:8, objectFit:"cover", border:`1px solid ${T.border}` }} />
              <button onClick={() => {
                const newUrls = uploaded.filter((_,idx) => idx !== i);
                setUploaded(newUrls);
                onUpload(multiple ? newUrls : newUrls[0] || "");
              }} style={{ position:"absolute", top:-6, right:-6, width:20, height:20, borderRadius:"50%", background:T.danger, border:"none", color:"#fff", fontSize:11, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {error && <div style={{ fontSize:12, color:T.danger, marginTop:6 }}>⚠️ {error}</div>}
    </div>
  );
}

// ─── SEND VIEW ────────────────────────────────────────────────────────────────
function SendView({ user }) {
  const [step, setStep]   = useState(1);
  const [form, setForm]   = useState({ fromCity:"", fromCountry:"Nigeria", toCity:"", toCountry:"Nigeria", pickupAddress:"", deliveryAddress:"", category:"", weight:"", value:"", proposedPrice:"", description:"", deadline:"" });
  const [loading, setLoading] = useState(false);
  const [done, setDone]   = useState(null);
  const [error, setError] = useState("");
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const inp = { width:"100%", padding:"12px 16px", borderRadius:10, border:`1px solid ${T.border}`, background:T.surfaceAlt, color:T.text, fontSize:14, outline:"none", boxSizing:"border-box" };

  const submit = async () => {
    setLoading(true); setError("");
    try {
      const d = await api("/packages", { method:"POST", body:{ ...form, weight:Number(form.weight), value:Number(form.value), proposedPrice:Number(form.proposedPrice) } });
      setDone(d.package);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  if (done) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:20, padding:"40px 0", textAlign:"center" }}>
      <div style={{ width:80, height:80, borderRadius:"50%", background:T.tealSoft, border:`2px solid ${T.teal}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:36 }}>✓</div>
      <div style={{ fontSize:22, fontWeight:800, color:T.text }}>Package Listed!</div>
      <div style={{ fontSize:14, color:T.textMuted }}>Travelers heading your way will be notified.</div>
      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:"16px 32px" }}>
        <div style={{ fontSize:12, color:T.textMuted }}>Package ID</div>
        <div style={{ fontSize:18, fontWeight:800, color:T.accent, letterSpacing:"0.06em" }}>{done._id?.slice(-8).toUpperCase()}</div>
      </div>
      <Btn onClick={() => { setDone(null); setStep(1); setForm({ fromCity:"", fromCountry:"Nigeria", toCity:"", toCountry:"Nigeria", pickupAddress:"", deliveryAddress:"", category:"", weight:"", value:"", proposedPrice:"", description:"", deadline:"" }); }}>Post Another</Btn>
    </div>
  );

  return (
    <>
      <div style={{ fontWeight:800, fontSize:20, color:T.text, marginBottom:20 }}>Post a Package</div>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:20 }}>
        {[1,2,3].map(s => (
          <div key={s} style={{ display:"flex", alignItems:"center", gap:8, flex:s<3?1:0 }}>
            <div style={{ width:28, height:28, borderRadius:"50%", background:step>=s?T.accent:T.border, color:step>=s?"#fff":T.textDim, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, flexShrink:0 }}>{s}</div>
            {s<3 && <div style={{ flex:1, height:2, background:step>s?T.accent:T.border }} />}
          </div>
        ))}
      </div>
      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:20, padding:"22px 20px" }}>
        {step===1 && (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ fontWeight:700, fontSize:16, color:T.text }}>Route Details</div>
            {[["fromCity","Pickup City"],["toCity","Delivery City"],["pickupAddress","Pickup Address"],["deliveryAddress","Delivery Address"]].map(([k,ph]) => (
              <input key={k} placeholder={ph} value={form[k]} onChange={e=>set(k,e.target.value)} style={inp} />
            ))}
            <div style={{ fontWeight:700, fontSize:15, color:T.text, marginTop:4 }}>Category</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
              {CATS.map(c => (
                <div key={c.name} onClick={() => set("category",c.name.toLowerCase())} style={{ padding:"12px 8px", borderRadius:10, cursor:"pointer", textAlign:"center", border:`1px solid ${form.category===c.name.toLowerCase()?c.color:T.border}`, background:form.category===c.name.toLowerCase()?`${c.color}20`:T.surfaceAlt }}>
                  <div style={{ fontSize:20 }}>{c.icon}</div>
                  <div style={{ fontSize:11, color:form.category===c.name.toLowerCase()?c.color:T.textMuted, marginTop:4, fontWeight:600 }}>{c.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {step===2 && (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ fontWeight:700, fontSize:16, color:T.text }}>Package Details</div>
            {[["weight","Weight in kg (e.g. 2)"],["value","Item Value in ₦ (e.g. 50000)"],["proposedPrice","Your Delivery Offer in ₦"]].map(([k,ph]) => (
              <input key={k} type="number" placeholder={ph} value={form[k]} onChange={e=>set(k,e.target.value)} style={inp} />
            ))}
            <input type="date" value={form.deadline} onChange={e=>set("deadline",e.target.value)} style={inp} />
            <textarea placeholder="Describe the package contents and any handling notes…" value={form.description} onChange={e=>set("description",e.target.value)} style={{ ...inp, height:90, resize:"none" }} />
            <PhotoUploader onUpload={(urls) => set("photos", urls)} label="Upload Package Photos" multiple={true} />
          </div>
        )}
        {step===3 && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ fontWeight:700, fontSize:16, color:T.text }}>Review & Submit</div>
            {[["Route",`${form.fromCity} → ${form.toCity}`],["Category",form.category],["Weight",`${form.weight}kg`],["Item Value",`₦${Number(form.value).toLocaleString()}`],["Your Offer",`₦${Number(form.proposedPrice).toLocaleString()}`],["Deadline",form.deadline]].map(([l,v]) => (
              <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"10px 0", borderBottom:`1px solid ${T.border}` }}>
                <span style={{ fontSize:13, color:T.textMuted }}>{l}</span>
                <span style={{ fontSize:13, fontWeight:700, color:T.text }}>{v||"—"}</span>
              </div>
            ))}
            {error && <div style={{ background:`${T.danger}15`, border:`1px solid ${T.danger}30`, borderRadius:10, padding:"10px 14px", fontSize:13, color:T.danger }}>⚠️ {error}</div>}
            <div style={{ padding:"10px 14px", background:T.goldSoft, border:`1px solid ${T.gold}30`, borderRadius:10, fontSize:12, color:T.gold }}>
              🔒 Payment will be held in Flutterwave escrow until delivery is confirmed
            </div>
          </div>
        )}
        <div style={{ display:"flex", gap:10, marginTop:20 }}>
          {step>1 && <Btn v="ghost" onClick={() => setStep(s=>s-1)} style={{ flex:1 }}>Back</Btn>}
          {step<3
            ? <Btn onClick={() => setStep(s=>s+1)} style={{ flex:2 }}>Continue →</Btn>
            : <Btn onClick={submit} loading={loading} style={{ flex:2 }}>Post Package</Btn>
          }
        </div>
      </div>
    </>
  );
}

// ─── TRACK VIEW ───────────────────────────────────────────────────────────────
function TrackView({ user }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [code, setCode]         = useState("");
  const [confirming, setConfirming] = useState(null);
  const [showEscrow, setShowEscrow] = useState(null);
  const [progress, setProgress] = useState(65);

  useEffect(() => {
    api("/bookings/mine")
      .then(d => setBookings(d.bookings||[]))
      .catch(()=>{})
      .finally(()=>setLoading(false));
    const t = setInterval(()=>setProgress(p=>Math.min(p+0.1,98)),800);
    return ()=>clearInterval(t);
  }, []);

  const confirmDelivery = async (bookingId) => {
    try {
      await api("/payments/confirm-delivery", { method:"POST", body:{ bookingId, deliveryCode:code } });
      alert("✅ Delivery confirmed! Escrow released to traveler.");
      setConfirming(null); setCode("");
      const d = await api("/bookings/mine");
      setBookings(d.bookings||[]);
    } catch(e) { alert(e.message); }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ fontWeight:800, fontSize:20, color:T.text }}>Live Tracking</div>

      {loading ? <Spinner /> : bookings.length === 0 ? (
        <div style={{ textAlign:"center", padding:"40px 0", color:T.textMuted }}>
          <div style={{ fontSize:40, marginBottom:12 }}>📦</div>
          <div>No active deliveries yet</div>
        </div>
      ) : bookings.filter(b=>["paid","in_transit"].includes(b.status)).map(booking => (
        <div key={booking._id} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:20, overflow:"hidden" }}>
          {/* Map sim */}
          <div style={{ height:160, background:"linear-gradient(135deg,#0d1b2e,#0a2040)", position:"relative", overflow:"hidden" }}>
            <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%" }}>
              <defs>
                <linearGradient id="rg" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset={`${progress}%`} stopColor={T.teal} />
                  <stop offset="100%" stopColor={T.textDim} />
                </linearGradient>
              </defs>
              <polyline points="60,80 150,60 250,90 350,55 450,70 520,80" fill="none" stroke="url(#rg)" strokeWidth="2.5" strokeDasharray="6,3" />
              <circle cx={`${8+(progress/100)*84}%`} cy="50%" r="8" fill={T.teal} />
              <circle cx={`${8+(progress/100)*84}%`} cy="50%" r="14" fill={`${T.teal}30`} />
            </svg>
            <div style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", background:T.surface+"cc", borderRadius:8, padding:"4px 10px", fontSize:12, fontWeight:700, color:T.text }}>📍 {booking.package?.fromCity}</div>
            <div style={{ position:"absolute", right:14, top:"50%", transform:"translateY(-50%)", background:T.surface+"cc", borderRadius:8, padding:"4px 10px", fontSize:12, fontWeight:700, color:T.text }}>🏁 {booking.package?.toCity}</div>
            <div style={{ position:"absolute", top:10, left:"50%", transform:"translateX(-50%)", display:"flex", alignItems:"center", gap:6, background:T.surface+"dd", borderRadius:20, padding:"4px 12px" }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background:T.teal, boxShadow:`0 0 8px ${T.teal}` }} />
              <span style={{ fontSize:11, fontWeight:700, color:T.teal }}>LIVE</span>
            </div>
          </div>
          <div style={{ padding:"18px 20px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
              <div>
                <div style={{ fontSize:12, color:T.textMuted }}>Booking</div>
                <div style={{ fontWeight:800, fontSize:16, color:T.text }}>{booking._id?.slice(-8).toUpperCase()}</div>
              </div>
              <Badge text={booking.status.replace("_"," ")} color={T.teal} />
            </div>
            <div style={{ height:5, background:T.border, borderRadius:99, marginBottom:14 }}>
              <div style={{ width:`${progress}%`, height:"100%", background:`linear-gradient(90deg,${T.teal},#00f5c4)`, borderRadius:99, transition:"width 0.8s" }} />
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
              {[["Traveler",booking.traveler?.name],["Amount",`₦${booking.totalAmount?.toLocaleString()}`]].map(([l,v])=>(
                <div key={l} style={{ background:T.surfaceAlt, borderRadius:10, padding:"10px 12px" }}>
                  <div style={{ fontSize:10, color:T.textMuted, marginBottom:3 }}>{l}</div>
                  <div style={{ fontSize:12, fontWeight:700, color:T.text }}>{v||"—"}</div>
                </div>
              ))}
            </div>
            {confirming===booking._id ? (
              <div style={{ display:"flex", gap:8 }}>
                <input value={code} onChange={e=>setCode(e.target.value)} placeholder="Enter 4-digit delivery code"
                  style={{ flex:1, padding:"11px 14px", borderRadius:10, border:`1px solid ${T.accent}40`, background:T.surfaceAlt, color:T.text, fontSize:16, fontWeight:700, letterSpacing:"0.1em", outline:"none" }} />
                <button onClick={()=>confirmDelivery(booking._id)} style={{ padding:"11px 16px", borderRadius:10, border:"none", background:`linear-gradient(135deg,${T.teal},#00f5c4)`, color:"#fff", fontWeight:700, cursor:"pointer" }}>✓</button>
              </div>
            ) : (
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={()=>setConfirming(booking._id)} style={{ flex:2, padding:"11px 0", borderRadius:10, border:"none", background:`linear-gradient(135deg,${T.accent},#ff8c55)`, color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer" }}>🔐 Confirm Delivery</button>
                <button onClick={()=>setShowEscrow(booking)} style={{ flex:1, padding:"11px 0", borderRadius:10, border:`1px solid ${T.gold}40`, background:T.goldSoft||"#fff8e1", color:T.gold, fontWeight:700, fontSize:13, cursor:"pointer" }}>💰</button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── WALLET VIEW ──────────────────────────────────────────────────────────────
function WalletView({ user, pay, fwReady, refreshUser }) {
  const [modal, setModal]   = useState(null);
  const [txns, setTxns]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    api("/payments/transactions")
      .then(d => setTxns(d.transactions||[]))
      .catch(()=>{})
      .finally(()=>setLoading(false));
  }, []);

  const handleTopup = () => {
    const amt = Number(amount);
    if (!amt||amt<100) return;
    pay({
      amount:amt, currency:"NGN", description:"Routemate wallet top-up",
      customer:{ email:user.email, phone_number:user.phone, name:user.name },
      onSuccess: async (res) => {
        setProcessing(true);
        try {
          await api("/payments/wallet/verify-topup", { method:"POST", body:{ transaction_id:res.transaction_id, tx_ref:res.tx_ref, amount:amt } });
          await refreshUser();
          setModal(null); setAmount("");
          const d = await api("/payments/transactions");
          setTxns(d.transactions||[]);
        } catch(e) { alert(e.message); }
        finally { setProcessing(false); }
      },
    });
  };

  const typeIcon = { credit:"↓", debit:"↑", escrow_lock:"🔒", escrow_release:"💸", withdrawal:"↑", refund:"↩️" };
  const typeColor = { credit:T.success, debit:T.danger, escrow_lock:T.gold, escrow_release:T.teal, withdrawal:T.danger, refund:T.blue };

  return (
    <>
      {modal==="add" && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.78)", backdropFilter:"blur(6px)", zIndex:200, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
          <div style={{ background:T.surface, borderRadius:"24px 24px 0 0", width:"100%", maxWidth:430, padding:"28px 22px 44px", border:`1px solid ${T.border}` }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:22 }}>
              <div style={{ fontWeight:800, fontSize:18, color:T.text }}>Add Funds</div>
              <button onClick={()=>setModal(null)} style={{ background:T.surfaceAlt, border:`1px solid ${T.border}`, color:T.textMuted, borderRadius:10, width:34, height:34, cursor:"pointer", fontSize:16 }}>✕</button>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:14 }}>
              {[2000,5000,10000,20000].map(p=>(
                <button key={p} onClick={()=>setAmount(String(p))} style={{ padding:"9px 0", borderRadius:10, cursor:"pointer", border:`1px solid ${amount===String(p)?T.accent:T.border}`, background:amount===String(p)?T.accentSoft:T.surfaceAlt, color:amount===String(p)?T.accent:T.textMuted, fontWeight:700, fontSize:12 }}>₦{p>=1000?`${p/1000}k`:p}</button>
              ))}
            </div>
            <div style={{ display:"flex", alignItems:"center", background:T.surfaceAlt, border:`1px solid ${T.border}`, borderRadius:12, overflow:"hidden", marginBottom:16 }}>
              <span style={{ padding:"14px 16px", color:T.textMuted, fontSize:16, fontWeight:700, borderRight:`1px solid ${T.border}` }}>₦</span>
              <input value={amount} onChange={e=>setAmount(e.target.value.replace(/\D/g,""))} placeholder="Enter amount"
                style={{ flex:1, padding:"14px 16px", background:"none", border:"none", outline:"none", color:T.text, fontSize:18, fontWeight:700 }} />
            </div>
            <Btn v="fw" onClick={handleTopup} disabled={!amount||Number(amount)<100||!fwReady||processing}>
              {processing?"Verifying…":!fwReady?"Loading…":`🟠 Pay ₦${Number(amount||0).toLocaleString()} via Flutterwave`}
            </Btn>
          </div>
        </div>
      )}

      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        {/* Balance */}
        <div style={{ background:"linear-gradient(135deg,#1a2840,#0d1e35)", border:`1px solid ${T.border}`, borderRadius:20, padding:"28px 24px", position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", top:-40, right:-40, width:160, height:160, borderRadius:"50%", background:`${T.accent}15`, filter:"blur(30px)" }} />
          <div style={{ fontSize:13, color:T.textMuted, marginBottom:4 }}>Available Balance</div>
          <div style={{ fontSize:38, fontWeight:900, color:T.text, lineHeight:1 }}>₦{(user?.walletBalance||0).toLocaleString()}</div>
          {user?.escrowBalance > 0 && <div style={{ fontSize:13, color:T.gold, marginTop:6 }}>🔒 ₦{user.escrowBalance.toLocaleString()} in escrow</div>}
          <div style={{ display:"flex", gap:10, marginTop:22 }}>
            <button style={{ flex:1, padding:"10px 0", borderRadius:10, border:"none", background:`linear-gradient(135deg,${T.accent},#ff8c55)`, color:"#fff", fontWeight:700, fontSize:12, cursor:"pointer" }}>Withdraw</button>
            <button onClick={()=>setModal("add")} style={{ flex:1, padding:"10px 0", borderRadius:10, border:`1px solid ${T.fw}40`, background:T.fwSoft, color:T.fw, fontWeight:700, fontSize:12, cursor:"pointer" }}>+ Add Funds</button>
          </div>
        </div>

        {/* FW banner */}
        <div style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", background:T.fwSoft, border:`1px solid ${T.fw}30`, borderRadius:14 }}>
          <span style={{ fontSize:24 }}>🟠</span>
          <div>
            <div style={{ fontWeight:700, color:T.fw, fontSize:13 }}>Powered by Flutterwave</div>
            <div style={{ fontSize:11, color:T.textMuted }}>PCI DSS Compliant · 256-bit SSL · Escrow protected</div>
          </div>
        </div>

        {/* Transactions */}
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:20, overflow:"hidden" }}>
          <div style={{ padding:"18px 20px 14px", fontWeight:700, fontSize:15, color:T.text }}>Transaction History</div>
          {loading ? <Spinner /> : txns.length===0 ? (
            <div style={{ padding:"20px", textAlign:"center", color:T.textMuted, fontSize:13 }}>No transactions yet</div>
          ) : txns.map(tx => (
            <div key={tx._id} style={{ padding:"12px 20px", borderTop:`1px solid ${T.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                <div style={{ width:36, height:36, borderRadius:10, background:`${typeColor[tx.type]||T.accent}20`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15 }}>
                  {typeIcon[tx.type]||"•"}
                </div>
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:T.text, maxWidth:200, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{tx.description}</div>
                  <div style={{ fontSize:11, color:T.textMuted }}>{new Date(tx.createdAt).toLocaleDateString()}</div>
                </div>
              </div>
              <div style={{ fontSize:14, fontWeight:700, color:typeColor[tx.type]||T.accent }}>
                {["credit","escrow_release","refund"].includes(tx.type)?"+":"-"}₦{tx.amount?.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── ADMIN VIEW ───────────────────────────────────────────────────────────────
function AdminView({ user, fwReady }) {
  const [tab, setTab]     = useState("overview");
  const [stats, setStats] = useState(null);
  const [disputes, setDisputes] = useState([]);
  const [verifications, setVerifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role !== "admin") return;
    Promise.all([
      api("/admin/stats"),
      api("/admin/disputes"),
      api("/admin/verifications"),
    ]).then(([s,d,v]) => {
      setStats(s.stats);
      setDisputes(d.disputes||[]);
      setVerifications(v.users||[]);
    }).catch(()=>{}).finally(()=>setLoading(false));
  }, [user]);

  if (user?.role !== "admin") return (
    <div style={{ textAlign:"center", padding:"60px 20px", color:T.textMuted }}>
      <div style={{ fontSize:40, marginBottom:12 }}>🔒</div>
      <div style={{ fontWeight:700, color:T.text, marginBottom:8 }}>Admin Access Only</div>
      <div style={{ fontSize:13 }}>This area is restricted to platform administrators.</div>
    </div>
  );

  const resolveDispute = async (id, winner) => {
    try {
      await api(`/admin/disputes/${id}/resolve`, { method:"POST", body:{ winner } });
      alert(`✅ Resolved in favour of ${winner}`);
      const d = await api("/admin/disputes");
      setDisputes(d.disputes||[]);
    } catch(e) { alert(e.message); }
  };

  const verifyUser = async (id, action) => {
    try {
      await api(`/admin/verifications/${id}`, { method:"POST", body:{ action } });
      setVerifications(v => v.filter(u=>u._id!==id));
    } catch(e) { alert(e.message); }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ display:"flex", gap:8 }}>
        {["overview","disputes","users"].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{ padding:"8px 16px", borderRadius:10, cursor:"pointer", textTransform:"capitalize", fontWeight:600, fontSize:13, border:`1px solid ${tab===t?T.accent:T.border}`, background:tab===t?T.accentSoft:"transparent", color:tab===t?T.accent:T.textMuted }}>{t}</button>
        ))}
      </div>

      {loading ? <Spinner /> : (
        <>
          {tab==="overview" && stats && (
            <>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                {[{l:"Total Users",v:stats.totalUsers,i:"👥"},{l:"Active Trips",v:stats.activeTrips,i:"🚀"},{l:"Total Bookings",v:stats.totalBookings,i:"📦"},{l:"Platform Revenue",v:`₦${Math.round(stats.platformRevenue||0).toLocaleString()}`,i:"💰"}].map(m=>(
                  <div key={m.l} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:16, padding:"16px 18px" }}>
                    <div style={{ fontSize:20, marginBottom:8 }}>{m.i}</div>
                    <div style={{ fontSize:20, fontWeight:800, color:T.text }}>{m.v}</div>
                    <div style={{ fontSize:11, color:T.textMuted, marginTop:2 }}>{m.l}</div>
                  </div>
                ))}
              </div>
              <div style={{ display:"flex", gap:12, padding:"12px 16px", background:fwReady?T.tealSoft:T.goldSoft, border:`1px solid ${fwReady?T.teal:T.gold}30`, borderRadius:14, alignItems:"center" }}>
                <span style={{ fontSize:20 }}>{fwReady?"🟢":"🟡"}</span>
                <div>
                  <div style={{ fontWeight:700, color:fwReady?T.teal:T.gold, fontSize:13 }}>Flutterwave {fwReady?"Connected":"Loading"}</div>
                  <div style={{ fontSize:11, color:T.textMuted }}>Escrow · Transfers · Refunds</div>
                </div>
              </div>
            </>
          )}

          {tab==="disputes" && (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {disputes.length===0 ? (
                <div style={{ textAlign:"center", padding:"30px", color:T.textMuted }}>No open disputes 🎉</div>
              ) : disputes.map(d=>(
                <div key={d._id} style={{ background:T.surface, border:`1px solid ${T.danger}30`, borderRadius:16, padding:"18px 20px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                    <Badge text={d._id?.slice(-6)} color={T.danger} />
                    <Badge text={d.status} color={T.gold} />
                  </div>
                  <div style={{ fontSize:14, fontWeight:700, color:T.text, marginBottom:10 }}>"{d.disputeReason}"</div>
                  <div style={{ display:"flex", gap:14, marginBottom:12 }}>
                    <div style={{ fontSize:12, color:T.textMuted }}>Sender: <span style={{ color:T.text }}>{d.sender?.name}</span></div>
                    <div style={{ fontSize:12, color:T.textMuted }}>Traveler: <span style={{ color:T.text }}>{d.traveler?.name}</span></div>
                  </div>
                  <div style={{ fontSize:13, color:T.gold, fontWeight:700, marginBottom:12 }}>Escrow: ₦{d.totalAmount?.toLocaleString()}</div>
                  <div style={{ display:"flex", gap:8 }}>
                    <Btn v="teal"   onClick={()=>resolveDispute(d._id,"traveler")} style={{ flex:1, fontSize:12 }}>→ Release to Traveler</Btn>
                    <Btn v="danger" onClick={()=>resolveDispute(d._id,"sender")}   style={{ flex:1, fontSize:12 }}>← Refund Sender</Btn>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab==="users" && (
            <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:16, overflow:"hidden" }}>
              <div style={{ padding:"16px 20px", borderBottom:`1px solid ${T.border}`, fontWeight:700, color:T.text }}>
                Pending KYC ({verifications.length})
              </div>
              {verifications.length===0 ? (
                <div style={{ padding:"20px", textAlign:"center", color:T.textMuted, fontSize:13 }}>All verifications up to date ✅</div>
              ) : verifications.map((u,i)=>(
                <div key={u._id} style={{ padding:"14px 20px", borderBottom:`1px solid ${T.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                    <Avatar initials={u.name?.split(" ").map(n=>n[0]).join("").slice(0,2)||"?"} size={34} color={T.blue} />
                    <div>
                      <div style={{ fontSize:13, fontWeight:600, color:T.text }}>{u.name}</div>
                      <div style={{ fontSize:11, color:T.textMuted }}>{u.email}</div>
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:8 }}>
                    <button onClick={()=>verifyUser(u._id,"approve")} style={{ padding:"6px 14px", borderRadius:7, border:`1px solid ${T.success}40`, background:T.tealSoft, color:T.teal, fontSize:11, fontWeight:700, cursor:"pointer" }}>Approve</button>
                    <button onClick={()=>verifyUser(u._id,"reject")}  style={{ padding:"6px 14px", borderRadius:7, border:`1px solid ${T.danger}40`, background:`${T.danger}15`, color:T.danger, fontSize:11, fontWeight:700, cursor:"pointer" }}>Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}


// ─── CHAT VIEW ────────────────────────────────────────────────────────────────
function ChatView({ user }) {
  const pusher = usePusher();
  const [conversations, setConversations] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msgText, setMsgText] = useState("");
  const [offerAmt, setOfferAmt] = useState("");
  const [showOffer, setShowOffer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    api("/chat/conversations")
      .then(d => { setConversations(d.conversations || []); setError(null); })
      .catch(e => { setConversations([]); setError(e.message); })
      .finally(() => setLoading(false));
    api("/chat/unread")
      .then(d => setUnread(d.count || 0))
      .catch(() => setUnread(0));
  }, []);

  useEffect(() => {
    if (!activeChat) return;
    const otherId = activeChat.sender?._id === user._id ? activeChat.receiver?._id : activeChat.sender?._id;
    if (!otherId) return;
    api(`/chat/direct/${otherId}`)
      .then(d => setMessages(d.messages || []))
      .catch(() => setMessages([]));
  }, [activeChat]);

  useEffect(() => {
    if (!pusher || !activeChat) return;
    try {
      const otherId = activeChat.sender?._id === user._id ? activeChat.receiver?._id : activeChat.sender?._id;
      if (!otherId) return;
      const channelName = [user._id, otherId].sort().join("-");
      const channel = pusher.subscribe(`chat-${channelName}`);
      channel.bind("new-message", (data) => setMessages(prev => [...prev, data]));
      channel.bind("offer-updated", (data) => {
        setMessages(prev => prev.map(m => m._id === data.messageId ? { ...m, offerStatus: data.offerStatus } : m));
      });
      return () => { try { pusher.unsubscribe(`chat-${channelName}`); } catch(e) {} };
    } catch(e) {}
  }, [pusher, activeChat]);

  const sendMessage = async (type = "text", amount = null) => {
    if (!msgText.trim() && !amount) return;
    const otherId = activeChat?.sender?._id === user._id ? activeChat?.receiver?._id : activeChat?.sender?._id;
    if (!otherId) return;
    setSending(true);
    try {
      await api("/chat/send", { method: "POST", body: {
        receiverId: otherId,
        text: amount ? `Offer: ₦${Number(amount).toLocaleString()}` : msgText.trim(),
        type, offerAmount: amount || null,
      }});
      setMsgText(""); setOfferAmt(""); setShowOffer(false);
    } catch(e) { alert(e.message); }
    finally { setSending(false); }
  };

  const respondOffer = async (messageId, status) => {
    try { await api(`/chat/offer/${messageId}`, { method: "PATCH", body: { status } }); }
    catch(e) { alert(e.message); }
  };

  const otherUser = (conv) => conv?.sender?._id === user._id ? conv?.receiver : conv?.sender;

  if (activeChat) {
    const other = otherUser(activeChat);
    const initials = other?.name?.split(" ").map(n=>n[0]).join("").slice(0,2)||"?";
    return (
      <div style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 160px)" }}>
        <div style={{ display:"flex", gap:12, alignItems:"center", paddingBottom:14, borderBottom:`1px solid ${T.border}`, marginBottom:14 }}>
          <button onClick={() => setActiveChat(null)} style={{ background:"none", border:"none", color:T.textMuted, fontSize:20, cursor:"pointer", padding:0 }}>←</button>
          <Avatar initials={initials} color={T.teal} size={38} />
          <div>
            <div style={{ fontWeight:700, color:T.text, fontSize:15 }}>{other?.name || "User"}</div>
            <div style={{ fontSize:11, color:T.teal }}>● Online</div>
          </div>
        </div>
        <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:10, paddingBottom:8 }}>
          {messages.length === 0 && (
            <div style={{ textAlign:"center", padding:"30px 0", color:T.textMuted, fontSize:13 }}>No messages yet. Start the conversation! 👋</div>
          )}
          {messages.map((m, i) => {
            const isMe = m.sender?._id === user._id || m.sender === user._id;
            return (
              <div key={m._id || i} style={{ display:"flex", justifyContent:isMe?"flex-end":"flex-start" }}>
                <div style={{ maxWidth:"78%", padding:"10px 14px", fontSize:14, lineHeight:1.4,
                  borderRadius:isMe?"16px 16px 4px 16px":"16px 16px 16px 4px",
                  background:isMe?`linear-gradient(135deg,${T.accent},#ff8c55)`:T.surfaceAlt,
                  color:isMe?"#fff":T.text }}>
                  {m.text}
                  {m.type==="offer" && m.offerStatus==="pending" && !isMe && (
                    <div style={{ display:"flex", gap:8, marginTop:10 }}>
                      <button onClick={() => respondOffer(m._id, "accepted")} style={{ flex:1, padding:"6px 0", borderRadius:8, border:"none", background:T.teal, color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer" }}>✓ Accept</button>
                      <button onClick={() => respondOffer(m._id, "rejected")} style={{ flex:1, padding:"6px 0", borderRadius:8, border:`1px solid ${T.danger}`, background:"transparent", color:T.danger, fontSize:11, fontWeight:700, cursor:"pointer" }}>✕ Reject</button>
                    </div>
                  )}
                  {m.type==="offer" && m.offerStatus && m.offerStatus!=="pending" && (
                    <div style={{ fontSize:11, marginTop:6, color:isMe?"rgba(255,255,255,0.7)":T.textMuted, fontStyle:"italic" }}>Offer {m.offerStatus} ✓</div>
                  )}
                  <div style={{ fontSize:10, color:isMe?"rgba(255,255,255,0.5)":T.textMuted, marginTop:4, textAlign:"right" }}>
                    {new Date(m.createdAt).toLocaleTimeString("en", { hour:"2-digit", minute:"2-digit" })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {showOffer && (
          <div style={{ padding:"10px 0", display:"flex", gap:8 }}>
            <div style={{ flex:1, display:"flex", alignItems:"center", background:T.surfaceAlt, border:`1px solid ${T.accent}40`, borderRadius:12, overflow:"hidden" }}>
              <span style={{ padding:"0 12px", color:T.textMuted, fontWeight:700 }}>₦</span>
              <input value={offerAmt} onChange={e => setOfferAmt(e.target.value.replace(/\D/g,""))} placeholder="Enter offer amount"
                style={{ flex:1, padding:"12px 8px", background:"none", border:"none", outline:"none", color:T.text, fontSize:14 }} />
            </div>
            <button onClick={() => sendMessage("offer", offerAmt)} disabled={!offerAmt||sending}
              style={{ padding:"0 16px", borderRadius:12, border:"none", background:`linear-gradient(135deg,${T.accent},#ff8c55)`, color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer" }}>Send</button>
          </div>
        )}
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", paddingBottom:8 }}>
          {["👍 Agreed!", "📦 Ready to pick up", "🚀 On my way", "✅ Delivered"].map(q => (
            <button key={q} onClick={() => setMsgText(q)} style={{ padding:"5px 10px", borderRadius:16, border:`1px solid ${T.border}`, background:T.surfaceAlt, color:T.textMuted, fontSize:11, cursor:"pointer" }}>{q}</button>
          ))}
        </div>
        <div style={{ display:"flex", gap:8, paddingTop:8, borderTop:`1px solid ${T.border}` }}>
          <button onClick={() => setShowOffer(v => !v)} style={{ width:42, height:42, borderRadius:10, border:`1px solid ${T.accent}40`, background:showOffer?T.accentSoft:"transparent", color:T.accent, fontSize:18, cursor:"pointer", flexShrink:0 }}>₦</button>
          <input value={msgText} onChange={e => setMsgText(e.target.value)} onKeyDown={e => e.key==="Enter" && sendMessage()}
            placeholder="Type a message..." style={{ flex:1, padding:"11px 16px", borderRadius:12, border:`1px solid ${T.border}`, background:T.surfaceAlt, color:T.text, fontSize:14, outline:"none" }} />
          <button onClick={() => sendMessage()} disabled={!msgText.trim()||sending}
            style={{ width:42, height:42, borderRadius:12, border:"none", background:`linear-gradient(135deg,${T.accent},#ff8c55)`, color:"#fff", fontSize:18, cursor:"pointer", flexShrink:0, opacity:(!msgText.trim()||sending)?0.5:1 }}>↑</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ fontWeight:800, fontSize:20, color:T.text }}>Messages</div>
        {unread > 0 && <Badge text={`${unread} unread`} color={T.accent} />}
      </div>
      {loading ? <Spinner /> : (
        <>
          {error && (
            <div style={{ background:`${T.danger}15`, border:`1px solid ${T.danger}30`, borderRadius:12, padding:"12px 16px", fontSize:13, color:T.danger }}>
              ⚠️ Could not load messages. Please try again.
            </div>
          )}
          {conversations.length === 0 ? (
            <div style={{ textAlign:"center", padding:"50px 20px" }}>
              <div style={{ fontSize:50, marginBottom:14 }}>💬</div>
              <div style={{ fontWeight:700, color:T.text, fontSize:16, marginBottom:8 }}>No conversations yet</div>
              <div style={{ fontSize:13, color:T.textMuted, lineHeight:1.5 }}>When you book a traveler or receive a booking request your chat will appear here.</div>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
              {conversations.map((conv, i) => {
                const other = otherUser(conv);
                const initials = other?.name?.split(" ").map(n=>n[0]).join("").slice(0,2)||"?";
                const isUnread = !conv.isRead && conv.receiver?._id === user._id;
                return (
                  <div key={i} onClick={() => setActiveChat(conv)} style={{ display:"flex", gap:14, alignItems:"center", padding:"14px 16px", background:isUnread?T.accentSoft:T.surface, border:`1px solid ${isUnread?T.accent:T.border}`, borderRadius:14, cursor:"pointer" }}>
                    <Avatar initials={initials} color={T.teal} size={46} />
                    <div style={{ flex:1, overflow:"hidden" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                        <span style={{ fontWeight:700, color:T.text, fontSize:14 }}>{other?.name}</span>
                        <span style={{ fontSize:11, color:T.textMuted }}>{new Date(conv.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div style={{ fontSize:13, color:isUnread?T.text:T.textMuted, fontWeight:isUnread?600:400, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {conv.sender?._id === user._id ? "You: " : ""}{conv.text}
                      </div>
                    </div>
                    {isUnread && <div style={{ width:10, height:10, borderRadius:"50%", background:T.accent, flexShrink:0 }} />}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const auth = useAuth();
  const [nav, setNav] = useState("home");
  const { ready:fwReady, pay } = useFlutterwave();

  const refreshUser = async () => {
    const d = await api("/auth/me");
    auth.setUser?.(d.user);
  };

  if (auth.loading) return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16 }}>
      <div style={{ width:64, height:64, borderRadius:18, background:`linear-gradient(135deg,${T.accent},#ff8c55)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28 }}>📦</div>
      <div style={{ fontSize:22, fontWeight:900, color:T.text }}><span style={{ color:T.accent }}>Route</span>mate</div>
      <Spinner />
    </div>
  );

  if (!auth.user) return <AuthScreen auth={auth} />;

  const views = {
    home:   <HomeView   user={auth.user} setNav={setNav} pay={pay} fwReady={fwReady} />,
    find:   <FindView   user={auth.user} pay={pay} fwReady={fwReady} />,
    send:   <SendView   user={auth.user} />,
    track:  <TrackView  user={auth.user} />,
    wallet: <WalletView user={auth.user} pay={pay} fwReady={fwReady} refreshUser={refreshUser} />,
    chat:   <ChatView   user={auth.user} />,
    admin:  <AdminView  user={auth.user} fwReady={fwReady} />,
  };

  const initials = auth.user?.name?.split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase()||"RM";

  return (
    <div style={{ minHeight:"100vh", background:T.bg, fontFamily:"'DM Sans',sans-serif", color:T.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing:border-box; }
        ::-webkit-scrollbar { width:0; }
        input::placeholder,textarea::placeholder { color:#3D4F6E; }
        select option { background:#111827; }
      `}</style>
      <div style={{ maxWidth:430, margin:"0 auto", minHeight:"100vh", background:T.bg, display:"flex", flexDirection:"column" }}>

        {/* Header */}
        <div style={{ padding:"14px 20px 12px", display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom:`1px solid ${T.border}`, position:"sticky", top:0, background:T.bg+"f0", backdropFilter:"blur(12px)", zIndex:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:34, height:34, borderRadius:10, background:`linear-gradient(135deg,${T.accent},#ff8c55)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>📦</div>
            <div style={{ fontWeight:900, fontSize:18, letterSpacing:"-0.5px" }}>
              <span style={{ color:T.accent }}>Route</span><span style={{ color:T.text }}>mate</span>
            </div>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <div style={{ display:"flex", alignItems:"center", gap:5, background:T.fwSoft, border:`1px solid ${T.fw}30`, borderRadius:20, padding:"4px 10px" }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:fwReady?T.fw:T.gold, boxShadow:fwReady?`0 0 6px ${T.fw}`:"none" }} />
              <span style={{ fontSize:10, color:T.fw, fontWeight:700 }}>FW</span>
            </div>
            <div onClick={() => auth.logout()} title="Logout">
              <Avatar initials={initials} size={34} color={T.accent} />
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex:1, overflowY:"auto", padding:"20px 16px 100px" }}>
          {views[nav]}
        </div>

        {/* Bottom nav */}
        <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:430, background:T.surface+"f2", backdropFilter:"blur(16px)", borderTop:`1px solid ${T.border}`, display:"flex", padding:"10px 0 16px", zIndex:20 }}>
          {NAV.map(item => (
            <button key={item.id} onClick={()=>setNav(item.id)} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4, background:"none", border:"none", cursor:"pointer", color:nav===item.id?T.accent:T.textMuted, transition:"color 0.2s" }}>
              <span style={{ fontSize:18, filter:nav===item.id?`drop-shadow(0 0 6px ${T.accent})`:"none" }}>{item.icon}</span>
              <span style={{ fontSize:9, fontWeight:700, letterSpacing:"0.04em", textTransform:"uppercase" }}>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
