// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0

// Autoprefixer only. The styling layer is a hand-authored CSS design system in
// app/globals.css. Tailwind v4 needs the separate @tailwindcss/postcss plugin,
// which is not installed in this workspace and we do not add dependencies here.
const config = {
  plugins: {
    autoprefixer: {},
  },
};

export default config;
