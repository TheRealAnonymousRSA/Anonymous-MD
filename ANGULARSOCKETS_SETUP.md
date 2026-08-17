# Anonymous-MD — Angularsockets + KINGANON

This build uses `angularsockets` as the actual Baileys-compatible WhatsApp library.

## Custom pairing
The pairing request uses the custom 8-character value:
`KINGANON`

Set:
- `USE_PAIRING_CODE=true`
- `OWNER_NUMBER=country-code + number, digits only`

## Render persistence
Set:
- `SESSION_DIR=/data/session`

Attach a persistent disk mounted at `/data`.

## Start
`npm install`
`npm start`

The project no longer imports `@whiskeysockets/baileys`; both the main socket and media download helper use `angularsockets`.
