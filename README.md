# Next.js Sitecore Marketplace App

This project is a **Next.js + TypeScript application** designed to be published as a **Sitecore Marketplace App** and integrated with **Sitecore XM Cloud**.  
It provides a starter setup with **CORS headers**, **custom integrations**, and a structure that allows your app to run securely inside Sitecore Pages (Experience Editor).

---

## What is a Sitecore Marketplace App?

Sitecore Marketplace Apps extend **XM Cloud** by adding features directly into the authoring environment.  
These apps are built as standalone web apps (Next.js, React, etc.) and embedded in Sitecore via **iframe extensions** such as:

- **Pages Context Panel Extension** (apps appear in the right-hand panel of Pages)
- **Content Editor Extensions** (apps appear in the Sitecore Content Editor)
- **Dashboard Widgets**  

Your app runs in your own hosting environment (e.g., Vercel, Azure, Netlify), and communicates with Sitecore Pages via secure CORS.

---

## How This App Works with Marketplace

- The app is deployed as a Next.js project (can be hosted anywhere).
- Sitecore XM Cloud loads the app inside an iframe panel (e.g., Pages context panel).
- CORS headers in `next.config.ts` ensure the Sitecore rendering host (Pages) can securely fetch your app
- Marketplace listing provides metadata (name, description, icons, etc.), but your app code lives in **your repo + hosting**.

---

## Creating a Sitecore Marketplace App (Step-by-Step)

1. **Develop Your App**

   * Build your app in **Next.js (TS)** or React.
   * Ensure the app can be embedded via iframe (responsive layout, no forced redirects).
   * Add CORS headers in `next.config.ts` to allow Sitecore Pages rendering host.

2. **Deploy Your App**

   * Deploy to Vercel, Azure, AWS, or Netlify.
   * Verify it runs at a secure HTTPS endpoint (required by XM Cloud).

3. **Register the App in Sitecore XM Cloud**

   * Log in to [Sitecore Cloud Portal](https://portal.sitecorecloud.io).
   * Go to **Marketplace → My Apps → Create App**.
   * Provide:

     * App Name, Icon, Description
     * App URL (deployed endpoint, e.g., `https://your-app.vercel.app`)
     * Supported extension points (e.g., Pages Context Panel).
   * Save and publish your app listing.

4. **Install Your App in XM Cloud**

   * In **Sitecore Pages**, open the Marketplace tab.
   * Search for your app and install it.
   * Your app will now show up in the **Pages Context Panel** (or whichever extension point you registered).

---

## Getting Started (Development)

Install dependencies:

```bash
npm install
# or
yarn install
```

Run local dev server:

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

---

## Example Use Case: SEO & Accessibility Auditor

This app can be extended into a **Pages Context Panel App** that:

* Fetches the current page’s rendered HTML from XM Cloud
* Runs SEO + WCAG accessibility checks (meta tags, alt attributes, headings, link texts, etc.)
* Displays inline recommendations to content authors directly in **Sitecore Pages**

---

## Deployment

Deploy to any modern platform:

* **Vercel (Recommended)** – seamless Next.js hosting
* **Azure App Services**
* **Netlify**

After deployment, update the Marketplace App URL with your production endpoint.

---

## License

MIT License – free to use, modify, and publish as your own Marketplace app.

