# Ammo.js Wind Flag Demo

A static Three.js + Ammo.js soft-body cloth demo that simulates a flag flying in animated wind.

## Local preview

```bash
python3 -m http.server 4173
```

Then open <http://127.0.0.1:4173/>.

## Deployment

This repository includes a GitHub Pages workflow at `.github/workflows/deploy.yml`. GitHub Pages only serves static files. The workflow does not install dependencies or run npm; it uses the system Node.js binary only to syntax-check `src/main.js`, then copies `index.html` plus `src/` into a `dist/` artifact.

After the branch is merged to `main`, enable GitHub Pages in the repository settings with **Source: GitHub Actions**. The workflow can also be run manually from the Actions tab via **Deploy static site to GitHub Pages**.
