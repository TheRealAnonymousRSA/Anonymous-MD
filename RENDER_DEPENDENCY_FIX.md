# Render dependency fix

This build keeps Angularsockets 1.4.5 as the WhatsApp socket library, pins sharp to ^0.34.5 for its peer requirement, and overrides libsignal/libsignal-node to the public npm package @alipclutch/libsignal-node@2.2.7 so npm does not attempt the GitHub SSH dependency.

Render:
- Build: npm install
- Start: npm start
