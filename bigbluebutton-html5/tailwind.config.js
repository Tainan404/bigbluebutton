const tailwindConfig = {
  content: ['./imports/**/*.{js,jsx,ts,tsx}', './client/**/*.{js,jsx,ts,tsx}', './client/main.html'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#1B73E8',
          primary: '#1B73E8',
        },
      },
    },
  },
  plugins: [],
};

module.exports = tailwindConfig;
