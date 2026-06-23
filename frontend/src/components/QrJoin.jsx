import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { fetchLanHost } from '../config';
import { useT } from '../i18n.jsx';

// Builds the join URL from the backend-detected LAN IP + the page's own port,
// so the QR is scannable even when the host opened the page at localhost.
export default function QrJoin({ size = 160, showUrl = false }) {
  const t = useT();
  const [host, setHost] = useState(null);

  useEffect(() => {
    let on = true;
    fetchLanHost().then((h) => { if (on) setHost(h); });
    return () => { on = false; };
  }, []);

  if (!host) {
    return (
      <div className="qrjoin">
        <div className="qr-box" style={{ width: size, height: size }} />
      </div>
    );
  }

  const port = window.location.port;
  const url = `http://${host}${port ? `:${port}` : ''}/`;
  const isLocal = /^(localhost|127\.|::1|\[::1\])/.test(host);

  return (
    <div className="qrjoin">
      <div className="qr-box">
        <QRCodeSVG value={url} size={size} bgColor="#ffffff" fgColor="#0f1226" level="M" />
      </div>
      {showUrl && <div className="qr-url">{url}</div>}
      {showUrl && isLocal && (
        <div className="qr-warn">
          {t('qr.noLan')}
        </div>
      )}
    </div>
  );
}
