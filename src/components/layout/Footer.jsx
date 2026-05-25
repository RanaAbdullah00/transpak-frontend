import React from 'react';
import { Link } from 'react-router-dom';
import BrandLogo from './BrandLogo.jsx';

const Footer = () => (
  <footer className="bg-body border-top py-2 small text-muted d-none d-md-block tp-app-footer">
    <div className="container-fluid px-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
      <Link to="/" className="text-decoration-none d-flex align-items-center gap-2 text-muted">
        <BrandLogo variant="mark" title="TransPak" className="tp-footer-brand" />
        <span>© {new Date().getFullYear()} TransPak</span>
      </Link>
      <nav className="d-flex flex-wrap justify-content-center gap-3 align-items-center">
        <Link to="/about" className="text-muted text-decoration-none">
          About
        </Link>
        <Link to="/contact" className="text-muted text-decoration-none">
          Contact
        </Link>
        <span className="text-muted">Digital Freight Exchange</span>
      </nav>
    </div>
  </footer>
);

export default Footer;
