import React from 'react';
import { Link } from 'react-router-dom';

// Simple footer that stays above mobile bottom navigation.
const Footer = () => (
  <footer className="bg-body border-top py-2 small text-muted text-center d-none d-md-block">
    <div className="d-flex flex-wrap justify-content-center gap-3 align-items-center">
      <Link to="/about" className="text-muted text-decoration-none">
        About
      </Link>
      <Link to="/contact" className="text-muted text-decoration-none">
        Contact
      </Link>
      <span>© {new Date().getFullYear()} TransPak · Digital Freight Exchange</span>
    </div>
  </footer>
);

export default Footer;

