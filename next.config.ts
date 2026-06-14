import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  
  images: {
    domains: ["avatars.githubusercontent.com"] // allows a github image to be available in the session (session.user.image)
  }
};

export default nextConfig;
