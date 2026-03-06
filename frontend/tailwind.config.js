/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg:       '#100e0b',
        surface:  '#181410',
        surface2: '#1e1a15',
        surface3: '#231f19',

        // Renamed — 'border' and 'green' clash with Tailwind built-ins
        bdr:      '#2e2820',   // was: border
        bdrlt:    '#3d3528',   // was: borderlt

        textprimary:   '#ede8e0',
        textsecondary: '#9c9080',
        textmuted:     '#5a5040',

        // Renamed — 'green' clashes with Tailwind's green scale
        fkgreen:       '#1a5c35',   // was: green
        fkgreenmid:    '#22773f',   // was: greenmid
        fkgreenlight:  '#2da050',   // was: greenlight
        fkgreenbright: '#45c466',   // was: greenbright

        fkred:         '#c8102e',   // was: red (also clashes)
        fkamber:       '#c8780a',   // was: amber
        fkamberbright: '#e8960e',   // was: amberbright
      },
      fontFamily: {
        display:   ['Bebas Neue', 'sans-serif'],
        body:      ['Barlow', 'sans-serif'],
        condensed: ['Barlow Condensed', 'sans-serif'],
      },
    },
  },
  plugins: [],
}