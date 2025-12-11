/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /* Ensure API keys are only read server-side */
  env: {
    // Note: Do NOT put API_KEY here if you want it secret. 
    // process.env.API_KEY is automatically available in server-side files (app/api/...)
    // without defining it here.
  }
};

export default nextConfig;