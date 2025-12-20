function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-inner">
        <p className="footer-title">EuroPitch</p>
        <p className="footer-text">© {year} EuroPitch. All rights reserved.</p>
        <p className="footer-subtext">
          Advancing European student investors — from stock pitching to market
          strategy.
        </p>
        <div className="footer-social" style={{ marginTop: 12 }}>
          <a
            href="https://www.linkedin.com/company/euro-pitch"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="EuroPitch on LinkedIn"
            className="footer-social-link"
            style={{ marginRight: 12, color: "inherit" }}
          >
            {/* LinkedIn icon */}
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path d="M4.98 3.5C4.98 4.88 3.86 6 2.48 6S0 4.88 0 3.5 1.12 1 2.5 1 4.98 2.12 4.98 3.5zM.2 8.98h4.56V24H.2V8.98zM8.98 8.98h4.37v2.05h.06c.61-1.16 2.11-2.39 4.34-2.39 4.64 0 5.5 3.05 5.5 7.02V24h-4.56v-6.42c0-1.53-.03-3.5-2.13-3.5-2.13 0-2.46 1.66-2.46 3.39V24H8.98V8.98z" />
            </svg>
          </a>

          <a
            href="https://www.instagram.com/euro.pitch"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="EuroPitch on Instagram"
            className="footer-social-link"
            style={{ color: "inherit" }}
          >
            {/* Instagram icon */}
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <rect
                x="2"
                y="2"
                width="20"
                height="20"
                rx="5"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M12 7.2a4.8 4.8 0 1 0 0 9.6 4.8 4.8 0 0 0 0-9.6z"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <circle cx="17.5" cy="6.5" r="0.75" fill="currentColor" />
            </svg>
          </a>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
