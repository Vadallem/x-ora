# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

This is a plain static site scaffold — no build tooling, no package manager, no framework. The root contains:

- `index.html` — currently empty
- `styles.css` — currently empty
- `script.js` — currently empty
- `assets/` — image files (`img1.jpeg` … `img6.jpg`)

There is no server, bundler, or test runner configured. Open `index.html` directly in a browser (or serve the directory with any static file server) to view the site.

## Notes for future work

- Since there's no build step, keep `index.html` linking directly to `styles.css` and `script.js` via relative paths.
- As real structure emerges (multiple pages, a build tool, tests), update this file to document the actual architecture rather than the current empty scaffold.
