Mudae Gallery Copier
====================

Install the included Tampermonkey script if you want the local Organizer to copy
Mudae gallery metadata automatically from mudae.net.

Current script:
- Mudae_Gallery_Copier.user.js

Version: 1.0.2

What it does:
- Runs only on Mudae tabs opened by the local Organizer marker.
- Copies gallery image URLs and metadata as JSON compatible with this Organizer.
- Reads Mudae data-matches so matched images can be marked in the Organizer gallery.
- Supports normal multi-image pages through section#images.
- Supports one-image characters through section#intro / #cover.
- Auto-enters the first matching character result when Mudae opens a search result page first.
